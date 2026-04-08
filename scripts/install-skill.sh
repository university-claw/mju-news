#!/usr/bin/env bash
#
# NemoClaw 샌드박스에 getting-mju-news SKILL.md를 설치한다.
#
# Usage: ./scripts/install-skill.sh [sandbox-name]
#        기본 sandbox-name: mjuclaw
#
# 전제: 호스트에 openshell CLI가 설치되어 있고, 대상 샌드박스가 존재해야 한다.
# NemoClaw가 onboard될 때 workspace가 초기화되므로 재온보딩 후엔 이 스크립트를
# 다시 실행해야 skill이 돌아온다. mju-server의 start.sh가 호출한다.

set -euo pipefail

SANDBOX_NAME="${1:-mjuclaw}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/../skills/getting-mju-news"
REMOTE_SKILL_DIR="/sandbox/.openclaw/workspace/skills/getting-mju-news"

if [ ! -d "$SKILL_DIR" ]; then
  echo "ERR: skill directory not found: $SKILL_DIR" >&2
  exit 1
fi
if [ ! -f "$SKILL_DIR/SKILL.md" ]; then
  echo "ERR: SKILL.md not found: $SKILL_DIR/SKILL.md" >&2
  exit 1
fi

if ! command -v openshell >/dev/null 2>&1; then
  echo "ERR: openshell CLI not found in PATH" >&2
  exit 1
fi

# 임시 ssh-config 생성
CONF_DIR="$(mktemp -d)"
trap 'rm -rf "$CONF_DIR"' EXIT

if ! openshell sandbox ssh-config "$SANDBOX_NAME" >"$CONF_DIR/config" 2>/dev/null; then
  echo "ERR: failed to get ssh-config for sandbox '$SANDBOX_NAME'" >&2
  exit 1
fi

HOST_ALIAS="openshell-$SANDBOX_NAME"

# 원격 디렉토리 생성
ssh -T -F "$CONF_DIR/config" "$HOST_ALIAS" "mkdir -p $REMOTE_SKILL_DIR"

# SKILL.md 및 (있다면) REFERENCE.md 전송
scp -F "$CONF_DIR/config" \
  "$SKILL_DIR/SKILL.md" \
  "$HOST_ALIAS:$REMOTE_SKILL_DIR/SKILL.md"

if [ -f "$SKILL_DIR/REFERENCE.md" ]; then
  scp -F "$CONF_DIR/config" \
    "$SKILL_DIR/REFERENCE.md" \
    "$HOST_ALIAS:$REMOTE_SKILL_DIR/REFERENCE.md"
fi

echo "OK: installed getting-mju-news skill to sandbox '$SANDBOX_NAME'"
