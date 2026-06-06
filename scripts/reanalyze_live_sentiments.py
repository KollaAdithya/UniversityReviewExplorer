#!/usr/bin/env python3
"""
Re-run Ollama sentiment + topics on reviews for one course (or --limit N reviews).
Use after enabling Ollama to upgrade existing review labels for a demo course.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.db.models import Course, CourseOffering, Review, SentimentAnalysis, TopicAnalysis  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services import ml_service, ollama_ml_service  # noqa: E402
from app.services.course_service import course_service  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--course-code", default="ASTR", help="Course code substring to match")
    parser.add_argument("--limit", type=int, default=10, help="Max reviews to reanalyze")
    args = parser.parse_args()

    if not ollama_ml_service.is_available():
        print("Start Ollama: ./scripts/start-ollama.sh")
        return 1

    db = SessionLocal()
    try:
        course = (
            db.query(Course)
            .filter(Course.course_code.ilike(f"%{args.course_code}%"))
            .first()
        )
        if not course:
            print(f"No course matching code: {args.course_code}")
            return 1

        reviews = (
            db.query(Review)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .filter(CourseOffering.course_id == course.course_id)
            .limit(args.limit)
            .all()
        )
        print(f"Reanalyzing {len(reviews)} reviews for {course.course_code}…")

        for review in reviews:
            sentiment, topics = ml_service.process_live_review(review.review_text)
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
            db.query(TopicAnalysis).filter(TopicAnalysis.review_id == review.review_id).delete()
            for topic in topics:
                db.add(TopicAnalysis(review_id=review.review_id, topic_name=topic))
            print(f"  {sentiment.sentiment} ({sentiment.confidence}) — {topics}")

        course_service.refresh_course_summary(db, course.course_id)
        db.commit()
        print("Summary refreshed with Ollama.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
