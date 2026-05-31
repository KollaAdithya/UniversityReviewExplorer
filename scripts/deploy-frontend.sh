#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${GCP_PROJECT:?Set GCP_PROJECT}"
: "${VITE_API_BASE_URL:?Set VITE_API_BASE_URL to API Gateway or Cloud Run URL}"
BUCKET="${FRONTEND_BUCKET:-course-review-frontend-$GCP_PROJECT}"

cd frontend
npm install
npm run build

gsutil mb -p "$GCP_PROJECT" "gs://$BUCKET" 2>/dev/null || true
gsutil -m rsync -r dist "gs://$BUCKET"
gsutil web set -m index.html -e index.html "gs://$BUCKET"
gsutil cors set "$ROOT/infra/cors.json" "gs://$BUCKET" 2>/dev/null || true

echo "Frontend deployed to gs://$BUCKET"
