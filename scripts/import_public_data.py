#!/usr/bin/env python3
"""Import real public RMP / Mendeley-style CSV data (no synthetic rows)."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.db.models import (  # noqa: E402
    Course,
    CourseOffering,
    CourseSummary,
    Professor,
    Review,
    SentimentAnalysis,
    TopicAnalysis,
    University,
)
from app.db.session import SessionLocal  # noqa: E402
from app.services import ml_service  # noqa: E402
from app.services.course_service import course_service  # noqa: E402
from app.services.university_service import slugify, university_service  # noqa: E402

DEFAULT_CSV = ROOT / "data" / "rmp_public.csv"

# Mendeley / liumingchun RMP export columns
RMP_PUBLIC_FIELDS = {
    "school": ("school_name", "school", "School name", "School Name"),
    "professor": ("professor_name", "Professor Name"),
    "department": ("department_name", "department", "Department"),
    "course_code": ("name_not_onlines", "class", "Class", "course_code"),
    "comment": ("comments", "comment", "Comment"),
    "quality": ("student_star", "quality", "Student star", "rating"),
    "date": ("post_date", "date", "Post date"),
    "tags": ("tag_professor", "tags", "Tags"),
}

# vxuv GitHub export
VXUV_FIELDS = {
    "school": ("title",),  # parsed from "Professor in X at SCHOOL"
    "first_name": ("first_name",),
    "last_name": ("last_name",),
    "department": (),
    "course_code": ("class",),
    "comment": ("comment",),
    "quality": ("quality",),
    "date": ("date",),
    "tags": ("tags",),
}

# Legacy app subset (deprecated synthetic file)
LEGACY_FIELDS = {
    "school": ("school",),
    "first_name": ("first_name",),
    "last_name": ("last_name",),
    "department": ("department",),
    "course_code": ("class",),
    "course_name": ("course_name",),
    "comment": ("comment",),
    "quality": ("quality",),
    "date": ("date",),
    "tags": ("tags",),
}


def pick(row: dict[str, str], aliases: tuple[str, ...]) -> str:
    for key in aliases:
        if key in row and row[key] and str(row[key]).strip():
            return str(row[key]).strip()
    return ""


def detect_format(fieldnames: list[str] | None) -> str:
    if not fieldnames:
        return "unknown"
    cols = {c.strip() for c in fieldnames}
    if "school_name" in cols and "professor_name" in cols:
        return "rmp_public"
    if "first_name" in cols and "title" in cols and "comment" in cols:
        return "vxuv"
    if "school" in cols and "first_name" in cols and "comment" in cols:
        return "legacy"
    return "unknown"


def parse_school_from_title(title: str) -> str:
    match = re.search(r"\bat\s+(.+)$", title, re.IGNORECASE)
    return match.group(1).strip() if match else "Unknown University"


def parse_department_from_title(title: str) -> str:
    match = re.search(r"in the\s+(.+?)\s+department", title, re.IGNORECASE)
    return match.group(1).strip() if match else "GEN"


def split_professor(full_name: str) -> tuple[str, str]:
    parts = re.split(r"\s+", full_name.strip())
    if len(parts) >= 2:
        return parts[0], " ".join(parts[1:])
    return full_name or "Unknown", "Professor"


def parse_date(value: str) -> datetime:
    value = (value or "").strip()
    for fmt in (
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%m/%d/%y",
        "%b %d, %Y",
        "%B %d, %Y",
        "%b %d %Y",
    ):
        try:
            return datetime.strptime(value.replace("st", "").replace("nd", "").replace("rd", "").replace("th", ""), fmt)
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
    if not value or not str(value).strip():
        return []
    cleaned = str(value).replace("[", "").replace("]", "").replace("'", "")
    parts = re.split(r"[|,]", cleaned)
    tags = []
    for part in parts:
        tag = re.sub(r"\s*\(\d+\)\s*", "", part).strip()
        if tag and len(tag) <= 50:
            tags.append(tag[:50])
    return tags[:3]


def normalize_row(row: dict[str, str], fmt: str) -> dict[str, str] | None:
    if fmt == "rmp_public":
        school = pick(row, RMP_PUBLIC_FIELDS["school"])
        prof_full = pick(row, RMP_PUBLIC_FIELDS["professor"])
        first, last = split_professor(prof_full)
        dept = pick(row, RMP_PUBLIC_FIELDS["department"]) or "General"
        course_code = pick(row, RMP_PUBLIC_FIELDS["course_code"]).upper() or "GEN101"
        comment = pick(row, RMP_PUBLIC_FIELDS["comment"])
        if not school or not comment or len(comment) < 10:
            return None
        return {
            "school": school,
            "first_name": first,
            "last_name": last,
            "department": dept[:50],
            "course_code": course_code[:20],
            "course_name": f"{course_code} — {dept}",
            "comment": comment,
            "quality": pick(row, RMP_PUBLIC_FIELDS["quality"]) or "3",
            "date": pick(row, RMP_PUBLIC_FIELDS["date"]),
            "tags": pick(row, RMP_PUBLIC_FIELDS["tags"]),
        }

    if fmt == "vxuv":
        title = pick(row, VXUV_FIELDS["school"])
        school = parse_school_from_title(title)
        dept = parse_department_from_title(title)
        first = pick(row, VXUV_FIELDS["first_name"])
        last = pick(row, VXUV_FIELDS["last_name"])
        course_code = pick(row, VXUV_FIELDS["course_code"]).upper() or "GEN101"
        comment = pick(row, VXUV_FIELDS["comment"])
        if not comment or len(comment) < 10:
            return None
        return {
            "school": school,
            "first_name": first,
            "last_name": last,
            "department": dept[:50],
            "course_code": course_code[:20],
            "course_name": f"{course_code} — {dept}",
            "comment": comment,
            "quality": pick(row, VXUV_FIELDS["quality"]) or "3",
            "date": pick(row, VXUV_FIELDS["date"]),
            "tags": pick(row, VXUV_FIELDS["tags"]),
        }

    if fmt == "legacy":
        school = pick(row, LEGACY_FIELDS["school"])
        comment = pick(row, LEGACY_FIELDS["comment"])
        if not school or not comment:
            return None
        return {
            "school": school,
            "first_name": pick(row, LEGACY_FIELDS["first_name"]),
            "last_name": pick(row, LEGACY_FIELDS["last_name"]),
            "department": pick(row, LEGACY_FIELDS["department"]) or "GEN",
            "course_code": pick(row, LEGACY_FIELDS["course_code"]).upper(),
            "course_name": pick(row, LEGACY_FIELDS["course_name"]) or pick(row, LEGACY_FIELDS["course_code"]),
            "comment": comment,
            "quality": pick(row, LEGACY_FIELDS["quality"]) or "3",
            "date": pick(row, LEGACY_FIELDS["date"]),
            "tags": pick(row, LEGACY_FIELDS["tags"]),
        }

    return None


def clear_all(db) -> None:
    db.query(TopicAnalysis).delete()
    db.query(SentimentAnalysis).delete()
    db.query(Review).delete()
    db.query(CourseSummary).delete()
    db.query(CourseOffering).delete()
    db.query(Course).delete()
    db.query(Professor).delete()
    db.query(University).delete()
    db.commit()
    print("Cleared existing universities, courses, and reviews.")


def import_csv(csv_path: Path, force: bool = False, max_rows: int | None = None) -> None:
    with csv_path.open(newline="", encoding="utf-8", errors="replace") as handle:
        reader = csv.DictReader(handle)
        fmt = detect_format(reader.fieldnames)
        if fmt == "unknown":
            raise SystemExit(f"Unrecognized CSV columns: {reader.fieldnames}")

        print(f"Detected format: {fmt}")
        rows_raw = list(reader)

    if max_rows:
        rows_raw = rows_raw[:max_rows]

    db = SessionLocal()
    try:
        if db.query(University).count() > 0:
            if force:
                clear_all(db)
            else:
                print("Data already loaded. Use --force to reimport.")
                return

        university_cache: dict[str, University] = {}
        professor_cache: dict[tuple[str, str], Professor] = {}
        course_cache: dict[tuple[str, str], Course] = {}
        offering_cache: dict[tuple[str, str, str, int], CourseOffering] = {}
        course_ids_for_summary: set = set()
        imported = 0
        skipped = 0

        for raw in rows_raw:
            norm = normalize_row(raw, fmt)
            if not norm:
                skipped += 1
                continue

            school = norm["school"]
            if school not in university_cache:
                university_cache[school] = university_service.get_or_create_university(db, school)
            university = university_cache[school]

            professor_name = f"{norm['first_name']} {norm['last_name']}".strip()
            prof_key = (school, professor_name)
            if prof_key not in professor_cache:
                slug = slugify(school)
                email_slug = slugify(professor_name).replace("-", ".")[:40]
                professor = Professor(
                    university_id=university.university_id,
                    professor_name=professor_name,
                    email=f"{email_slug}@{slug}.edu",
                )
                db.add(professor)
                db.flush()
                professor_cache[prof_key] = professor

            course_code = norm["course_code"]
            course_key = (school, course_code)
            if course_key not in course_cache:
                course = Course(
                    university_id=university.university_id,
                    course_code=course_code,
                    course_name=(norm["course_name"] or course_code)[:100],
                    department=norm["department"][:50],
                    credits=3,
                )
                db.add(course)
                db.flush()
                course_cache[course_key] = course

            course = course_cache[course_key]
            professor = professor_cache[prof_key]
            created_at = parse_date(norm["date"])
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
            review_text = norm["comment"]
            rating = parse_rating(norm["quality"])

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

            tags = parse_tags(norm["tags"])
            if not tags:
                tags = ml_service.extract_topics(review_text)
            for tag in tags:
                db.add(TopicAnalysis(review_id=review.review_id, topic_name=tag))

            course_ids_for_summary.add(course.course_id)
            imported += 1

            if imported % 500 == 0:
                db.commit()
                print(f"  ... {imported} reviews imported")

        db.commit()

        for course_id in course_ids_for_summary:
            course_service.refresh_course_summary(db, course_id)
        db.commit()

        print(
            f"Imported {imported} real reviews from {csv_path.name} "
            f"({len(university_cache)} universities, {len(course_cache)} courses, {skipped} skipped)."
        )
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import public RMP/Mendeley CSV data")
    parser.add_argument("--file", type=Path, default=DEFAULT_CSV, help="CSV file path")
    parser.add_argument("--force", action="store_true", help="Replace existing data")
    parser.add_argument("--max-rows", type=int, default=None, help="Limit rows (large Mendeley files)")
    args = parser.parse_args()

    if not args.file.exists():
        print(f"Missing {args.file}. Run: python scripts/download_public_data.py")
        sys.exit(1)

    import_csv(args.file, force=args.force, max_rows=args.max_rows)


if __name__ == "__main__":
    main()
