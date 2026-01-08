#!/bin/bash
# task-get.sh - Get single task details
# Usage: task-get.sh --session <path> --id <task_id>

set -euo pipefail

SESSION_PATH=""
TASK_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_PATH="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-get.sh --session <path> --id <task_id>"
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

cat "$TASK_FILE"
