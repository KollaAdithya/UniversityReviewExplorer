from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import Course, CourseOffering, ImportRun, Review, SentimentAnalysis, TopicAnalysis, University

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CSV = ROOT / "data" / "rmp_public.csv"


class DataService:
    def get_catalog(self, db: Session) -> dict:
        university_count = db.query(University).count()
        course_count = db.query(Course).count()
        review_count = db.query(Review).count()

        csv_path = DEFAULT_CSV
        csv_exists = csv_path.exists()
        csv_size_bytes = csv_path.stat().st_size if csv_exists else 0
        csv_modified_at = (
            datetime.utcfromtimestamp(csv_path.stat().st_mtime).isoformat() + "Z" if csv_exists else None
        )

        last_run = db.query(ImportRun).order_by(ImportRun.started_at.desc()).first()

        return {
            "datasets": [
                {
                    "id": "rmp_sample",
                    "name": "Rate My Professors sample (research export)",
                    "source_url": "https://github.com/liumingchun/RateMyProfessor/blob/master/RMP_sample_data.csv",
                    "license": "Academic/research use; cite repository and original RMP terms",
                    "coverage": "~46 US colleges/universities, real professor names, course codes, comments, ratings",
                    "local_path": "data/rmp_public.csv",
                    "download_command": "python scripts/download_public_data.py",
                    "import_command": "python scripts/import_public_data.py --file data/rmp_public.csv --force",
                    "file_exists": csv_exists,
                    "file_size_bytes": csv_size_bytes,
                    "file_modified_at": csv_modified_at,
                },
                {
                    "id": "mendeley_large",
                    "name": "Big Data Set from RateMyProfessor.com (He, 2020)",
                    "source_url": "https://data.mendeley.com/datasets/fvtfjyvw7d/2",
                    "license": "CC BY 4.0",
                    "coverage": "~9.5M comment rows (optional large import)",
                    "local_path": "data/your_mendeley_export.csv",
                    "download_command": "Manual download from Mendeley",
                    "import_command": "python scripts/import_public_data.py --file data/your_mendeley_export.csv --force --max-rows 50000",
                    "file_exists": False,
                    "file_size_bytes": 0,
                    "file_modified_at": None,
                },
            ],
            "database": {
                "university_count": university_count,
                "course_count": course_count,
                "review_count": review_count,
            },
            "last_import": self._serialize_run(last_run) if last_run else None,
        }

    def list_import_runs(self, db: Session, limit: int = 20) -> list[dict]:
        runs = db.query(ImportRun).order_by(ImportRun.started_at.desc()).limit(limit).all()
        return [self._serialize_run(run) for run in runs]

    def record_import_run(
        self,
        db: Session,
        *,
        source_file: str,
        status: str,
        rows_imported: int = 0,
        rows_skipped: int = 0,
        universities_created: int = 0,
        error_message: str | None = None,
        triggered_by: str | None = None,
        finished_at: datetime | None = None,
        leave_open: bool = False,
    ) -> dict:
        run = ImportRun(
            source_file=source_file,
            status=status,
            rows_imported=rows_imported,
            rows_skipped=rows_skipped,
            universities_created=universities_created,
            error_message=error_message,
            triggered_by=triggered_by,
            finished_at=None if leave_open else (finished_at or datetime.utcnow()),
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return self._serialize_run(run)

    def ensure_seed_import_run(self, db: Session) -> None:
        if db.query(ImportRun).count() > 0:
            return
        review_count = db.query(Review).count()
        if review_count == 0:
            return
        uni_count = db.query(University).count()
        self.record_import_run(
            db,
            source_file=str(DEFAULT_CSV.relative_to(ROOT)) if DEFAULT_CSV.exists() else "data/rmp_public.csv",
            status="completed",
            rows_imported=review_count,
            rows_skipped=0,
            universities_created=uni_count,
            triggered_by="system:seed",
        )

    def get_bigquery_dashboard(self, db: Session) -> dict:
        table_id = (
            f"{settings.gcp_project}.{settings.bigquery_dataset}.{settings.bigquery_table}"
            if settings.gcp_project
            else f"{settings.bigquery_dataset}.{settings.bigquery_table}"
        )

        sentiment_rows = (
            db.query(
                University.name,
                SentimentAnalysis.sentiment,
                func.count(SentimentAnalysis.review_id),
            )
            .join(Review, Review.review_id == SentimentAnalysis.review_id)
            .join(CourseOffering, CourseOffering.offering_id == Review.offering_id)
            .join(Course, Course.course_id == CourseOffering.course_id)
            .join(University, University.university_id == Course.university_id)
            .group_by(University.university_id, University.name, SentimentAnalysis.sentiment)
            .all()
        )

        by_university: dict[str, dict] = {}
        for name, sentiment, count in sentiment_rows:
            bucket = by_university.setdefault(
                name,
                {"university_name": name, "positive": 0, "neutral": 0, "negative": 0, "total": 0},
            )
            if sentiment == "positive":
                bucket["positive"] += count
            elif sentiment == "negative":
                bucket["negative"] += count
            else:
                bucket["neutral"] += count
            bucket["total"] += count

        sentiment_by_university = []
        for item in by_university.values():
            total = item["total"] or 1
            item["positive_pct"] = round(item["positive"] * 100 / total, 1)
            item["sentiment_score"] = round((item["positive"] - item["negative"]) / total, 3)
            sentiment_by_university.append(item)
        sentiment_by_university.sort(key=lambda row: row["sentiment_score"], reverse=True)

        global_topics = (
            db.query(TopicAnalysis.topic_name, func.count(TopicAnalysis.topic_id))
            .group_by(TopicAnalysis.topic_name)
            .order_by(func.count(TopicAnalysis.topic_id).desc())
            .limit(10)
            .all()
        )

        bq_row_count = None
        bq_error = None
        if settings.enable_bigquery and settings.gcp_project:
            try:
                from app.services.bigquery_service import count_analytics_rows

                bq_row_count = count_analytics_rows()
            except Exception as exc:
                bq_error = str(exc)

        return {
            "enabled": settings.enable_bigquery,
            "table_id": table_id,
            "source": "bigquery" if bq_row_count is not None else "cloud_sql_mirror",
            "row_count": bq_row_count if bq_row_count is not None else db.query(Review).count(),
            "bq_error": bq_error,
            "sentiment_by_university": sentiment_by_university[:12],
            "global_top_topics": [{"topic": topic, "count": count} for topic, count in global_topics],
            "sync_trigger": "POST /api/v1/reviews (when ENABLE_BIGQUERY=true)",
        }

    def _serialize_run(self, run: ImportRun) -> dict:
        return {
            "run_id": run.run_id,
            "source_file": run.source_file,
            "status": run.status,
            "rows_imported": run.rows_imported,
            "rows_skipped": run.rows_skipped,
            "universities_created": run.universities_created,
            "error_message": run.error_message,
            "triggered_by": run.triggered_by,
            "started_at": run.started_at.isoformat() + "Z",
            "finished_at": run.finished_at.isoformat() + "Z" if run.finished_at else None,
        }


data_service = DataService()
