from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import require_auth
from app.db.models import AppUser, ImportRun, Review, University
from app.db.session import get_db
from app.schemas import (
    BigQueryDashboardResponse,
    DataCatalogResponse,
    ImportRunCreateRequest,
    ImportRunResponse,
)
from app.services.data_service import data_service

router = APIRouter(prefix="/api/v1/data", tags=["data"])

ROOT = Path(__file__).resolve().parents[3]


@router.get("/catalog", response_model=DataCatalogResponse)
def get_data_catalog(db: Session = Depends(get_db)):
    data_service.ensure_seed_import_run(db)
    return data_service.get_catalog(db)


@router.get("/bigquery-dashboard", response_model=BigQueryDashboardResponse)
def get_bigquery_dashboard(db: Session = Depends(get_db)):
    return data_service.get_bigquery_dashboard(db)


@router.get("/import-runs", response_model=list[ImportRunResponse])
def list_import_runs(db: Session = Depends(get_db)):
    data_service.ensure_seed_import_run(db)
    return data_service.list_import_runs(db)


@router.post("/import-runs/record", response_model=ImportRunResponse)
def record_import_snapshot(
    payload: ImportRunCreateRequest,
    db: Session = Depends(get_db),
    user: AppUser = Depends(require_auth),
):
    return data_service.record_import_run(
        db,
        source_file=payload.source_file,
        status="completed",
        rows_imported=db.query(Review).count(),
        rows_skipped=0,
        universities_created=db.query(University).count(),
        triggered_by=user.email,
    )


def _parse_import_output(output: str) -> tuple[int, int]:
    imported = 0
    skipped = 0
    for line in output.splitlines():
        if line.startswith("Imported ") and "reviews" in line:
            parts = line.replace("(", " ").replace(")", " ").split()
            try:
                imported = int(parts[1])
            except (IndexError, ValueError):
                pass
            if "skipped" in line:
                try:
                    skipped = int(parts[parts.index("skipped") - 1])
                except (IndexError, ValueError):
                    pass
    return imported, skipped


def _finish_run(db: Session, run_id: UUID, status: str, error: str | None = None, imported: int = 0, skipped: int = 0):
    run = db.query(ImportRun).filter(ImportRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=500, detail="Import run record missing")
    run.status = status
    run.rows_imported = imported
    run.rows_skipped = skipped
    run.error_message = error
    run.finished_at = datetime.utcnow()
    db.commit()
    db.refresh(run)
    return data_service._serialize_run(run)


@router.post("/import-runs/trigger", response_model=ImportRunResponse)
def trigger_import(
    db: Session = Depends(get_db),
    user: AppUser = Depends(require_auth),
):
    script = ROOT / "scripts" / "import_public_data.py"
    csv_path = ROOT / "data" / "rmp_public.csv"
    if not script.exists() or not csv_path.exists():
        raise HTTPException(status_code=400, detail="Import script or CSV file not found on server")

    run_data = data_service.record_import_run(
        db,
        source_file="data/rmp_public.csv",
        status="running",
        triggered_by=user.email,
        leave_open=True,
    )
    run_id = run_data["run_id"]

    try:
        result = subprocess.run(
            [sys.executable, str(script), "--file", str(csv_path), "--max-rows", "100"],
            capture_output=True,
            text=True,
            cwd=str(ROOT),
            timeout=120,
        )
        output = (result.stdout or "") + (result.stderr or "")
        if result.returncode != 0 and "already loaded" in output.lower():
            return _finish_run(db, run_id, "skipped", "Data already loaded. Use CLI with --force to reimport.")
        if result.returncode != 0:
            return _finish_run(db, run_id, "failed", output[-500:] or f"Exit code {result.returncode}")
        imported, skipped = _parse_import_output(output)
        return _finish_run(db, run_id, "completed", imported=imported, skipped=skipped)
    except subprocess.TimeoutExpired:
        return _finish_run(db, run_id, "failed", "Import timed out after 120s")
