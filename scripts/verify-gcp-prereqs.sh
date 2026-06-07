#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcp-path.sh
source "$ROOT/scripts/gcp-path.sh"

PASS=0
FAIL=0
WARN=0

ok()   { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  ! $1"; WARN=$((WARN + 1)); }

echo "==> GCP deploy prerequisites"
echo ""

echo "Config"
if [[ -f "$ROOT/infra/gcp.env" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/infra/gcp.env"
  ok "infra/gcp.env exists"
  [[ -n "${GCP_PROJECT:-}" ]] && ok "GCP_PROJECT=$GCP_PROJECT" || bad "GCP_PROJECT not set"
  [[ -n "${VITE_FIREBASE_API_KEY:-}" ]] && ok "VITE_FIREBASE_API_KEY set" || bad "VITE_FIREBASE_API_KEY missing"
  [[ -n "${VITE_FIREBASE_AUTH_DOMAIN:-}" ]] && ok "VITE_FIREBASE_AUTH_DOMAIN set" || bad "VITE_FIREBASE_AUTH_DOMAIN missing"
  [[ -n "${FIREBASE_PROJECT_ID:-}" ]] && ok "FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID" || bad "FIREBASE_PROJECT_ID missing"
else
  bad "infra/gcp.env missing — run: cp infra/gcp.env.example infra/gcp.env"
fi

echo ""
echo "Tools"
if command -v gcloud >/dev/null 2>&1 && gcloud --version >/dev/null 2>&1; then
  ok "gcloud $(gcloud --version 2>/dev/null | head -1 | awk '{print $4}')"
elif command -v gcloud >/dev/null 2>&1; then
  bad "gcloud broken (needs Python 3.10+) — run: ./scripts/install-gcp-tools.sh"
else
  bad "gcloud not found — run: ./scripts/install-gcp-tools.sh"
fi

if command -v npm >/dev/null 2>&1; then
  ok "npm $(npm -v)"
else
  bad "npm not found — install Node.js from https://nodejs.org"
fi

if [[ -x "$ROOT/backend/.venv/bin/python" ]]; then
  if "$ROOT/backend/.venv/bin/python" -c "import psycopg2" 2>/dev/null; then
    ok "Python venv + psycopg2"
  else
    bad "psycopg2 missing — run: ./scripts/install-gcp-tools.sh"
  fi
else
  bad "backend/.venv missing — run: ./scripts/install-gcp-tools.sh"
fi

if [[ -x "$ROOT/scripts/deploy-gcp.sh" ]]; then
  ok "deploy scripts executable"
else
  warn "run: chmod +x scripts/*.sh"
fi

echo ""
echo "GCP auth (requires gcloud)"
if command -v gcloud >/dev/null 2>&1; then
  if gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
    ok "gcloud logged in as $(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)"
  else
    bad "not logged in — run: gcloud auth login"
  fi

  if gcloud auth application-default print-access-token >/dev/null 2>&1; then
    ok "application-default credentials set"
  else
    bad "ADC missing — run: gcloud auth application-default login"
  fi

  ACTIVE_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ -n "$ACTIVE_PROJECT" && "$ACTIVE_PROJECT" != "(unset)" ]]; then
    if [[ "${GCP_PROJECT:-}" == "$ACTIVE_PROJECT" ]]; then
      ok "gcloud project matches gcp.env ($ACTIVE_PROJECT)"
    else
      warn "gcloud project is '$ACTIVE_PROJECT' but gcp.env has '${GCP_PROJECT:-unset}'"
      echo "         run: gcloud config set project ${GCP_PROJECT:-YOUR_PROJECT_ID}"
    fi
  else
    bad "gcloud project not set — run: gcloud config set project ${GCP_PROJECT:-YOUR_PROJECT_ID}"
  fi

  if gcloud billing projects describe "${GCP_PROJECT:-}" --format="value(billingEnabled)" 2>/dev/null | grep -q True; then
    ok "billing enabled on $GCP_PROJECT"
  else
    warn "billing may not be enabled — link a billing account in Cloud Console"
  fi
else
  warn "skipped auth checks (gcloud not installed)"
fi

echo ""
echo "Data"
[[ -f "$ROOT/data/rmp_public.csv" ]] && ok "rmp_public.csv present" || bad "data/rmp_public.csv missing"

echo ""
echo "Result: $PASS passed, $FAIL failed, $WARN warnings"
if [[ $FAIL -eq 0 ]]; then
  echo "Ready to deploy: set -a && source infra/gcp.env && set +a && ./scripts/deploy-gcp.sh"
  exit 0
fi
echo "Fix the failures above, then re-run: ./scripts/verify-gcp-prereqs.sh"
exit 1
