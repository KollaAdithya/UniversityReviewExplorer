#!/usr/bin/env python3
"""Import a public RMP-style subset CSV into the multi-university database."""

from __future__ import annotations

import csv
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.db.models import Course, CourseOffering, Professor, Review, SentimentAnalysis, TopicAnalysis, University  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.course_service import course_service  # noqa: E402
from app.services.university_service import slugify, university_service  # noqa: E402
from app.services import ml_service  # noqa: E402


def parse_date(value: str) -> datetime:
    value = value.strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return datetime.utcnow()


def parse_rating(value: str) -> int:
    try:
        rating = int(float(value))
    except (TypeError, ValueError):
        rating = 3
    return max(1, min(5, rating))


def parse_tags(value: str) -> list[str]:
    if not value or not value.strip():
        return []
    return [tag.strip() for tag in re.split(r"[|,]", value) if tag.strip()][:3]


def load_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def import_subset(csv_path: Path) -> None:
    rows = load_rows(csv_path)
    db = SessionLocal()

    try:
        existing = db.query(University).count()
        if existing > 0:
            print("Universities already imported; skipping.")
            return

        university_cache: dict[str, University] = {}
        professor_cache: dict[tuple[str, str], Professor] = {}
        course_cache: dict[tuple[str, str], Course] = {}
        offering_cache: dict[tuple[str, str, str, int], CourseOffering] = {}
        course_ids_for_summary: set = set()

        for row in rows:
            school = row["school"].strip()
            if school not in university_cache:
                university_cache[school] = university_service.get_or_create_university(db, school)
            university = university_cache[school]

            professor_name = f"{row['first_name'].strip()} {row['last_name'].strip()}"
            prof_key = (school, professor_name)
            if prof_key not in professor_cache:
                slug = slugify(school)
                email_slug = slugify(professor_name).replace("-", ".")
                professor = Professor(
                    university_id=university.university_id,
                    professor_name=professor_name,
                    email=f"{email_slug}@{slug}.edu",
                )
                db.add(professor)
                db.flush()
                professor_cache[prof_key] = professor

            course_code = row["class"].strip().upper()
            course_key = (school, course_code)
            if course_key not in course_cache:
                department = row.get("department", course_code[:2]).strip() or "GEN"
                course_name = row.get("course_name", f"{course_code} Course").strip()
                course = Course(
                    university_id=university.university_id,
                    course_code=course_code,
                    course_name=course_name,
                    department=department,
                    credits=3,
                )
                db.add(course)
                db.flush()
                course_cache[course_key] = course

            course = course_cache[course_key]
            professor = professor_cache[prof_key]
            created_at = parse_date(row.get("date", ""))
            semester = "Fall" if created_at.month >= 8 else "Spring"
            offering_key = (school, course_code, professor_name, created_at.year)
            if offering_key not in offering_cache:
                offering = CourseOffering(
                    course_id=course.course_id,
                    professor_id=professor.professor_id,
                    semester=semester,
                    year=created_at.year,
                )
                db.add(offering)
                db.flush()
                offering_cache[offering_key] = offering

            offering = offering_cache[offering_key]
            review_text = row["comment"].strip()
            rating = parse_rating(row.get("quality", "3"))

            review = Review(
                offering_id=offering.offering_id,
                review_text=review_text,
                rating=rating,
                created_at=created_at,
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

            tags = parse_tags(row.get("tags", ""))
            if not tags:
                tags = ml_service.extract_topics(review_text)
            for tag in tags:
                db.add(TopicAnalysis(review_id=review.review_id, topic_name=tag))

            course_ids_for_summary.add(course.course_id)

        db.commit()

        for course_id in course_ids_for_summary:
            course_service.refresh_course_summary(db, course_id)
        db.commit()

        print(
            f"Imported {len(university_cache)} universities, "
            f"{len(course_cache)} courses, {len(rows)} reviews."
        )
    finally:
        db.close()


if __name__ == "__main__":
    csv_file = ROOT / "data" / "rmp_subset.csv"
    if not csv_file.exists():
        raise SystemExit(f"Missing dataset: {csv_file}")
    import_subset(csv_file)
