#!/bin/bash
# task-create.sh - Create new task
# Usage: task-create.sh --session <ID> --id <id> --subject "..." --description "..." [--blocked-by "1,2"] [--complexity standard|complex] [--criteria "..."]

set -euo pipefail

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

SESSION_ID=""
TASK_ID=""
SUBJECT=""
DESCRIPTION=""
BLOCKED_BY=""
COMPLEXITY="standard"
CRITERIA=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_ID="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    --subject) SUBJECT="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --blocked-by) BLOCKED_BY="$2"; shift 2 ;;
    --complexity) COMPLEXITY="$2"; shift 2 ;;
    --criteria) CRITERIA="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-create.sh --session <ID> --id <id> --subject \"...\" --description \"...\" [options]"
      echo "Options:"
      echo "  --blocked-by \"1,2\"     Comma-separated task IDs"
      echo "  --complexity standard|complex"
      echo "  --criteria \"...\"       Pipe-separated criteria"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_ID" || -z "$TASK_ID" || -z "$SUBJECT" ]]; then
  echo "Error: --session, --id, and --subject required" >&2
  exit 1
fi

# Get session directory from ID
SESSION_DIR=$(get_session_dir "$SESSION_ID")
TASKS_DIR="$SESSION_DIR/tasks"
TASK_FILE="$TASKS_DIR/$TASK_ID.json"

# Create tasks directory if needed
mkdir -p "$TASKS_DIR"

# Check if task already exists
if [[ -f "$TASK_FILE" ]]; then
  echo "Error: Task $TASK_ID already exists" >&2
  exit 1
fi

# Build blocked_by array
BLOCKED_BY_JSON="[]"
if [[ -n "$BLOCKED_BY" ]]; then
  BLOCKED_BY_JSON=$(echo "$BLOCKED_BY" | tr ',' '\n' | jq -R . | jq -s .)
fi

# Build criteria array
CRITERIA_JSON="[]"
if [[ -n "$CRITERIA" ]]; then
  CRITERIA_JSON=$(echo "$CRITERIA" | tr '|' '\n' | jq -R . | jq -s .)
fi

# Escape strings
SUBJECT_ESCAPED=$(echo "$SUBJECT" | jq -R .)
DESCRIPTION_ESCAPED=$(echo "${DESCRIPTION:-$SUBJECT}" | jq -R .)

# Create task JSON
cat > "$TASK_FILE" << EOF
{
  "id": "$TASK_ID",
  "subject": $SUBJECT_ESCAPED,
  "description": $DESCRIPTION_ESCAPED,
  "status": "open",
  "blockedBy": $BLOCKED_BY_JSON,
  "complexity": "$COMPLEXITY",
  "criteria": $CRITERIA_JSON,
  "evidence": []
}
EOF

echo "OK: Task $TASK_ID created"
cat "$TASK_FILE"
