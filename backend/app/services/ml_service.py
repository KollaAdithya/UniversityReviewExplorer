from __future__ import annotations

import json
import logging
import re

from app.config import settings
from app.schemas import SentimentResult
from app.services import mock_ml_service

logger = logging.getLogger(__name__)


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


def analyze_sentiment(text: str) -> SentimentResult:
    if settings.use_mock_ml:
        return mock_ml_service.analyze_sentiment(text)

    try:
        model = _get_vertex_model()
        prompt = (
            "Analyze the sentiment of this course review.\n"
            f'Review: "{text}"\n'
            'Return only JSON: {"sentiment": "positive|neutral|negative", "confidence": 0.0-1.0}'
        )
        response = model.generate_content(prompt)
        data = _parse_json(response.text)
        return SentimentResult(sentiment=data["sentiment"], confidence=float(data["confidence"]))
    except Exception as exc:
        logger.warning("Vertex sentiment failed, using mock: %s", exc)
        return mock_ml_service.analyze_sentiment(text)


def extract_topics(text: str, limit: int = 3) -> list[str]:
    if settings.use_mock_ml:
        return mock_ml_service.extract_topics(text, limit=limit)

    try:
        model = _get_vertex_model()
        prompt = (
            f"Extract the top {limit} topics from this course review.\n"
            f'Review: "{text}"\n'
            'Return only JSON array of topic strings, e.g. ["Projects","Workload"].'
        )
        response = model.generate_content(prompt)
        data = _parse_json(response.text)
        if isinstance(data, list):
            return [str(item) for item in data[:limit]]
    except Exception as exc:
        logger.warning("Vertex topic extraction failed, using mock: %s", exc)

    return mock_ml_service.extract_topics(text, limit=limit)


def generate_summary(review_texts: list[str], positive: int, neutral: int, negative: int, top_topics: list[str]) -> str:
    if settings.use_mock_ml or not review_texts:
        return mock_ml_service.generate_summary(review_texts, positive, neutral, negative, top_topics)

    try:
        model = _get_vertex_model()
        joined = "\n".join(f"- {text}" for text in review_texts[:20])
        prompt = (
            "Summarize the common opinions from these course reviews in less than 100 words.\n"
            f"Reviews:\n{joined}"
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as exc:
        logger.warning("Vertex summary failed, using mock: %s", exc)
        return mock_ml_service.generate_summary(review_texts, positive, neutral, negative, top_topics)
