#!/bin/bash
# task-get.sh - Get single teamwork task details
# Usage: task-get.sh --dir <path> --id <task_id>

set -euo pipefail

TEAMWORK_DIR=""
TASK_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) TEAMWORK_DIR="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-get.sh --dir <path> --id <task_id>"
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

cat "$TASK_FILE"
