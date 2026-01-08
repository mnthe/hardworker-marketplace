#!/bin/bash
# task-update.sh - Update teamwork task
# Usage: task-update.sh --dir <path> --id <task_id> [--status open|resolved] [--add-evidence "..."] [--release]

set -euo pipefail

TEAMWORK_DIR=""
TASK_ID=""
NEW_STATUS=""
ADD_EVIDENCE=""
RELEASE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) TEAMWORK_DIR="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    --status) NEW_STATUS="$2"; shift 2 ;;
    --add-evidence) ADD_EVIDENCE="$2"; shift 2 ;;
    --release) RELEASE=true; shift ;;
    -h|--help)
      echo "Usage: task-update.sh --dir <path> --id <task_id> [--status open|resolved] [--add-evidence \"...\"] [--release]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$TEAMWORK_DIR" || -z "$TASK_ID" ]]; then
  echo "Error: --dir and --id required" >&2
  exit 1
fi

TASK_FILE="$TEAMWORK_DIR/tasks/$TASK_ID.json"

if [[ ! -f "$TASK_FILE" ]]; then
  echo "Error: Task $TASK_ID not found" >&2
  exit 1
fi

# Build jq update expression
JQ_EXPR="."

if [[ -n "$NEW_STATUS" ]]; then
  JQ_EXPR="$JQ_EXPR | .status = \"$NEW_STATUS\""
  if [[ "$NEW_STATUS" == "resolved" ]]; then
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    JQ_EXPR="$JQ_EXPR | .completed_at = \"$TIMESTAMP\""
  fi
fi

if [[ -n "$ADD_EVIDENCE" ]]; then
  ESCAPED_EVIDENCE=$(echo "$ADD_EVIDENCE" | sed 's/"/\\"/g')
  JQ_EXPR="$JQ_EXPR | .evidence += [\"$ESCAPED_EVIDENCE\"]"
fi

if [[ "$RELEASE" == "true" ]]; then
  JQ_EXPR="$JQ_EXPR | .owner = null | .claimed_at = null"
fi

# Update file
TEMP_FILE=$(mktemp)
jq "$JQ_EXPR" "$TASK_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$TASK_FILE"

echo "OK: Task $TASK_ID updated"
cat "$TASK_FILE"
