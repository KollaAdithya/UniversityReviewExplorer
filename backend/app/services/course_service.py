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
        topics = self._top_topics(db, course_id)

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
            "summary": generated_summary,
        }

    def _top_topics(self, db: Session, course_id: UUID, limit: int = 5) -> list[str]:
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
        return [topic for topic, _ in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]]

    def refresh_course_summary(self, db: Session, course_id: UUID) -> None:
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
        summary_text = ml_service.generate_summary(texts, positive, neutral, negative, top_topics)

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

        sentiment_result = ml_service.analyze_sentiment(review_text)
        db.add(
            SentimentAnalysis(
                review_id=review.review_id,
                sentiment=sentiment_result.sentiment,
                confidence_score=sentiment_result.confidence,
            )
        )

        for topic in ml_service.extract_topics(review_text):
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
