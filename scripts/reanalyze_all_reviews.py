#!/usr/bin/env python3
"""
Re-classify EXISTING reviews' sentiment + topics with an LLM (default: Ollama).

Bulk import (scripts/import_public_data.py) labels reviews with fast keyword
rules. Run this on demand to upgrade those labels to LLM-based ones that read
the meaning of each review. Slower, but more accurate.

Usage:
  python scripts/reanalyze_all_reviews.py                  # ALL reviews via Ollama
  python scripts/reanalyze_all_reviews.py --limit 50       # first 50 reviews
  python scripts/reanalyze_all_reviews.py --provider groq  # use Groq instead
  python scripts/reanalyze_all_reviews.py --skip-existing  # only un-analyzed reviews
  python scripts/reanalyze_all_reviews.py --sleep 0.5      # throttle (rate limits)
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.db.models import CourseOffering, Review, SentimentAnalysis, TopicAnalysis  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.course_service import course_service  # noqa: E402

PROVIDERS = {
    "ollama": "app.services.ollama_ml_service",
    "groq": "app.services.groq_ml_service",
    "openai": "app.services.openai_ml_service",
}


def _load_service(provider: str):
    import importlib

    module_path = PROVIDERS.get(provider)
    if not module_path:
        raise SystemExit(f"Unknown provider: {provider} (choose from {', '.join(PROVIDERS)})")
    return importlib.import_module(module_path)


def _analyze_with_retry(svc, text: str, *, retries: int, backoff: float):
    """Call svc.analyze_review with simple exponential backoff on failure."""
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return svc.analyze_review(text, limit=3)
        except Exception as exc:  # noqa: BLE001 - want to retry any transient error
            last_exc = exc
            if attempt < retries:
                wait = backoff * (2**attempt)
                print(f"    retry {attempt + 1}/{retries} after error: {exc} (waiting {wait:.1f}s)")
                time.sleep(wait)
    raise last_exc  # type: ignore[misc]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--provider",
        default="ollama",
        choices=sorted(PROVIDERS),
        help="LLM provider to use (default: ollama)",
    )
    parser.add_argument("--limit", type=int, default=None, help="Max reviews to re-analyze")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Only re-analyze reviews that have no sentiment row yet",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.0,
        help="Seconds to sleep between calls (use for cloud rate limits)",
    )
    parser.add_argument(
        "--retries", type=int, default=3, help="Retries per review on transient failure"
    )
    parser.add_argument(
        "--commit-every", type=int, default=50, help="Commit to DB every N reviews"
    )
    args = parser.parse_args()

    svc = _load_service(args.provider)
    if not svc.is_available():
        if args.provider == "ollama":
            print("Ollama is not reachable. Start it: ./scripts/start-ollama.sh")
        else:
            print(f"{args.provider} is not available (check API key / connectivity).")
        return 1

    db = SessionLocal()
    try:
        query = db.query(Review).order_by(Review.review_id)
        if args.skip_existing:
            query = query.filter(~Review.sentiment.has())
        if args.limit:
            query = query.limit(args.limit)
        reviews = query.all()

        total = len(reviews)
        if total == 0:
            print("No reviews to re-analyze.")
            return 0

        print(f"Re-analyzing {total} reviews via {args.provider}…")

        offering_to_course: dict[int, int] = {}
        course_ids: set[int] = set()
        processed = 0
        failed = 0

        for index, review in enumerate(reviews, start=1):
            text = (review.review_text or "").strip()
            if not text:
                continue

            try:
                sentiment, topics = _analyze_with_retry(
                    svc, text, retries=args.retries, backoff=1.0
                )
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"  [{index}/{total}] FAILED review {review.review_id}: {exc}")
                continue

            if review.sentiment:
                review.sentiment.sentiment = sentiment.sentiment
                review.sentiment.confidence_score = sentiment.confidence
            else:
                db.add(
                    SentimentAnalysis(
                        review_id=review.review_id,
                        sentiment=sentiment.sentiment,
                        confidence_score=sentiment.confidence,
                    )
                )

            db.query(TopicAnalysis).filter(
                TopicAnalysis.review_id == review.review_id
            ).delete()
            for topic in topics:
                db.add(TopicAnalysis(review_id=review.review_id, topic_name=topic))

            if review.offering_id not in offering_to_course:
                offering = db.get(CourseOffering, review.offering_id)
                if offering:
                    offering_to_course[review.offering_id] = offering.course_id
            course_id = offering_to_course.get(review.offering_id)
            if course_id:
                course_ids.add(course_id)

            processed += 1
            if processed % 25 == 0 or index == total:
                print(
                    f"  [{index}/{total}] {sentiment.sentiment} "
                    f"({sentiment.confidence}) — {topics}"
                )

            if processed % args.commit_every == 0:
                db.commit()
                print(f"  … committed {processed} reviews")

            if args.sleep:
                time.sleep(args.sleep)

        db.commit()

        print(f"Refreshing summaries for {len(course_ids)} courses…")
        for course_id in course_ids:
            course_service.refresh_course_summary(db, course_id)
        db.commit()

        print(
            f"Done. Re-analyzed {processed} reviews via {args.provider} "
            f"({failed} failed)."
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
