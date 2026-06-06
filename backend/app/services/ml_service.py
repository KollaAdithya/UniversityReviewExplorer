from __future__ import annotations

import json
import logging
import re

from app.config import settings
from app.schemas import SentimentResult
from app.services import mock_ml_service

logger = logging.getLogger(__name__)

LLM_PROVIDERS = {"ollama", "groq", "openai"}


def _parse_json(text: str) -> dict | list:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return json.loads(cleaned)


def _get_vertex_model():
    import vertexai
    from vertexai.generative_models import GenerativeModel

    vertexai.init(project=settings.gcp_project, location=settings.gcp_region)
    return GenerativeModel(settings.vertex_model)


def _provider_is_llm() -> bool:
    return settings.ml_provider in LLM_PROVIDERS


def _live_reviews_only() -> bool:
    return settings.ollama_live_reviews_only


def _get_llm_service():
    if settings.ml_provider == "openai":
        from app.services import openai_ml_service

        return openai_ml_service
    if settings.ml_provider == "groq":
        from app.services import groq_ml_service

        return groq_ml_service
    from app.services import ollama_ml_service

    return ollama_ml_service


def _llm_model_name() -> str:
    if settings.ml_provider == "openai":
        return settings.openai_model
    if settings.ml_provider == "groq":
        return settings.groq_model
    return settings.ollama_model


def _llm_or_mock(llm_fn, mock_fn, label: str):
    result, _ = _llm_or_mock_with_source(llm_fn, mock_fn, label)
    return result


def _llm_or_mock_with_source(llm_fn, mock_fn, label: str) -> tuple[object, str]:
    if not _provider_is_llm():
        return mock_fn(), "mock"
    try:
        svc = _get_llm_service()
        if not svc.is_available():
            raise ConnectionError(f"{settings.ml_provider} is not reachable")
        result = llm_fn(svc)
        logger.info("%s %s via %s", settings.ml_provider, label, _llm_model_name())
        return result, settings.ml_provider
    except Exception as exc:
        logger.warning("%s %s failed, using mock: %s", settings.ml_provider, label, exc)
        return mock_fn(), "mock"


def process_live_review(text: str, limit: int = 3) -> tuple[SentimentResult, list[str]]:
    """Sentiment + topics for POST /api/v1/reviews."""
    return _llm_or_mock(
        lambda svc: svc.analyze_review(text, limit=limit),
        lambda: (
            mock_ml_service.analyze_sentiment(text),
            mock_ml_service.extract_topics(text, limit=limit),
        ),
        "live review",
    )


def analyze_sentiment(text: str) -> SentimentResult:
    """Per-review sentiment (bulk import uses mock when live_reviews_only=true)."""
    if _provider_is_llm() and _live_reviews_only():
        return mock_ml_service.analyze_sentiment(text)

    return _llm_or_mock(
        lambda svc: svc.analyze_sentiment(text),
        lambda: mock_ml_service.analyze_sentiment(text),
        "sentiment",
    )


def extract_topics(text: str, limit: int = 3) -> list[str]:
    if _provider_is_llm() and _live_reviews_only():
        return mock_ml_service.extract_topics(text, limit=limit)

    return _llm_or_mock(
        lambda svc: svc.extract_topics(text, limit=limit),
        lambda: mock_ml_service.extract_topics(text, limit=limit),
        "topics",
    )


def _format_provider_error(exc: Exception) -> str:
    import urllib.error

    if isinstance(exc, urllib.error.HTTPError):
        try:
            body = json.loads(exc.read().decode())
            message = body.get("error") or body.get("message") or str(body)
            return f"HTTP {exc.code}: {message}"
        except Exception:
            return f"HTTP {exc.code}: {exc.reason}"
    return str(exc)


def generate_summary(
    review_texts: list[str],
    positive: int,
    neutral: int,
    negative: int,
    top_topics: list[str],
) -> str:
    summary, _, _ = generate_summary_with_source(
        review_texts, positive, neutral, negative, top_topics
    )
    return summary


def _model_for_source(source: str) -> str | None:
    if source == "openai":
        return settings.openai_model
    if source == "groq":
        return settings.groq_model
    if source == "ollama":
        return settings.ollama_model
    return None


def _generate_summary_for_provider(
    review_texts: list[str],
    positive: int,
    neutral: int,
    negative: int,
    top_topics: list[str],
    provider: str,
) -> tuple[str, str]:
    """Generate summary using an explicit provider (default | openai | groq | ollama)."""
    chosen = provider.lower()
    if chosen in ("default", "mock"):
        return (
            mock_ml_service.generate_summary(review_texts, positive, neutral, negative, top_topics),
            "mock",
        )

    if chosen == "openai":
        from app.services import openai_ml_service

        if not openai_ml_service.is_available():
            raise ConnectionError("OpenAI API key missing or unreachable")
        summary = openai_ml_service.generate_summary(
            review_texts, positive, neutral, negative, top_topics
        )
        logger.info("openai summary via %s", settings.openai_model)
        return summary, "openai"

    if chosen == "groq":
        from app.services import groq_ml_service

        if not groq_ml_service.is_available():
            raise ConnectionError("Groq API key missing or unreachable")
        summary = groq_ml_service.generate_summary(
            review_texts, positive, neutral, negative, top_topics
        )
        logger.info("groq summary via %s", settings.groq_model)
        return summary, "groq"

    if chosen == "ollama":
        from app.services import ollama_ml_service

        if not ollama_ml_service.is_available():
            raise ConnectionError("Ollama is not reachable")
        summary = ollama_ml_service.generate_summary(
            review_texts, positive, neutral, negative, top_topics
        )
        logger.info("ollama summary via %s", settings.ollama_model)
        return summary, "ollama"

    raise ValueError(f"Unknown summary provider: {provider}")


def generate_summary_with_source(
    review_texts: list[str],
    positive: int,
    neutral: int,
    negative: int,
    top_topics: list[str],
    provider: str | None = None,
) -> tuple[str, str, str | None]:
    """Course-level AI summary: (text, source, fallback_error)."""
    if not review_texts:
        return (
            mock_ml_service.generate_summary(review_texts, positive, neutral, negative, top_topics),
            "mock",
            None,
        )

    if provider:
        try:
            summary, source = _generate_summary_for_provider(
                review_texts, positive, neutral, negative, top_topics, provider
            )
            return summary, source, None
        except Exception as exc:
            logger.warning("Summary provider %s failed, using mock: %s", provider, exc)
            return (
                mock_ml_service.generate_summary(
                    review_texts, positive, neutral, negative, top_topics
                ),
                "mock",
                _format_provider_error(exc),
            )

    if _provider_is_llm():
        summary, source = _llm_or_mock_with_source(
            lambda svc: svc.generate_summary(review_texts, positive, neutral, negative, top_topics),
            lambda: mock_ml_service.generate_summary(review_texts, positive, neutral, negative, top_topics),
            "summary",
        )
        return str(summary), source, None

    if settings.use_mock_ml:
        return (
            mock_ml_service.generate_summary(review_texts, positive, neutral, negative, top_topics),
            "mock",
            None,
        )

    try:
        model = _get_vertex_model()
        joined = "\n".join(f"- {text}" for text in review_texts[:20])
        prompt = (
            "Summarize the common opinions from these course reviews in less than 100 words.\n"
            f"Reviews:\n{joined}"
        )
        response = model.generate_content(prompt)
        return response.text.strip(), "vertex", None
    except Exception as exc:
        logger.warning("Vertex summary failed, using mock: %s", exc)
        return (
            mock_ml_service.generate_summary(review_texts, positive, neutral, negative, top_topics),
            "mock",
            _format_provider_error(exc),
        )


def llm_status() -> dict:
    if not _provider_is_llm():
        return {"enabled": False, "reachable": False, "provider": settings.ml_provider}
    try:
        svc = _get_llm_service()
        return {
            "enabled": True,
            "reachable": svc.is_available(),
            "provider": settings.ml_provider,
            "model": _llm_model_name(),
            "live_reviews_only": _live_reviews_only(),
            "summary_via_llm": True,
            "live_sentiment_via_llm": True,
        }
    except Exception:
        return {
            "enabled": True,
            "reachable": False,
            "provider": settings.ml_provider,
            "model": _llm_model_name(),
        }


def summary_providers_status() -> dict:
    from app.services import groq_ml_service, ollama_ml_service, openai_ml_service

    return {
        "default": {
            "label": "Default",
            "description": "Fast template summary (no API call)",
            "available": True,
            "model": None,
        },
        "openai": {
            "label": "OpenAI",
            "description": "GPT cloud API",
            "available": openai_ml_service.is_available(),
            "model": settings.openai_model,
        },
        "groq": {
            "label": "Groq",
            "description": "Cloud Llama API (free tier)",
            "available": groq_ml_service.is_available(),
            "model": settings.groq_model,
        },
        "ollama": {
            "label": "Ollama",
            "description": "Local Llama on your machine",
            "available": ollama_ml_service.is_available(),
            "model": settings.ollama_model,
        },
    }


def ollama_status() -> dict:
    """Backward-compatible alias used by /health."""
    return llm_status()
