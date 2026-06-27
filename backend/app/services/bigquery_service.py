import logging
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)


def insert_review_row(
    review_id: str,
    course_id: str,
    semester: str,
    sentiment: str,
    topics: list[str],
    rating: int,
    timestamp: datetime,
    university_id: str = "",
    university_name: str = "",
) -> None:
    if not settings.enable_bigquery:
        logger.debug("BigQuery disabled; skipping insert for review %s", review_id)
        return

    from google.cloud import bigquery

    client = bigquery.Client(project=settings.gcp_project or None)
    table_id = f"{settings.gcp_project}.{settings.bigquery_dataset}.{settings.bigquery_table}"
    row = {
        "review_id": review_id,
        "course_id": course_id,
        "university_id": university_id,
        "university_name": university_name,
        "semester": semester,
        "sentiment": sentiment,
        "topic": ", ".join(topics),
        "rating": rating,
        "timestamp": timestamp.isoformat(),
    }
    errors = client.insert_rows_json(table_id, [row])
    if errors:
        raise RuntimeError(f"BigQuery insert failed: {errors}")


def count_analytics_rows() -> int:
    if not settings.enable_bigquery or not settings.gcp_project:
        return 0

    from google.cloud import bigquery

    client = bigquery.Client(project=settings.gcp_project)
    table_id = f"{settings.gcp_project}.{settings.bigquery_dataset}.{settings.bigquery_table}"
    rows = list(client.query(f"SELECT COUNT(*) AS cnt FROM `{table_id}`").result())
    return int(rows[0]["cnt"]) if rows else 0
