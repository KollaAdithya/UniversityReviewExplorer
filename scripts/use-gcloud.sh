#!/usr/bin/env bash
# Add gcloud to your current terminal session. Usage (from project root):
#   source scripts/use-gcloud.sh
#   gcloud auth login

# Resolve script directory in bash OR zsh (when sourced).
if [[ -n "${ZSH_VERSION:-}" ]]; then
  # zsh: %x = path to current file when sourced
  _THIS="$(cd "$(dirname "${(%):-%x}")" && pwd)"
elif [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  _THIS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  _THIS="$(cd "$(dirname "$0")" && pwd)"
fi
_ROOT="$(cd "$_THIS/.." && pwd)"

# shellcheck source=gcp-path.sh
source "$_ROOT/scripts/gcp-path.sh"

if command -v gcloud >/dev/null 2>&1 && gcloud --version >/dev/null 2>&1; then
  echo "gcloud ready: $(gcloud --version 2>/dev/null | head -1)"
else
  echo "gcloud not working. Run from project root:"
  echo "  ./scripts/install-gcp-tools.sh"
  return 1 2>/dev/null || exit 1
fi
