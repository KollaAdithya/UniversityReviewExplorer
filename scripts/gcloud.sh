#!/usr/bin/env bash
# Run gcloud with the correct PATH and Python. Usage:
#   ./scripts/gcloud.sh auth login
#   ./scripts/gcloud.sh config set project YOUR_GCP_PROJECT_ID

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=gcp-path.sh
source "$ROOT/scripts/gcp-path.sh"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found. Run: ./scripts/install-gcp-tools.sh"
  exit 1
fi

exec gcloud "$@"
