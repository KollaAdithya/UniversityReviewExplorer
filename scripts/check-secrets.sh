#!/usr/bin/env bash
# Fail if staged/tracked files look like they contain real API keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERNS=(
  'gsk_[A-Za-z0-9]{20,}'
  'sk-proj-[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{20,}'
  'AIza[0-9A-Za-z_-]{30,}'
)

# Files that must never be committed
BLOCKED_PATHS=(
  'backend/.env'
  'frontend/.env.local'
  'infra/gcp.env'
  '.env'
)

fail=0

for path in "${BLOCKED_PATHS[@]}"; do
  if git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    echo "BLOCKED: $path is tracked by git — run: git rm --cached $path"
    fail=1
  fi
done

scan_files() {
  local label="$1"
  shift
  local files=("$@")
  if [[ ${#files[@]} -eq 0 ]]; then
    return 0
  fi
  for pattern in "${PATTERNS[@]}"; do
    local hits
    hits=$(grep -lE "$pattern" "${files[@]}" 2>/dev/null || true)
    if [[ -n "$hits" ]]; then
      echo "$hits"
      echo "FAIL ($label): possible API key detected (pattern: $pattern)"
      fail=1
    fi
  done
}

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  staged=()
  while IFS= read -r f; do
    [[ -n "$f" && -f "$f" ]] && staged+=("$f")
  done < <(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
  if [[ ${#staged[@]} -gt 0 ]]; then
    scan_files "staged" "${staged[@]}"
  fi

  tracked=()
  while IFS= read -r f; do
    [[ -n "$f" && -f "$f" ]] && tracked+=("$f")
  done < <(git ls-files 2>/dev/null | grep -E '\.(env|md|py|ts|tsx|json|sh|yaml|yml)$' | grep -v node_modules | grep -v '.env.example' || true)
  if [[ ${#tracked[@]} -gt 0 ]]; then
    scan_files "tracked" "${tracked[@]}"
  fi
fi

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "Secret check failed. Remove keys from git and use .env.example templates."
  exit 1
fi

echo "Secret check passed."
