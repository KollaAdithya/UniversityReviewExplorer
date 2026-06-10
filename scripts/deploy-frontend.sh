#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcp-config.sh
source "$ROOT/scripts/gcp-config.sh"

: "${VITE_API_BASE_URL:?Set VITE_API_BASE_URL to your Cloud Run URL}"
: "${VITE_FIREBASE_API_KEY:?Set VITE_FIREBASE_API_KEY from Firebase Console}"
: "${VITE_FIREBASE_AUTH_DOMAIN:?Set VITE_FIREBASE_AUTH_DOMAIN}"
: "${VITE_FIREBASE_PROJECT_ID:?Set VITE_FIREBASE_PROJECT_ID}"

FRONTEND_URL="https://storage.googleapis.com/${FRONTEND_BUCKET}/index.html"

echo "==> Building frontend for production…"
cd "$ROOT/frontend"
npm install
# frontend/.env.local sets VITE_FIREBASE_AUTH_EMULATOR_HOST for local dev; Vite loads it
# during `npm run build` and emulator tokens break production auth (no JWT "kid" claim).
unset VITE_FIREBASE_AUTH_EMULATOR_HOST
# Absolute bucket prefix — survives GCS URL shape (./assets can resolve wrong in some browsers)
VITE_BASE="/${FRONTEND_BUCKET}/" \
VITE_API_BASE_URL="$VITE_API_BASE_URL" \
VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
VITE_FIREBASE_AUTH_EMULATOR_HOST= \
npm run build

echo "==> Uploading to gs://${FRONTEND_BUCKET}..."
gsutil -m rsync -r -d dist "gs://$FRONTEND_BUCKET"
gsutil setmeta -h "Cache-Control:no-cache, max-age=0" "gs://$FRONTEND_BUCKET/index.html"
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" "gs://$FRONTEND_BUCKET/assets/**"
gsutil web set -m index.html -e index.html "gs://$FRONTEND_BUCKET"
gsutil iam ch allUsers:objectViewer "gs://$FRONTEND_BUCKET"
gsutil cors set "$ROOT/infra/cors.json" "gs://$FRONTEND_BUCKET" 2>/dev/null || true

echo ""
echo "Frontend deployed: $FRONTEND_URL"
echo ""
echo "Firebase: add storage.googleapis.com as an authorized domain (Auth → Settings)."
echo "CORS: Cloud Run CORS_ORIGINS should include https://storage.googleapis.com"
echo "      (set automatically by deploy-gcp.sh / deploy-backend.sh)"
