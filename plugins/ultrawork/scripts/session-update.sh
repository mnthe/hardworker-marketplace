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
QUIET=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_ID="$2"; shift 2 ;;
    --phase) NEW_PHASE="$2"; shift 2 ;;
    --plan-approved) PLAN_APPROVED=true; shift ;;
    --exploration-stage) EXPLORATION_STAGE="$2"; shift 2 ;;
    --iteration) ITERATION="$2"; shift 2 ;;
    -q|--quiet) QUIET=true; shift ;;
    -h|--help)
      echo "Usage: session-update.sh --session <ID> [--phase ...] [--plan-approved] [--exploration-stage STAGE] [--iteration N] [--quiet]"
      echo ""
      echo "Exploration stages: not_started, overview, analyzing, targeted, complete"
      exit 0
      ;;
    *) shift ;;
  esac
done

# Resolve session ID to file path
SESSION_FILE=$(resolve_session_id "$SESSION_ID") || exit 1

# Build jq arguments and filter expression
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
JQ_ARGS=("--arg" "updated_at" "$TIMESTAMP")
JQ_FILTER=".updated_at = \$updated_at"

if [[ -n "$NEW_PHASE" ]]; then
  JQ_ARGS+=("--arg" "phase" "$NEW_PHASE")
  JQ_FILTER="$JQ_FILTER | .phase = \$phase"
fi

if [[ "$PLAN_APPROVED" == "true" ]]; then
  APPROVAL_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  JQ_ARGS+=("--arg" "approved_at" "$APPROVAL_TIMESTAMP")
  JQ_FILTER="$JQ_FILTER | .plan.approved_at = \$approved_at"
fi

if [[ -n "$EXPLORATION_STAGE" ]]; then
  JQ_ARGS+=("--arg" "exploration_stage" "$EXPLORATION_STAGE")
  JQ_FILTER="$JQ_FILTER | .exploration_stage = \$exploration_stage"
fi

if [[ -n "$ITERATION" ]]; then
  JQ_ARGS+=("--argjson" "iteration" "$ITERATION")
  JQ_FILTER="$JQ_FILTER | .iteration = \$iteration"
fi

# Update file
TEMP_FILE=$(mktemp)
jq "${JQ_ARGS[@]}" "$JQ_FILTER" "$SESSION_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$SESSION_FILE"

if [[ "$QUIET" == "true" ]]; then
  PHASE=$(jq -r '.phase // "unknown"' "$SESSION_FILE")
  ITER=$(jq -r '.iteration // "0"' "$SESSION_FILE")
  UPDATED=$(jq -r '.updated_at // "unknown"' "$SESSION_FILE")
  echo "Session updated: phase=$PHASE iteration=$ITER updated_at=$UPDATED"
else
  echo "OK: Session updated"
  cat "$SESSION_FILE"
fi
