#!/usr/bin/env python3
"""Regenerate all course summaries using Ollama (requires ML_PROVIDER=ollama)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.db.models import Course  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services import ml_service, ollama_ml_service  # noqa: E402
from app.services.course_service import course_service  # noqa: E402


def main() -> int:
    status = ml_service.ollama_status()
    print("Ollama status:", status)
    if not status.get("enabled"):
        print("Set ML_PROVIDER=ollama in backend/.env")
        return 1
    if not ollama_ml_service.is_available():
        print("Start Ollama: ./scripts/start-ollama.sh")
        return 1

    db = SessionLocal()
    try:
        courses = db.query(Course).all()
        print(f"Refreshing summaries for {len(courses)} courses…")
        for i, course in enumerate(courses, 1):
            course_service.refresh_course_summary(db, course.course_id)
            db.commit()
            print(f"  [{i}/{len(courses)}] {course.course_code} — {course.course_name[:40]}")
        print("Done.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
