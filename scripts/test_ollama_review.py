#!/usr/bin/env python3
"""Smoke test: LLM sentiment + topics for a live review (Groq/Ollama)."""

import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)

os.environ.setdefault("ML_PROVIDER", "groq")
os.environ.setdefault("OLLAMA_LIVE_REVIEWS_ONLY", "true")

from app.services import ml_service  # noqa: E402

SAMPLE = (
    "Great professor and clear lectures, but the workload is heavy with weekly "
    "projects and a tough final exam. Grading was fair overall."
)


def main() -> int:
    status = ml_service.llm_status()
    print("LLM provider:", status.get("provider"), "reachable:", status.get("reachable"))
    print("Health:", json.dumps(status, indent=2))
    if not status.get("reachable"):
        print("\nLLM offline — testing mock fallback paths…")

    sentiment, topics = ml_service.process_live_review(SAMPLE)
    print("\nSample review:", SAMPLE[:80], "...")
    print("Sentiment:", sentiment.sentiment, "confidence:", sentiment.confidence)
    print("Topics:", topics)

    summary = ml_service.generate_summary(
        [SAMPLE, "Tough exams but fair grading and helpful office hours."],
        positive=1,
        neutral=0,
        negative=1,
        top_topics=["Exams", "Grading", "Workload"],
    )
    print("\nSample summary:\n", summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
