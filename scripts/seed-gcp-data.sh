#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcp-config.sh
source "$ROOT/scripts/gcp-config.sh"

PYTHON="${ROOT}/backend/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$(command -v python3)"
fi

PROXY_BIN="${ROOT}/.cache/cloud-sql-proxy"
PROXY_VERSION="v2.14.3"
PROXY_PID=""

cleanup() {
  if [[ -n "$PROXY_PID" ]] && kill -0 "$PROXY_PID" 2>/dev/null; then
    kill "$PROXY_PID"
    wait "$PROXY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "==> Fetching Cloud SQL Auth Proxy…"
mkdir -p "${ROOT}/.cache"
if [[ ! -x "$PROXY_BIN" ]]; then
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "$OS-$ARCH" in
    Darwin-arm64|Darwin-aarch64) PROXY_ARCH="darwin.arm64" ;;
    Darwin-x86_64) PROXY_ARCH="darwin.amd64" ;;
    Linux-x86_64) PROXY_ARCH="linux.amd64" ;;
    Linux-aarch64|Linux-arm64) PROXY_ARCH="linux.arm64" ;;
    *) echo "Unsupported platform: $OS $ARCH"; exit 1 ;;
  esac
  curl -fsSL "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${PROXY_VERSION}/cloud-sql-proxy.${PROXY_ARCH}" \
    -o "$PROXY_BIN"
  chmod +x "$PROXY_BIN"
fi

DB_PASSWORD="$(gcloud secrets versions access latest --secret="$DB_PASSWORD_SECRET" --project "$GCP_PROJECT")"
LOCAL_PORT="${LOCAL_DB_PORT:-15432}"
export DATABASE_URL="postgresql+psycopg2://${SQL_USER}:${DB_PASSWORD}@127.0.0.1:${LOCAL_PORT}/${SQL_DATABASE}"

echo "==> Starting Cloud SQL proxy on port ${LOCAL_PORT}..."
"$PROXY_BIN" "$CLOUDSQL_CONNECTION" --port "$LOCAL_PORT" --gcloud-auth &
PROXY_PID=$!
sleep 3

echo "==> Running migrations…"
cd "$ROOT/backend"
"$PYTHON" -m alembic upgrade head

echo "==> Importing public review data..."
# Fast keyword/mock NLP during bulk seed (avoid Groq rate limits).
export USE_MOCK_ML=true
export OLLAMA_LIVE_REVIEWS_ONLY=true
export ML_PROVIDER=mock
"$PYTHON" "$ROOT/scripts/import_public_data.py" \
  --file "$ROOT/data/rmp_public.csv" \
  --force

echo "Data import complete."
