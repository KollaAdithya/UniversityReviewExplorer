#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found. Run: ./scripts/install-gcp-tools.sh"
  exit 1
fi

"$ROOT/scripts/verify-gcp-prereqs.sh" || exit 1

# shellcheck source=gcp-config.sh
source "$ROOT/scripts/gcp-config.sh"

: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID (Firebase project ID)}"
: "${VITE_FIREBASE_API_KEY:?Set VITE_FIREBASE_API_KEY from Firebase Console → Project settings → Web app}"
: "${VITE_FIREBASE_AUTH_DOMAIN:?Set VITE_FIREBASE_AUTH_DOMAIN (e.g. my-project.firebaseapp.com)}"
: "${VITE_FIREBASE_PROJECT_ID:?Set VITE_FIREBASE_PROJECT_ID}"

FRONTEND_URL="https://storage.googleapis.com/${FRONTEND_BUCKET}/index.html"
# Browsers send Origin: https://storage.googleapis.com (not the full index.html path)
export CORS_ORIGINS="${CORS_ORIGINS:-https://storage.googleapis.com}"

echo "==> Step 1/4: GCP infrastructure setup"
"$ROOT/scripts/setup-gcp.sh"

echo ""
echo "==> Step 2/4: Deploy backend to Cloud Run"
"$ROOT/scripts/deploy-backend.sh"

export VITE_API_BASE_URL="${VITE_API_BASE_URL:-$(gcloud run services describe "$SERVICE_NAME" \
  --region "$GCP_REGION" --project "$GCP_PROJECT" \
  --format='value(status.url)')}"

echo ""
echo "==> Step 3/4: Deploy frontend to GCS"
"$ROOT/scripts/deploy-frontend.sh"

echo ""
echo "==> Step 4/4: Seed Cloud SQL with review data"
"$ROOT/scripts/seed-gcp-data.sh"

echo ""
echo "Deployment complete!"
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $VITE_API_BASE_URL"
echo "  Health:   $VITE_API_BASE_URL/health"
