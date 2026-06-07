#!/usr/bin/env python3
"""Quick local check for Gemini summaries (google-genai SDK).

Uses Vertex AI when GCP_PROJECT is set (run: gcloud auth application-default login).
Falls back to GEMINI_API_KEY from backend/.env if set.

  cd backend && source .venv/bin/activate
  pip install -r requirements.txt
  set -a && source ../infra/gcp.env && source .env && GCP_PROJECT from gcp.env && set +a
  python ../scripts/test_gemini_local.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services import gemini_ml_service  # noqa: E402
from app.config import settings  # noqa: E402


def main() -> int:
    print(f"GCP_PROJECT={settings.gcp_project or '(unset)'}")
    print(f"GEMINI_MODEL={settings.gemini_model}")
    print(f"available={gemini_ml_service.is_available()}")

    if not gemini_ml_service.is_available():
        print("Set GCP_PROJECT (Vertex) or GEMINI_API_KEY in backend/.env")
        return 1

    summary = gemini_ml_service.generate_summary(
        ["Great lectures but heavy workload.", "Fair grading, tough exams."],
        positive=1,
        neutral=1,
        negative=0,
        top_topics=["Workload", "Exams"],
    )
    print("\n--- summary ---")
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
