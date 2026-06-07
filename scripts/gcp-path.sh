#!/usr/bin/env bash
# Resolve gcloud, npm, and python for GCP scripts (works without Homebrew).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_SDK="$ROOT/.cache/google-cloud-sdk"
CACHE_NODE="$ROOT/.cache/node"

if [[ -x "$CACHE_NODE/bin/npm" ]]; then
  export PATH="$CACHE_NODE/bin:$PATH"
fi

if [[ -x "$CACHE_SDK/bin/gcloud" ]]; then
  export PATH="$CACHE_SDK/bin:$PATH"
elif [[ -d "$HOME/google-cloud-sdk/bin" ]]; then
  export PATH="$HOME/google-cloud-sdk/bin:$PATH"
elif [[ -d "/usr/local/google-cloud-sdk/bin" ]]; then
  export PATH="/usr/local/google-cloud-sdk/bin:$PATH"
fi

# gcloud needs Python 3.10+; macOS system Python is often 3.9.
if [[ -z "${CLOUDSDK_PYTHON:-}" ]]; then
  if [[ -x "$HOME/.local/bin/uv" ]]; then
    UV_PY="$("$HOME/.local/bin/uv" python find 3.11 2>/dev/null || true)"
    if [[ -n "$UV_PY" && -x "$UV_PY" ]]; then
      export CLOUDSDK_PYTHON="$UV_PY"
    fi
  fi
  for candidate in python3.12 python3.11 python3.10; do
    if [[ -z "${CLOUDSDK_PYTHON:-}" ]] && command -v "$candidate" >/dev/null 2>&1; then
      export CLOUDSDK_PYTHON="$(command -v "$candidate")"
    fi
  done
fi

if ! command -v npm >/dev/null 2>&1; then
  if [[ -n "${ZSH_VERSION:-}" ]]; then
    setopt null_glob 2>/dev/null || true
  else
    shopt -s nullglob 2>/dev/null || true
  fi
  for candidate in \
    "$HOME/.fnm/aliases/default/bin" \
    "/opt/homebrew/bin" \
    "/usr/local/bin"; do
    if [[ -x "$candidate/npm" ]]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
  if [[ -d "$HOME/.nvm/versions/node" ]]; then
    for candidate in "$HOME/.nvm/versions/node"/*/bin; do
      [[ -d "$candidate" ]] || continue
      if [[ -x "$candidate/npm" ]]; then
        export PATH="$candidate:$PATH"
        break
      fi
    done
  fi
fi

if [[ -x "$ROOT/backend/.venv/bin/python" ]]; then
  export PATH="$ROOT/backend/.venv/bin:$PATH"
fi
