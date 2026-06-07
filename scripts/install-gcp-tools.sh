#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcp-path.sh
source "$ROOT/scripts/gcp-path.sh"

echo "==> Installing Python GCP dependencies…"
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q
.venv/bin/pip install -r requirements-gcp.txt -q || \
  .venv/bin/pip install "psycopg2-binary>=2.9.9" google-cloud-aiplatform google-cloud-bigquery -q
.venv/bin/python -c "import psycopg2; print('  psycopg2 OK')"

GCLOUD_OK=false
if command -v gcloud >/dev/null 2>&1 && CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-}" gcloud --version >/dev/null 2>&1; then
  GCLOUD_OK=true
  echo "==> gcloud already installed: $(gcloud --version 2>/dev/null | head -1)"
fi

if [[ "$GCLOUD_OK" == false ]]; then
  echo "==> Setting up Google Cloud CLI…"

  # Install Python 3.11 via uv (gcloud requires 3.10+; macOS ships 3.9)
  if ! command -v uv >/dev/null 2>&1; then
    echo "    Installing uv (Python version manager)…"
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # shellcheck source=/dev/null
    source "$HOME/.local/bin/env" 2>/dev/null || export PATH="$HOME/.local/bin:$PATH"
  fi
  uv python install 3.11
  export CLOUDSDK_PYTHON="$(uv python find 3.11)"

  mkdir -p "$ROOT/.cache"
  ARCH="$(uname -m)"
  case "$ARCH" in
    arm64|aarch64) GCLOUD_ARCH="darwin-arm" ;;
    x86_64) GCLOUD_ARCH="darwin-x86_64" ;;
    *) echo "Unsupported arch: $ARCH"; exit 1 ;;
  esac
  TARBALL="$ROOT/.cache/google-cloud-cli-${GCLOUD_ARCH}.tar.gz"
  if [[ ! -f "$TARBALL" ]]; then
    curl -fsSL "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-${GCLOUD_ARCH}.tar.gz" \
      -o "$TARBALL"
  fi
  rm -rf "$ROOT/.cache/google-cloud-sdk"
  tar -xzf "$TARBALL" -C "$ROOT/.cache"
  CLOUDSDK_PYTHON="$CLOUDSDK_PYTHON" "$ROOT/.cache/google-cloud-sdk/install.sh" \
    --quiet --usage-reporting=false --path-update=false
  export PATH="$ROOT/.cache/google-cloud-sdk/bin:$PATH"
  echo "  gcloud installed: $(CLOUDSDK_PYTHON="$CLOUDSDK_PYTHON" gcloud --version 2>/dev/null | head -1)"
fi

if command -v npm >/dev/null 2>&1; then
  echo "==> npm found: $(npm -v) (node $(node -v))"
else
  echo "==> Installing Node.js LTS to .cache/node…"
  NODE_VERSION="$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c "import json,sys; print(next(v['version'] for v in json.load(sys.stdin) if v.get('lts')))")"
  ARCH="$(uname -m)"
  case "$ARCH" in
    arm64|aarch64) NODE_ARCH="darwin-arm64" ;;
    x86_64) NODE_ARCH="darwin-x64" ;;
    *) echo "Unsupported arch: $ARCH"; exit 1 ;;
  esac
  TARBALL="$ROOT/.cache/node-${NODE_VERSION}-${NODE_ARCH}.tar.gz"
  mkdir -p "$ROOT/.cache"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${NODE_ARCH}.tar.gz" -o "$TARBALL"
  rm -rf "$ROOT/.cache/node"
  tar -xzf "$TARBALL" -C "$ROOT/.cache"
  mv "$ROOT/.cache/node-${NODE_VERSION}-${NODE_ARCH}" "$ROOT/.cache/node"
  export PATH="$ROOT/.cache/node/bin:$PATH"
  echo "  node $(node -v), npm $(npm -v)"
fi

echo ""
echo "Next (run from project root):"
echo "  source scripts/use-gcloud.sh"
echo "  gcloud auth login"
echo "  gcloud auth application-default login"
echo "  gcloud config set project YOUR_GCP_PROJECT_ID   # from infra/gcp.env"
echo "  set -a && source infra/gcp.env && set +a"
echo "  ./scripts/verify-gcp-prereqs.sh"
