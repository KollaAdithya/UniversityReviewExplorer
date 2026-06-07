#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcp-config.sh
source "$ROOT/scripts/gcp-config.sh"

: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID (your Firebase project ID)}"

# GCS-hosted frontend always sends Origin: https://storage.googleapis.com
# (sourcing backend/.env can accidentally set localhost-only CORS — always include prod origin)
export CORS_ORIGINS="${CORS_ORIGINS:-https://storage.googleapis.com}"
if [[ "$CORS_ORIGINS" != *"storage.googleapis.com"* ]]; then
  export CORS_ORIGINS="https://storage.googleapis.com,$CORS_ORIGINS"
fi

echo "==> Ensuring Artifact Registry repo exists…"
gcloud artifacts repositories describe "$AR_REPO" \
  --location="$GCP_REGION" --project="$GCP_PROJECT" >/dev/null 2>&1 || \
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$GCP_REGION" \
  --description="Course Review API images" \
  --project="$GCP_PROJECT"

echo "==> Building backend image → $IMAGE"
gcloud builds submit "$ROOT/backend" --tag "$IMAGE" --project "$GCP_PROJECT"

SECRET_ARGS="DATABASE_URL=${DATABASE_URL_SECRET}:latest"
if gcloud secrets describe groq-api-key --project "$GCP_PROJECT" >/dev/null 2>&1; then
  SECRET_ARGS+=",GROQ_API_KEY=groq-api-key:latest"
fi
if gcloud secrets describe openai-api-key --project "$GCP_PROJECT" >/dev/null 2>&1; then
  SECRET_ARGS+=",OPENAI_API_KEY=openai-api-key:latest"
fi

echo "==> Deploying to Cloud Run…"
# Use @ as delimiter so CORS_ORIGINS may contain commas (gcloud default delimiter)
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$GCP_REGION" \
  --allow-unauthenticated \
  --service-account "$RUN_SERVICE_ACCOUNT" \
  --add-cloudsql-instances "$CLOUDSQL_CONNECTION" \
  --set-secrets "$SECRET_ARGS" \
  --set-env-vars "^@^ENVIRONMENT=production@USE_MOCK_ML=false@ML_PROVIDER=groq@ENABLE_BIGQUERY=true@AUTH_REQUIRED=true@GCP_PROJECT=$GCP_PROJECT@GCP_REGION=$GCP_REGION@BIGQUERY_DATASET=$BIGQUERY_DATASET@BIGQUERY_TABLE=$BIGQUERY_TABLE@VERTEX_MODEL=gemini-2.0-flash@FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID@CORS_ORIGINS=$CORS_ORIGINS" \
  --project "$GCP_PROJECT"

API_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --region "$GCP_REGION" --project "$GCP_PROJECT" \
  --format='value(status.url)')"

echo ""
echo "Backend deployed: $API_URL"
echo "Health check:     $API_URL/health"
