#!/bin/bash
# task-get.sh - Get single task details
# Usage: task-get.sh --session <ID> --id <task_id>

set -euo pipefail

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

SESSION_ID=""
TASK_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_ID="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-get.sh --session <ID> --id <task_id>"
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

cat "$TASK_FILE"
