#!/usr/bin/env bash
#
# 로컬 환경이 mju-news를 돌릴 준비가 되었는지 확인한다.
#
# Usage: ./scripts/verify-setup.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"

fail=0

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "OK   $label"
  else
    echo "FAIL $label"
    fail=1
  fi
}

check "node >= 22"            "node -e 'process.exit(parseInt(process.versions.node) >= 22 ? 0 : 1)'"
check "npm available"         "command -v npm"
check "package.json present"  "test -f package.json"
check "tsconfig.json present" "test -f tsconfig.json"
check "node_modules present"  "test -d node_modules"
check "SKILL.md present"      "test -f skills/getting-mju-news/SKILL.md"

if [ -d dist ]; then
  check "dist/main.js built"  "test -f dist/main.js"
else
  echo "SKIP dist/ not built yet (run: npm run build)"
fi

if [ $fail -ne 0 ]; then
  echo ""
  echo "Some checks failed. Try:"
  echo "  npm install"
  echo "  npm run build"
  exit 1
fi
echo ""
echo "All checks passed."
