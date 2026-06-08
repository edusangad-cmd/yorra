#!/usr/bin/env bash
# porra-deportiva CI gate. Runs lint + type-check + tests for backend and frontend
# in parallel, INSIDE the docker containers (no host toolchain required).
#
#   ./scripts/verify.sh           # full: ruff+mypy+pytest || eslint+tsc+vitest
#   ./scripts/verify.sh --fast    # skip pytest + vitest (lint + types only)
#
# Requires the stack to be up:  docker compose up -d --build
# If VERIFY_STATUS_DIR is set, tees output to verify.log and writes verify.status.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

FAST=0
[[ "${1:-}" == "--fast" ]] && FAST=1

dc() { docker compose exec -T "$@"; }

backend_stage() {
  echo "── backend: ruff ──"      && dc backend uv run ruff check . || return 1
  echo "── backend: mypy ──"      && dc backend uv run mypy . || return 1
  if [[ $FAST -eq 0 ]]; then
    echo "── backend: pytest ──"  && dc backend uv run pytest || return 1
  fi
}

frontend_stage() {
  echo "── frontend: eslint ──"   && dc frontend npm run lint || return 1
  echo "── frontend: tsc ──"      && dc frontend npm run typecheck || return 1
  if [[ $FAST -eq 0 ]]; then
    echo "── frontend: vitest ──" && dc frontend npm run test || return 1
  fi
}

backend_stage & BACK=$!
frontend_stage & FRONT=$!
wait $BACK; BACK_RC=$?
wait $FRONT; FRONT_RC=$?

RC=0
[[ $BACK_RC -ne 0 ]] && { echo "❌ backend failed"; RC=1; }
[[ $FRONT_RC -ne 0 ]] && { echo "❌ frontend failed"; RC=1; }
[[ $RC -eq 0 ]] && echo "✅ verify passed"

if [[ -n "${VERIFY_STATUS_DIR:-}" ]]; then
  mkdir -p "$VERIFY_STATUS_DIR"
  {
    echo "exit=$RC"
    echo "commit=$(git rev-parse --short HEAD 2>/dev/null || echo none)"
    echo "finished_at=$(date -u +%FT%TZ)"
    echo "mode=$([[ $FAST -eq 1 ]] && echo fast || echo full)"
  } > "$VERIFY_STATUS_DIR/verify.status"
fi

exit $RC
