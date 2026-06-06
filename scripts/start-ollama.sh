#!/usr/bin/env bash
set -euo pipefail

MODEL="${OLLAMA_MODEL:-llama3.2:3b}"

if command -v ollama >/dev/null 2>&1; then
  OLLAMA_BIN="$(command -v ollama)"
elif [[ -x "/Applications/Ollama.app/Contents/Resources/ollama" ]]; then
  OLLAMA_BIN="/Applications/Ollama.app/Contents/Resources/ollama"
else
  echo "Ollama is not installed."
  echo "Install: https://ollama.com/download"
  echo "  macOS: brew install ollama  OR  curl -fsSL https://ollama.com/install.sh | sh"
  exit 1
fi

echo "Pulling model: $MODEL"
"$OLLAMA_BIN" pull "$MODEL"

if curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Ollama is already running at http://127.0.0.1:11434"
elif [[ "$(uname)" == "Darwin" ]] && [[ -d "/Applications/Ollama.app" ]]; then
  echo "Starting Ollama app (macOS)..."
  open -a Ollama
  sleep 4
else
  echo "Starting Ollama (background)..."
  "$OLLAMA_BIN" serve >/tmp/ollama-serve.log 2>&1 &
  sleep 2
fi

if curl -sf http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "Ollama ready. Model: $MODEL"
  echo "Set in backend/.env:"
  echo "  ML_PROVIDER=ollama"
  echo "  OLLAMA_MODEL=$MODEL"
  echo "  OLLAMA_LIVE_REVIEWS_ONLY=true"
else
  echo "Ollama failed to start. Check /tmp/ollama-serve.log"
  exit 1
fi
