#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

: "${GCP_PROJECT:?Set GCP_PROJECT}"
: "${GCP_REGION:=us-central1}"
SERVICE_NAME="${SERVICE_NAME:-course-review-api}"

gcloud builds submit "$ROOT/backend" --tag "gcr.io/$GCP_PROJECT/$SERVICE_NAME" --project "$GCP_PROJECT"

gcloud run deploy "$SERVICE_NAME" \
  --image "gcr.io/$GCP_PROJECT/$SERVICE_NAME" \
  --platform managed \
  --region "$GCP_REGION" \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT=$GCP_PROJECT,GCP_REGION=$GCP_REGION,USE_MOCK_ML=false,ENABLE_BIGQUERY=true" \
  --project "$GCP_PROJECT"

echo "Backend deployed."
