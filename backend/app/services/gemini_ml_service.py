from __future__ import annotations

import logging
from typing import Callable

from app.config import settings

logger = logging.getLogger(__name__)


def _clients() -> list[tuple[str, Callable]]:
    from google import genai

    factories: list[tuple[str, Callable]] = []
    if settings.gcp_project.strip():
        factories.append(
            (
                "vertex",
                lambda: genai.Client(
                    vertexai=True,
                    project=settings.gcp_project,
                    location=settings.gcp_region,
                ),
            )
        )
    if settings.gemini_api_key.strip():
        factories.append(
            (
                "gemini_api",
                lambda: genai.Client(api_key=settings.gemini_api_key),
            )
        )
        factories.append(
            (
                "vertex_express",
                lambda: genai.Client(vertexai=True, api_key=settings.gemini_api_key),
            )
        )
    return factories


def _generate_text(prompt: str) -> str:
    errors: list[str] = []
    model = settings.gemini_model

    for label, factory in _clients():
        try:
            client = factory()
            response = client.models.generate_content(model=model, contents=prompt)
            text = (response.text or "").strip()
            if not text:
                raise ValueError("Gemini returned empty summary")
            logger.info("gemini summary via %s (%s)", model, label)
            return text
        except Exception as exc:
            errors.append(f"{label}: {exc}")
            logger.warning("Gemini client %s failed: %s", label, exc)

    if errors:
        raise ConnectionError("; ".join(errors))
    raise ConnectionError("Gemini not configured (set GCP_PROJECT or GEMINI_API_KEY)")


def is_available() -> bool:
    return bool(settings.gemini_api_key.strip()) or bool(settings.gcp_project.strip())


def generate_summary(
    review_texts: list[str],
    positive: int,
    neutral: int,
    negative: int,
    top_topics: list[str],
) -> str:
    if not review_texts:
        return "No reviews yet for this course."

    total = positive + neutral + negative
    pos_pct = round(positive * 100 / total) if total else 0
    neu_pct = round(neutral * 100 / total) if total else 0
    neg_pct = max(0, 100 - pos_pct - neu_pct) if total else 0
    topics_text = ", ".join(top_topics[:6]) if top_topics else "various themes"
    joined = "\n".join(f"- {text}" for text in review_texts[:20])

    prompt = (
        "You help students choose university courses. Summarize these student reviews as "
        "4-6 concise bullet points. Start EACH bullet with '- ' on its own line. "
        "Cover overall sentiment, workload, grading, lectures, and recurring strengths or concerns. "
        "Keep each bullet under 20 words. Do NOT add a heading, intro, or closing line.\n\n"
        f"Approximate sentiment: {pos_pct}% positive, {neu_pct}% neutral, {neg_pct}% negative.\n"
        f"Common topics: {topics_text}.\n\n"
        f"Reviews:\n{joined}"
    )
    return _generate_text(prompt)
