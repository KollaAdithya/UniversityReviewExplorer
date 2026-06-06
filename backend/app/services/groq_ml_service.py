from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request

from app.config import settings
from app.schemas import SentimentResult

logger = logging.getLogger(__name__)

VALID_SENTIMENTS = {"positive", "neutral", "negative"}


def _parse_json(text: str) -> dict | list:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return json.loads(cleaned)


def _request_chat(prompt: str, *, json_mode: bool = False) -> str:
    url = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
    payload: dict = {
        "model": settings.groq_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.groq_api_key}",
            "User-Agent": "course-review-explorer/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=settings.groq_timeout_sec) as response:
        body = json.loads(response.read())
    return body["choices"][0]["message"]["content"]


def _chat_json(prompt: str) -> str:
    return _request_chat(prompt, json_mode=True)


def _chat_text(prompt: str) -> str:
    return _request_chat(prompt, json_mode=False)


def is_available() -> bool:
    """True when a Groq API key is configured (chat API is used for summaries)."""
    return bool(settings.groq_api_key.strip())


def analyze_review(text: str, limit: int = 3) -> tuple[SentimentResult, list[str]]:
    prompt = (
        "You analyze university course reviews. Return ONLY valid JSON with this shape:\n"
        '{"sentiment":"positive|neutral|negative","confidence":0.0,"topics":["Topic1","Topic2"]}\n'
        f"Extract at most {limit} short topic labels (e.g. Workload, Exams, Lectures, Grading, Projects).\n"
        f'Review: "{text}"'
    )
    raw = _chat_json(prompt)
    data = _parse_json(raw)
    if not isinstance(data, dict):
        raise ValueError("Groq returned non-object JSON")

    sentiment = str(data.get("sentiment", "neutral")).lower()
    if sentiment not in VALID_SENTIMENTS:
        sentiment = "neutral"

    confidence = float(data.get("confidence", 0.7))
    confidence = max(0.0, min(1.0, confidence))

    topics_raw = data.get("topics", [])
    topics: list[str] = []
    if isinstance(topics_raw, list):
        for item in topics_raw[:limit]:
            label = str(item).strip()
            if label:
                topics.append(label[:50])
    if not topics:
        topics = ["General"]

    return SentimentResult(sentiment=sentiment, confidence=round(confidence, 2)), topics


def analyze_sentiment(text: str) -> SentimentResult:
    sentiment, _ = analyze_review(text, limit=1)
    return sentiment


def extract_topics(text: str, limit: int = 3) -> list[str]:
    _, topics = analyze_review(text, limit=limit)
    return topics


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
        "You help students choose university courses. Write a concise summary (under 100 words) "
        "based on these student reviews. Mention overall sentiment, workload, grading, lectures, "
        "and any recurring strengths or concerns. Be specific and helpful.\n\n"
        f"Approximate sentiment: {pos_pct}% positive, {neu_pct}% neutral, {neg_pct}% negative.\n"
        f"Common topics: {topics_text}.\n\n"
        f"Reviews:\n{joined}"
    )
    summary = _chat_text(prompt).strip()
    if not summary:
        raise ValueError("Groq returned empty summary")
    return summary
