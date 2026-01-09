#!/bin/bash
# task-update.sh - Update task status and evidence
# Usage: task-update.sh --session <ID> --id <task_id> [--status open|resolved] [--add-evidence "..."] [--retry-count N]

set -euo pipefail

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

SESSION_ID=""
TASK_ID=""
NEW_STATUS=""
ADD_EVIDENCE=""
RETRY_COUNT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_ID="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    --status) NEW_STATUS="$2"; shift 2 ;;
    --add-evidence) ADD_EVIDENCE="$2"; shift 2 ;;
    --retry-count) RETRY_COUNT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-update.sh --session <ID> --id <task_id> [--status open|resolved] [--add-evidence \"...\"] [--retry-count N]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_ID" || -z "$TASK_ID" ]]; then
  echo "Error: --session and --id required" >&2
  exit 1
fi

# Get session directory from ID
SESSION_DIR=$(get_session_dir "$SESSION_ID")
TASK_FILE="$SESSION_DIR/tasks/$TASK_ID.json"

if [[ ! -f "$TASK_FILE" ]]; then
  echo "Error: Task $TASK_ID not found" >&2
  exit 1
fi

# Build jq update expression
JQ_EXPR="."

if [[ -n "$NEW_STATUS" ]]; then
  JQ_EXPR="$JQ_EXPR | .status = \"$NEW_STATUS\""
fi

if [[ -n "$ADD_EVIDENCE" ]]; then
  # Escape quotes in evidence
  ESCAPED_EVIDENCE=$(echo "$ADD_EVIDENCE" | sed 's/"/\\"/g')
  JQ_EXPR="$JQ_EXPR | .evidence += [\"$ESCAPED_EVIDENCE\"]"
fi

if [[ -n "$RETRY_COUNT" ]]; then
  JQ_EXPR="$JQ_EXPR | .retry_count = $RETRY_COUNT"
fi

# Update file
TEMP_FILE=$(mktemp)
jq "$JQ_EXPR" "$TASK_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$TASK_FILE"

echo "OK: Task $TASK_ID updated"
cat "$TASK_FILE"
