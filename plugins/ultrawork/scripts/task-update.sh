#!/bin/bash
# task-update.sh - Update task status and evidence
# Usage: task-update.sh --session <path> --id <task_id> [--status open|resolved] [--add-evidence "..."]

set -euo pipefail

SESSION_PATH=""
TASK_ID=""
NEW_STATUS=""
ADD_EVIDENCE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_PATH="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    --status) NEW_STATUS="$2"; shift 2 ;;
    --add-evidence) ADD_EVIDENCE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-update.sh --session <path> --id <task_id> [--status open|resolved] [--add-evidence \"...\"]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_PATH" || -z "$TASK_ID" ]]; then
  echo "Error: --session and --id required" >&2
  exit 1
fi

SESSION_DIR=$(dirname "$SESSION_PATH")
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

# Update file
TEMP_FILE=$(mktemp)
jq "$JQ_EXPR" "$TASK_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$TASK_FILE"

echo "OK: Task $TASK_ID updated"
cat "$TASK_FILE"
