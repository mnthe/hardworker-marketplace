#!/bin/bash
# task-claim.sh - Claim a teamwork task
# Usage: task-claim.sh --dir <path> --id <task_id> [--owner <owner_id>]

set -euo pipefail

TEAMWORK_DIR=""
TASK_ID=""
OWNER="${CLAUDE_SESSION_ID:-worker-$$}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) TEAMWORK_DIR="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    --owner) OWNER="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-claim.sh --dir <path> --id <task_id> [--owner <owner_id>]"
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

# Check if task is available
current_status=$(jq -r '.status // "open"' "$TASK_FILE")
current_owner=$(jq -r '.owner // null' "$TASK_FILE")

if [[ "$current_status" != "open" ]]; then
  echo "Error: Task $TASK_ID is not open (status: $current_status)" >&2
  exit 1
fi

if [[ "$current_owner" != "null" && -n "$current_owner" ]]; then
  echo "Error: Task $TASK_ID already claimed by $current_owner" >&2
  exit 1
fi

# Claim the task
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TEMP_FILE=$(mktemp)
jq ".owner = \"$OWNER\" | .claimed_at = \"$TIMESTAMP\"" "$TASK_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$TASK_FILE"

echo "OK: Task $TASK_ID claimed by $OWNER"
cat "$TASK_FILE"
