#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_FILE="${DECISION_SWARM_REPORT_FILE:-}"
HISTORY_FILE="${DECISION_SWARM_HISTORY_FILE:-}"
FAILURES=0

check_file() {
  local label="$1"
  local path="$2"

  if [[ -f "$path" ]]; then
    echo "[decision-swarm] ${label}: ok (${path})"
  else
    echo "[decision-swarm] ${label}: missing (${path})"
    FAILURES=$((FAILURES + 1))
  fi
}

check_token() {
  local label="$1"
  local path="$2"
  local pattern="$3"

  if grep -q "$pattern" "$path"; then
    echo "[decision-swarm] ${label}: ok (${pattern})"
  else
    echo "[decision-swarm] ${label}: missing token (${pattern})"
    FAILURES=$((FAILURES + 1))
  fi
}

check_file "readme" "${REPO_ROOT}/README.md"
check_file "roadmap" "${REPO_ROOT}/docs/ROADMAP.md"
check_token "mvp section" "${REPO_ROOT}/README.md" "MVP scope"
check_token "status section" "${REPO_ROOT}/README.md" "## Status"

if (( FAILURES > 0 )); then
  status="fail"
  code=1
else
  status="ok"
  code=0
fi

summary="{\"service\":\"decision-swarm\",\"status\":\"${status}\",\"failures\":${FAILURES},\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
echo "${summary}"

if [[ -n "$REPORT_FILE" ]]; then
  printf '%s\n' "$summary" > "$REPORT_FILE"
  echo "[decision-swarm] wrote report: ${REPORT_FILE}"
fi

if [[ -n "$HISTORY_FILE" ]]; then
  printf '%s\n' "$summary" >> "$HISTORY_FILE"
  echo "[decision-swarm] appended history: ${HISTORY_FILE}"
fi

exit "$code"
