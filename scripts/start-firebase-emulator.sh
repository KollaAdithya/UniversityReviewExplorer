#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FIREBASE=""
for CAND in firebase \
  "/Applications/Cursor.app/Contents/Resources/app/resources/bin/firebase" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin/firebase" \
  /opt/homebrew/bin/firebase /usr/local/bin/firebase; do
  if [ -n "$CAND" ] && command -v "$CAND" >/dev/null 2>&1; then
    FIREBASE="$CAND"
    break
  fi
  if [ -x "$CAND" ]; then
    FIREBASE="$CAND"
    break
  fi
done

if [ -z "$FIREBASE" ] || [ ! -x "$FIREBASE" ]; then
  echo "Firebase CLI not found. Install: npm install -g firebase-tools"
  exit 1
fi

if lsof -i :9099 >/dev/null 2>&1; then
  echo "Firebase Auth emulator already running on port 9099."
  exit 0
fi

echo "Starting Firebase Auth emulator (project: course-review-explorer-demo)..."
"$FIREBASE" emulators:start --only auth --project course-review-explorer-demo &
echo $! > "$ROOT/.firebase-emulator.pid"
sleep 3
echo "Auth emulator UI: http://127.0.0.1:4000"
