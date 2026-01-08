#!/bin/bash
# session-update.sh - Update session
# Usage: session-update.sh --session <path> [--phase PLANNING|EXECUTION|VERIFICATION|COMPLETE] [--plan-approved]

set -euo pipefail

SESSION_PATH=""
NEW_PHASE=""
PLAN_APPROVED=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_PATH="$2"; shift 2 ;;
    --phase) NEW_PHASE="$2"; shift 2 ;;
    --plan-approved) PLAN_APPROVED=true; shift ;;
    -h|--help)
      echo "Usage: session-update.sh --session <path> [--phase PLANNING|EXECUTION|VERIFICATION|COMPLETE] [--plan-approved]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_PATH" ]]; then
  echo "Error: --session required" >&2
  exit 1
fi

if [[ ! -f "$SESSION_PATH" ]]; then
  echo "Error: Session file not found: $SESSION_PATH" >&2
  exit 1
fi

# Build jq update expression
JQ_EXPR=".updated_at = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""

if [[ -n "$NEW_PHASE" ]]; then
  JQ_EXPR="$JQ_EXPR | .phase = \"$NEW_PHASE\""
fi

if [[ "$PLAN_APPROVED" == "true" ]]; then
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  JQ_EXPR="$JQ_EXPR | .plan.approved_at = \"$TIMESTAMP\""
fi

# Update file
TEMP_FILE=$(mktemp)
jq "$JQ_EXPR" "$SESSION_PATH" > "$TEMP_FILE"
mv "$TEMP_FILE" "$SESSION_PATH"

echo "OK: Session updated"
cat "$SESSION_PATH"
