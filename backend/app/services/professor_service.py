from __future__ import annotations

from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    Course,
    CourseOffering,
    Professor,
    Review,
    SentimentAnalysis,
    TopicAnalysis,
)


class ProfessorService:
    def list_professors(self, db: Session, university_id: UUID, query: str | None = None) -> list[dict]:
        q = db.query(Professor).filter(Professor.university_id == university_id)
        if query:
            pattern = f"%{query.strip()}%"
            q = q.filter(Professor.professor_name.ilike(pattern))
        professors = q.order_by(Professor.professor_name).all()
        results = []
        for professor in professors:
            stats = self._professor_stats(db, professor.professor_id)
            if stats["review_count"] == 0:
                continue
            results.append(
                {
                    "professor_id": professor.professor_id,
                    "professor_name": professor.professor_name,
                    **stats,
                }
            )
        results.sort(key=lambda item: item["review_count"], reverse=True)
        return results

    def get_professor(self, db: Session, university_id: UUID, professor_id: UUID) -> dict | None:
        professor = (
            db.query(Professor)
            .filter(Professor.professor_id == professor_id, Professor.university_id == university_id)
            .first()
        )
        if not professor:
            return None
        stats = self._professor_stats(db, professor.professor_id)
        courses = (
            db.query(Course.course_code, Course.course_name, func.count(Review.review_id))
            .join(CourseOffering, CourseOffering.course_id == Course.course_id)
            .join(Review, Review.offering_id == CourseOffering.offering_id)
            .filter(CourseOffering.professor_id == professor_id)
            .group_by(Course.course_id, Course.course_code, Course.course_name)
            .order_by(func.count(Review.review_id).desc())
            .all()
        )
        return {
            "professor_id": professor.professor_id,
            "professor_name": professor.professor_name,
            "email": professor.email,
            **stats,
            "courses": [
                {"course_code": code, "course_name": name, "review_count": count}
                for code, name, count in courses
            ],
        }

    def _professor_stats(self, db: Session, professor_id: UUID) -> dict:
        reviews = (
            db.query(Review, SentimentAnalysis)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .outerjoin(SentimentAnalysis, SentimentAnalysis.review_id == Review.review_id)
            .filter(CourseOffering.professor_id == professor_id)
            .all()
        )
        if not reviews:
            return {
                "review_count": 0,
                "avg_rating": 0.0,
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "sentiment_score": 0.0,
                "top_topics": [],
            }

        positive = neutral = negative = 0
        rating_sum = 0
        for review, sentiment in reviews:
            rating_sum += review.rating
            label = sentiment.sentiment if sentiment else "neutral"
            if label == "positive":
                positive += 1
            elif label == "negative":
                negative += 1
            else:
                neutral += 1

        total = len(reviews)
        sentiment_score = (positive - negative) / total if total else 0.0

        topic_rows = (
            db.query(TopicAnalysis.topic_name, func.count(TopicAnalysis.topic_id))
            .join(Review, Review.review_id == TopicAnalysis.review_id)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .filter(CourseOffering.professor_id == professor_id)
            .group_by(TopicAnalysis.topic_name)
            .order_by(func.count(TopicAnalysis.topic_id).desc())
            .limit(5)
            .all()
        )

        return {
            "review_count": total,
            "avg_rating": round(rating_sum / total, 2),
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "sentiment_score": round(sentiment_score, 3),
            "top_topics": [{"topic": topic, "count": count} for topic, count in topic_rows],
        }


professor_service = ProfessorService()
