#!/bin/bash
# session-update.sh - Update session
# Usage: session-update.sh --session <ID> [--phase PLANNING|EXECUTION|VERIFICATION|COMPLETE] [--plan-approved] [--exploration-stage STAGE] [--iteration N]

set -euo pipefail

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

SESSION_ID=""
NEW_PHASE=""
PLAN_APPROVED=false
EXPLORATION_STAGE=""
ITERATION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_ID="$2"; shift 2 ;;
    --phase) NEW_PHASE="$2"; shift 2 ;;
    --plan-approved) PLAN_APPROVED=true; shift ;;
    --exploration-stage) EXPLORATION_STAGE="$2"; shift 2 ;;
    --iteration) ITERATION="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: session-update.sh --session <ID> [--phase ...] [--plan-approved] [--exploration-stage STAGE] [--iteration N]"
      echo ""
      echo "Exploration stages: not_started, overview, analyzing, targeted, complete"
      exit 0
      ;;
    *) shift ;;
  esac
done

# Resolve session ID to file path
SESSION_FILE=$(resolve_session_id "$SESSION_ID") || exit 1

# Build jq update expression
JQ_EXPR=".updated_at = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""

if [[ -n "$NEW_PHASE" ]]; then
  JQ_EXPR="$JQ_EXPR | .phase = \"$NEW_PHASE\""
fi

if [[ "$PLAN_APPROVED" == "true" ]]; then
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  JQ_EXPR="$JQ_EXPR | .plan.approved_at = \"$TIMESTAMP\""
fi

if [[ -n "$EXPLORATION_STAGE" ]]; then
  JQ_EXPR="$JQ_EXPR | .exploration_stage = \"$EXPLORATION_STAGE\""
fi

if [[ -n "$ITERATION" ]]; then
  JQ_EXPR="$JQ_EXPR | .iteration = $ITERATION"
fi

# Update file
TEMP_FILE=$(mktemp)
jq "$JQ_EXPR" "$SESSION_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$SESSION_FILE"

echo "OK: Session updated"
cat "$SESSION_FILE"
