#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcp-config.sh
source "$ROOT/scripts/gcp-config.sh"

: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID in infra/gcp.env}"

TOKEN="$(gcloud auth print-access-token)"
AUTH_HEADERS=(
  -H "Authorization: Bearer $TOKEN"
  -H "Content-Type: application/json"
  -H "x-goog-user-project: $GCP_PROJECT"
)

echo "==> Checking Firebase Auth config for $FIREBASE_PROJECT_ID…"
CONFIG_HTTP="$(curl -s -o /tmp/firebase-auth-config.json -w "%{http_code}" \
  "${AUTH_HEADERS[@]}" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${FIREBASE_PROJECT_ID}/config")"

if [[ "$CONFIG_HTTP" == "404" ]]; then
  echo "==> Initializing Firebase Auth (identityPlatform:initializeAuth)…"
  curl -s -X POST "${AUTH_HEADERS[@]}" \
    "https://identitytoolkit.googleapis.com/v2/projects/${FIREBASE_PROJECT_ID}/identityPlatform:initializeAuth" \
    >/dev/null
fi

echo "==> Enabling Email/Password sign-in…"
curl -s -X PATCH "${AUTH_HEADERS[@]}" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${FIREBASE_PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired" \
  -d '{"signIn":{"email":{"enabled":true,"passwordRequired":true}}}' \
  >/dev/null

echo "==> Ensuring authorized domains (GCS frontend + local dev)…"
DOMAINS='["'"${FIREBASE_PROJECT_ID}.firebaseapp.com"'","'"${FIREBASE_PROJECT_ID}.web.app"'","storage.googleapis.com","localhost"]'
curl -s -X PATCH "${AUTH_HEADERS[@]}" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${FIREBASE_PROJECT_ID}/config?updateMask=authorizedDomains" \
  -d "{\"authorizedDomains\":$DOMAINS}" \
  >/dev/null

echo "Firebase Auth ready for $FIREBASE_PROJECT_ID (Email/Password + storage.googleapis.com)."
