#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

USE_DOCKER=false
if command -v docker >/dev/null 2>&1; then
  USE_DOCKER=true
fi

if [ "$USE_DOCKER" = true ]; then
  echo "Starting Postgres via Docker..."
  docker compose up -d postgres
  echo "Waiting for Postgres..."
  until docker compose exec -T postgres pg_isready -U postgres -d course_reviews >/dev/null 2>&1; do
    sleep 1
  done
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/course_reviews"
else
  echo "Docker not found; using local SQLite database."
  export DATABASE_URL="sqlite:///$ROOT/backend/course_reviews.db"
  rm -f "$ROOT/backend/course_reviews.db"
fi

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$ROOT/backend/.venv"
fi

source "$ROOT/backend/.venv/bin/activate"
python -m pip install -q --upgrade pip
pip install -q -r "$ROOT/backend/requirements.txt"

if [ "$USE_DOCKER" = true ]; then
  cd "$ROOT/backend"
  alembic upgrade head
else
  FRESH_DB=1 python "$ROOT/scripts/init_db.py"
fi

cd "$ROOT"
python "$ROOT/scripts/import_rmp_subset.py"

echo
echo "Local setup complete."
echo "Database: ${DATABASE_URL}"
echo "Start backend:  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8080"
echo "Start frontend: cd frontend && npm install && npm run dev -- --port 5174"
