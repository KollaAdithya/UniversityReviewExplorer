from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Course, CourseOffering, Professor, Review, TopicAnalysis, University


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "university"


class UniversityService:
    def list_universities(self, db: Session, query: str | None = None) -> list[dict]:
        q = db.query(University)
        if query:
            pattern = f"%{query.strip()}%"
            q = q.filter((University.name.ilike(pattern)) | (University.slug.ilike(pattern)))

        universities = q.order_by(University.name).all()
        results = []
        for university in universities:
            course_count = db.query(Course).filter(Course.university_id == university.university_id).count()
            review_count = (
                db.query(Review)
                .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
                .join(Course, Course.course_id == CourseOffering.course_id)
                .filter(Course.university_id == university.university_id)
                .count()
            )
            results.append(
                {
                    "university_id": university.university_id,
                    "name": university.name,
                    "slug": university.slug,
                    "country": university.country,
                    "course_count": course_count,
                    "review_count": review_count,
                }
            )
        return results

    def get_university(self, db: Session, university_id: UUID) -> dict | None:
        university = db.query(University).filter(University.university_id == university_id).first()
        if not university:
            return None
        items = self.list_universities(db)
        for item in items:
            if item["university_id"] == university.university_id:
                return item
        return None

    def get_or_create_university(self, db: Session, name: str, country: str = "USA") -> University:
        slug = slugify(name)
        existing = db.query(University).filter(University.slug == slug).first()
        if existing:
            return existing
        university = University(name=name, slug=slug, country=country)
        db.add(university)
        db.flush()
        return university

    def get_top_topics(self, db: Session, university_id: UUID, limit: int = 5) -> list[dict]:
        rows = (
            db.query(TopicAnalysis.topic_name, func.count(TopicAnalysis.topic_id))
            .join(Review, Review.review_id == TopicAnalysis.review_id)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .join(Course, Course.course_id == CourseOffering.course_id)
            .filter(Course.university_id == university_id)
            .group_by(TopicAnalysis.topic_name)
            .order_by(func.count(TopicAnalysis.topic_id).desc())
            .limit(limit)
            .all()
        )
        return [{"topic": topic, "count": count} for topic, count in rows]


university_service = UniversityService()
