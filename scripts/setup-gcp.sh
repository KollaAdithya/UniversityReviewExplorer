#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${GCP_PROJECT:?Set GCP_PROJECT}"
: "${GCP_REGION:=us-central1}"

echo "Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  aiplatform.googleapis.com \
  bigquery.googleapis.com \
  apigateway.googleapis.com \
  storage.googleapis.com \
  --project "$GCP_PROJECT"

echo "Creating BigQuery dataset and table..."
bq --project_id="$GCP_PROJECT" mk --dataset --location=US "${BIGQUERY_DATASET:-course_reviews_dataset}" 2>/dev/null || true
bq query --project_id="$GCP_PROJECT" --use_legacy_sql=false < "$ROOT/infra/bigquery/schema.sql"

echo "Setup complete. Configure Cloud SQL manually or via gcloud sql instances create."
