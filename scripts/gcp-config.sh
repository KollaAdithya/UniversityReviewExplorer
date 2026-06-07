#!/usr/bin/env bash
# Shared GCP deployment variables. Source from other scripts:
#   source "$(dirname "$0")/gcp-config.sh"

_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=gcp-path.sh
source "$_SCRIPT_DIR/gcp-path.sh"

: "${GCP_PROJECT:?Set GCP_PROJECT to your Google Cloud project ID}"

export GCP_REGION="${GCP_REGION:-us-central1}"
export SERVICE_NAME="${SERVICE_NAME:-course-review-api}"
export AR_REPO="${AR_REPO:-course-review}"
export IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${AR_REPO}/${SERVICE_NAME}"
export SQL_INSTANCE="${SQL_INSTANCE:-course-review-db}"
export SQL_DATABASE="${SQL_DATABASE:-course_reviews}"
export SQL_USER="${SQL_USER:-appuser}"
export FRONTEND_BUCKET="${FRONTEND_BUCKET:-course-review-frontend-${GCP_PROJECT}}"
export BIGQUERY_DATASET="${BIGQUERY_DATASET:-course_reviews_dataset}"
export BIGQUERY_TABLE="${BIGQUERY_TABLE:-reviews_analytics}"
export RUN_SERVICE_ACCOUNT="${RUN_SERVICE_ACCOUNT:-course-review-run@${GCP_PROJECT}.iam.gserviceaccount.com}"
export CLOUDSQL_CONNECTION="${GCP_PROJECT}:${GCP_REGION}:${SQL_INSTANCE}"
export DB_PASSWORD_SECRET="${DB_PASSWORD_SECRET:-course-review-db-password}"
export DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-course-review-database-url}"
