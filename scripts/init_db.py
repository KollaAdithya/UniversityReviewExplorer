#!/usr/bin/env python3
"""Create or recreate database tables for local development."""

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from app.db.base import Base  # noqa: E402
from app.db import models  # noqa: F401
from app.db.session import engine  # noqa: E402


def init_db(recreate: bool = False) -> None:
    if recreate:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")


if __name__ == "__main__":
    import os

    init_db(recreate=os.environ.get("FRESH_DB", "1") == "1")
