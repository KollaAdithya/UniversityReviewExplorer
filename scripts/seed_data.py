#!/usr/bin/env python3
"""Seed local database with sample courses for Demo Campus."""

from __future__ import annotations

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.db.models import Course, CourseOffering, Professor, University  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.course_service import review_service  # noqa: E402
from app.services.university_service import university_service  # noqa: E402


def load_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def seed() -> None:
    csv_path = ROOT / "data" / "sample_reviews.csv"
    rows = load_rows(csv_path)
    db = SessionLocal()

    try:
        if db.query(University).count() > 0:
            print("Database already seeded; skipping.")
            return

        university = university_service.get_or_create_university(db, "Demo Campus")
        db.commit()

        course_cache: dict[str, Course] = {}
        professor_cache: dict[str, Professor] = {}
        offering_cache: dict[tuple[str, str, str, str], CourseOffering] = {}

        for row in rows:
            course_key = row["course_code"]
            if course_key not in course_cache:
                course = Course(
                    university_id=university.university_id,
                    course_code=row["course_code"],
                    course_name=row["course_name"],
                    department=row["department"],
                    credits=int(row["credits"]),
                )
                db.add(course)
                db.flush()
                course_cache[course_key] = course

            prof_key = row["professor_email"]
            if prof_key not in professor_cache:
                professor = Professor(
                    university_id=university.university_id,
                    professor_name=row["professor_name"],
                    email=row["professor_email"],
                )
                db.add(professor)
                db.flush()
                professor_cache[prof_key] = professor

            offering_key = (
                row["course_code"],
                row["professor_email"],
                row["semester"],
                row["year"],
            )
            if offering_key not in offering_cache:
                offering = CourseOffering(
                    course_id=course_cache[row["course_code"]].course_id,
                    professor_id=professor_cache[row["professor_email"]].professor_id,
                    semester=row["semester"],
                    year=int(row["year"]),
                )
                db.add(offering)
                db.flush()
                offering_cache[offering_key] = offering

        db.commit()

        for row in rows:
            offering = offering_cache[
                (row["course_code"], row["professor_email"], row["semester"], row["year"])
            ]
            review_service.create_review(
                db,
                offering_id=offering.offering_id,
                rating=int(row["rating"]),
                review_text=row["review_text"],
            )

        print(f"Seeded Demo Campus with {len(course_cache)} courses and {len(rows)} reviews.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
