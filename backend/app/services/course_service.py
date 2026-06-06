from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.db.models import Course, CourseOffering, CourseSummary, Professor, Review, SentimentAnalysis, TopicAnalysis
from app.services import ml_service

logger = logging.getLogger(__name__)


class CourseService:
    def list_courses(
        self,
        db: Session,
        university_id: UUID | None = None,
        query: str | None = None,
    ) -> list[Course]:
        q = db.query(Course)
        if university_id:
            q = q.filter(Course.university_id == university_id)
        if query:
            pattern = f"%{query.strip()}%"
            q = q.filter(
                (Course.course_code.ilike(pattern))
                | (Course.course_name.ilike(pattern))
                | (Course.department.ilike(pattern))
            )
        return q.order_by(Course.course_code).all()

    def get_course(self, db: Session, course_id: UUID, university_id: UUID | None = None) -> Course | None:
        q = db.query(Course).filter(Course.course_id == course_id)
        if university_id:
            q = q.filter(Course.university_id == university_id)
        return q.first()

    def get_offerings(self, db: Session, course_id: UUID, university_id: UUID | None = None) -> list[CourseOffering]:
        q = (
            db.query(CourseOffering)
            .join(Course, Course.course_id == CourseOffering.course_id)
            .options(joinedload(CourseOffering.professor))
            .filter(CourseOffering.course_id == course_id)
        )
        if university_id:
            q = q.filter(Course.university_id == university_id)
        return q.order_by(CourseOffering.year.desc(), CourseOffering.semester).all()

    def get_analytics(self, db: Session, course_id: UUID, university_id: UUID | None = None) -> dict | None:
        course = self.get_course(db, course_id, university_id=university_id)
        if not course:
            return None

        summary = db.query(CourseSummary).filter(CourseSummary.course_id == course_id).first()
        topic_counts = self._topic_counts(db, course_id)
        topics = [item["topic"] for item in topic_counts[:5]]

        review_stats = (
            db.query(Review.rating)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .filter(CourseOffering.course_id == course_id)
            .all()
        )
        review_count = len(review_stats)
        avg_rating = (
            round(sum(r[0] for r in review_stats) / review_count, 2) if review_count else 0.0
        )

        if summary:
            total = summary.positive_reviews + summary.neutral_reviews + summary.negative_reviews
            if total > 0:
                positive_pct = round(summary.positive_reviews * 100 / total)
                neutral_pct = round(summary.neutral_reviews * 100 / total)
                negative_pct = max(0, 100 - positive_pct - neutral_pct)
            else:
                positive_pct = neutral_pct = negative_pct = 0
            generated_summary = summary.generated_summary
        else:
            positive_pct = neutral_pct = negative_pct = 0
            generated_summary = "No reviews yet for this course."

        return {
            "course_id": course.course_id,
            "course_code": course.course_code,
            "course_name": course.course_name,
            "positive": positive_pct,
            "neutral": neutral_pct,
            "negative": negative_pct,
            "topics": topics,
            "topic_breakdown": topic_counts[:10],
            "summary": generated_summary,
            "review_count": review_count,
            "avg_rating": avg_rating,
        }

    def _topic_counts(self, db: Session, course_id: UUID, limit: int = 10) -> list[dict]:
        rows = (
            db.query(TopicAnalysis.topic_name)
            .join(Review, Review.review_id == TopicAnalysis.review_id)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .filter(CourseOffering.course_id == course_id)
            .all()
        )
        counts: dict[str, int] = {}
        for (topic_name,) in rows:
            counts[topic_name] = counts.get(topic_name, 0) + 1
        return [
            {"topic": topic, "count": count}
            for topic, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]
        ]

    def _top_topics(self, db: Session, course_id: UUID, limit: int = 5) -> list[str]:
        return [item["topic"] for item in self._topic_counts(db, course_id, limit=limit)]

    @staticmethod
    def _semester_sort_key(semester: str, year: int) -> tuple:
        season_order = 0 if semester.lower().startswith("spring") else 1
        return (year, season_order)

    @staticmethod
    def _sentiment_score(positive: int, neutral: int, negative: int) -> float:
        total = positive + neutral + negative
        if total == 0:
            return 0.0
        return round((positive - negative) / total, 3)

    def get_semester_trends(
        self,
        db: Session,
        course_id: UUID,
        university_id: UUID | None = None,
    ) -> list[dict]:
        reviews = review_service.list_reviews(db, course_id=course_id, university_id=university_id)
        buckets: dict[tuple[str, int, str], dict] = {}

        for review in reviews:
            semester = review.get("semester") or "Unknown"
            year = review.get("year") or 0
            label = f"{semester} {year}".strip()
            key = (semester, year, label)
            if key not in buckets:
                buckets[key] = {
                    "semester_label": label,
                    "semester": semester,
                    "year": year,
                    "ratings": [],
                    "positive": 0,
                    "neutral": 0,
                    "negative": 0,
                }
            bucket = buckets[key]
            bucket["ratings"].append(review["rating"])
            sentiment = (review.get("sentiment") or "neutral").lower()
            if sentiment == "positive":
                bucket["positive"] += 1
            elif sentiment == "negative":
                bucket["negative"] += 1
            else:
                bucket["neutral"] += 1

        results = []
        for key in sorted(buckets.keys(), key=lambda k: self._semester_sort_key(k[0], k[1])):
            bucket = buckets[key]
            total = bucket["positive"] + bucket["neutral"] + bucket["negative"]
            results.append(
                {
                    "semester_label": bucket["semester_label"],
                    "semester": bucket["semester"],
                    "year": bucket["year"],
                    "review_count": total,
                    "avg_rating": round(sum(bucket["ratings"]) / len(bucket["ratings"]), 2)
                    if bucket["ratings"]
                    else 0.0,
                    "positive_pct": round(bucket["positive"] * 100 / total, 1) if total else 0.0,
                    "sentiment_score": self._sentiment_score(
                        bucket["positive"], bucket["neutral"], bucket["negative"]
                    ),
                }
            )
        return results

    def get_university_course_comparison(
        self,
        db: Session,
        university_id: UUID,
    ) -> list[dict]:
        courses = self.list_courses(db, university_id=university_id)
        comparison = []
        for course in courses:
            analytics = self.get_analytics(db, course.course_id, university_id=university_id)
            if not analytics:
                continue
            comparison.append(
                {
                    "course_id": course.course_id,
                    "course_code": course.course_code,
                    "course_name": course.course_name,
                    "review_count": analytics["review_count"],
                    "avg_rating": analytics["avg_rating"],
                    "positive_pct": float(analytics["positive"]),
                    "sentiment_score": self._sentiment_score(
                        analytics["positive"], analytics["neutral"], analytics["negative"]
                    ),
                }
            )
        return sorted(comparison, key=lambda item: item["course_code"])

    def refresh_course_summary(
        self, db: Session, course_id: UUID, provider: str | None = None
    ) -> dict:
        reviews = (
            db.query(Review)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .outerjoin(SentimentAnalysis, SentimentAnalysis.review_id == Review.review_id)
            .filter(CourseOffering.course_id == course_id)
            .all()
        )

        positive = neutral = negative = 0
        texts: list[str] = []
        for review in reviews:
            texts.append(review.review_text)
            sentiment = review.sentiment.sentiment if review.sentiment else "neutral"
            if sentiment == "positive":
                positive += 1
            elif sentiment == "negative":
                negative += 1
            else:
                neutral += 1

        total = positive + neutral + negative
        overall = round((positive - negative) / total, 2) if total else 0.0
        top_topics = self._top_topics(db, course_id)
        summary_text, source, fallback_error = ml_service.generate_summary_with_source(
            texts, positive, neutral, negative, top_topics, provider=provider
        )

        existing = db.query(CourseSummary).filter(CourseSummary.course_id == course_id).first()
        if existing:
            existing.positive_reviews = positive
            existing.neutral_reviews = neutral
            existing.negative_reviews = negative
            existing.overall_score = overall
            existing.generated_summary = summary_text
            existing.updated_at = datetime.utcnow()
        else:
            db.add(
                CourseSummary(
                    course_id=course_id,
                    positive_reviews=positive,
                    neutral_reviews=neutral,
                    negative_reviews=negative,
                    overall_score=overall,
                    generated_summary=summary_text,
                    updated_at=datetime.utcnow(),
                )
            )

        return {
            "course_id": course_id,
            "summary": summary_text,
            "source": source,
            "requested_provider": provider or "default",
            "model": ml_service._model_for_source(source),
            "fallback_error": fallback_error,
        }


class ReviewService:
    def __init__(self) -> None:
        self.course_service = CourseService()

    def list_reviews(
        self,
        db: Session,
        course_id: UUID,
        university_id: UUID | None = None,
        semester: str | None = None,
        professor: str | None = None,
        sentiment: str | None = None,
    ) -> list[dict]:
        q = (
            db.query(Review)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .join(Course, Course.course_id == CourseOffering.course_id)
            .join(CourseOffering.professor)
            .outerjoin(SentimentAnalysis, SentimentAnalysis.review_id == Review.review_id)
            .options(
                joinedload(Review.topics),
                joinedload(Review.sentiment),
                joinedload(Review.offering).joinedload(CourseOffering.professor),
            )
            .filter(CourseOffering.course_id == course_id)
        )
        if university_id:
            q = q.filter(Course.university_id == university_id)

        if semester:
            q = q.filter(CourseOffering.semester.ilike(f"%{semester.strip()}%"))
        if professor:
            q = q.join(Professor).filter(Professor.professor_name.ilike(f"%{professor.strip()}%"))
        if sentiment:
            q = q.filter(SentimentAnalysis.sentiment == sentiment.lower())

        reviews = q.order_by(Review.created_at.desc()).all()
        results = []
        for review in reviews:
            results.append(
                {
                    "review_id": review.review_id,
                    "offering_id": review.offering_id,
                    "rating": review.rating,
                    "review_text": review.review_text,
                    "created_at": review.created_at,
                    "sentiment": review.sentiment.sentiment if review.sentiment else None,
                    "professor_name": review.offering.professor.professor_name,
                    "semester": review.offering.semester,
                    "year": review.offering.year,
                    "topics": [topic.topic_name for topic in review.topics],
                }
            )
        return results

    def create_review(
        self,
        db: Session,
        offering_id: UUID,
        rating: int,
        review_text: str,
        user_id: UUID | None = None,
    ) -> Review:
        offering = (
            db.query(CourseOffering)
            .options(joinedload(CourseOffering.course).joinedload(Course.university))
            .filter(CourseOffering.offering_id == offering_id)
            .first()
        )
        if not offering:
            raise ValueError("Offering not found")

        review = Review(
            offering_id=offering_id,
            rating=rating,
            review_text=review_text,
            user_id=user_id,
        )
        db.add(review)
        db.flush()

        sentiment_result, topics = ml_service.process_live_review(review_text)
        db.add(
            SentimentAnalysis(
                review_id=review.review_id,
                sentiment=sentiment_result.sentiment,
                confidence_score=sentiment_result.confidence,
            )
        )

        for topic in topics:
            db.add(TopicAnalysis(review_id=review.review_id, topic_name=topic))

        self.course_service.refresh_course_summary(db, offering.course_id)
        db.commit()
        db.refresh(review)

        if settings.enable_bigquery:
            self._sync_bigquery(review, offering, sentiment_result.sentiment)

        return review

    def _sync_bigquery(self, review: Review, offering: CourseOffering, sentiment: str) -> None:
        try:
            from app.services.bigquery_service import insert_review_row

            topics = [topic.topic_name for topic in review.topics]
            university = offering.course.university if offering.course else None
            insert_review_row(
                review_id=str(review.review_id),
                course_id=str(offering.course_id),
                university_id=str(university.university_id) if university else "",
                university_name=university.name if university else "",
                semester=f"{offering.semester} {offering.year}",
                sentiment=sentiment,
                topics=topics,
                rating=review.rating,
                timestamp=review.created_at,
            )
        except Exception as exc:
            logger.warning("BigQuery sync skipped/failed: %s", exc)


course_service = CourseService()
review_service = ReviewService()
