#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcp-config.sh
source "$ROOT/scripts/gcp-config.sh"

echo "==> GCP setup for project: $GCP_PROJECT (region: $GCP_REGION)"

echo "==> Enabling APIs…"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  aiplatform.googleapis.com \
  bigquery.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  --project "$GCP_PROJECT"

PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT" --format='value(projectNumber)')"
echo "==> Granting Cloud Build IAM permissions…"
for SA in "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"; do
  for role in roles/storage.admin roles/artifactregistry.writer roles/logging.logWriter; do
    gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
      --member="serviceAccount:$SA" \
      --role="$role" \
      --quiet >/dev/null 2>&1 || true
  done
done

echo "==> Creating Cloud Run service account…"
gcloud iam service-accounts create course-review-run \
  --display-name="Course Review Cloud Run" \
  --project "$GCP_PROJECT" 2>/dev/null || true

for role in \
  roles/cloudsql.client \
  roles/bigquery.dataEditor \
  roles/aiplatform.user \
  roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
    --member="serviceAccount:$RUN_SERVICE_ACCOUNT" \
    --role="$role" \
    --quiet >/dev/null
done

echo "==> Creating Cloud SQL PostgreSQL instance (db-f1-micro, ~5 min)…"
if ! gcloud sql instances describe "$SQL_INSTANCE" --project "$GCP_PROJECT" >/dev/null 2>&1; then
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region="$GCP_REGION" \
    --root-password="$DB_PASSWORD" \
    --storage-auto-increase \
    --project "$GCP_PROJECT"
  echo "Root password (save securely): $DB_PASSWORD"
else
  echo "Cloud SQL instance $SQL_INSTANCE already exists."
  if ! gcloud secrets describe "$DB_PASSWORD_SECRET" --project "$GCP_PROJECT" >/dev/null 2>&1; then
    echo "ERROR: Instance exists but secret $DB_PASSWORD_SECRET is missing."
    echo "Set DB_PASSWORD and re-run, or create the secret manually."
    exit 1
  fi
  DB_PASSWORD="$(gcloud secrets versions access latest --secret="$DB_PASSWORD_SECRET" --project "$GCP_PROJECT")"
fi

gcloud sql databases create "$SQL_DATABASE" \
  --instance="$SQL_INSTANCE" \
  --project "$GCP_PROJECT" 2>/dev/null || true

gcloud sql users create "$SQL_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$DB_PASSWORD" \
  --project "$GCP_PROJECT" 2>/dev/null || \
gcloud sql users set-password "$SQL_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$DB_PASSWORD" \
  --project "$GCP_PROJECT"

DATABASE_URL="postgresql+psycopg2://${SQL_USER}:${DB_PASSWORD}@/${SQL_DATABASE}?host=/cloudsql/${CLOUDSQL_CONNECTION}"

echo "==> Storing database credentials in Secret Manager…"
printf '%s' "$DB_PASSWORD" | gcloud secrets create "$DB_PASSWORD_SECRET" \
  --data-file=- --replication-policy=automatic --project "$GCP_PROJECT" 2>/dev/null || \
printf '%s' "$DB_PASSWORD" | gcloud secrets versions add "$DB_PASSWORD_SECRET" \
  --data-file=- --project "$GCP_PROJECT"

printf '%s' "$DATABASE_URL" | gcloud secrets create "$DATABASE_URL_SECRET" \
  --data-file=- --replication-policy=automatic --project "$GCP_PROJECT" 2>/dev/null || \
printf '%s' "$DATABASE_URL" | gcloud secrets versions add "$DATABASE_URL_SECRET" \
  --data-file=- --project "$GCP_PROJECT"

echo "==> Creating BigQuery dataset and table…"
bq --project_id="$GCP_PROJECT" mk --dataset --location=US "$BIGQUERY_DATASET" 2>/dev/null || true
bq query --project_id="$GCP_PROJECT" --use_legacy_sql=false < "$ROOT/infra/bigquery/schema.sql"

echo "==> Creating Artifact Registry repo…"
gcloud artifacts repositories create "${AR_REPO:-course-review}" \
  --repository-format=docker \
  --location="$GCP_REGION" \
  --description="Course Review API images" \
  --project "$GCP_PROJECT" 2>/dev/null || true

echo "==> Creating frontend GCS bucket…"
gsutil mb -p "$GCP_PROJECT" -l "$GCP_REGION" "gs://$FRONTEND_BUCKET" 2>/dev/null || true
gsutil uniformbucketlevelaccess set on "gs://$FRONTEND_BUCKET" 2>/dev/null || true

echo ""
echo "==> Firebase Auth (Email/Password + authorized domains)"
"$ROOT/scripts/setup-firebase-auth.sh"

echo ""
echo "Setup complete."
echo "  Cloud SQL:  $SQL_INSTANCE"
echo "  Connection: $CLOUDSQL_CONNECTION"
echo "  Frontend:   gs://$FRONTEND_BUCKET"
echo ""
echo "Next steps:"
echo "  1. Register a Firebase web app in Console if you have not already (for VITE_FIREBASE_* keys)"
echo "  2. Add optional secrets:"
echo "       echo -n 'gsk_...' | gcloud secrets create groq-api-key --data-file=- --project $GCP_PROJECT"
echo "  3. Deploy: ./scripts/deploy-gcp.sh"
