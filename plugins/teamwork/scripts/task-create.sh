#!/bin/bash
# task-create.sh - Create new teamwork task
# Usage: task-create.sh --dir <path> --id <id> --subject "..." [--description "..."] [--role <role>] [--blocked-by "1,2"]

set -euo pipefail

TEAMWORK_DIR=""
TASK_ID=""
SUBJECT=""
DESCRIPTION=""
ROLE="general"
BLOCKED_BY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) TEAMWORK_DIR="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    --subject) SUBJECT="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --role) ROLE="$2"; shift 2 ;;
    --blocked-by) BLOCKED_BY="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-create.sh --dir <path> --id <id> --subject \"...\" [--description \"...\"] [--role <role>] [--blocked-by \"1,2\"]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$TEAMWORK_DIR" || -z "$TASK_ID" || -z "$SUBJECT" ]]; then
  echo "Error: --dir, --id, and --subject required" >&2
  exit 1
fi

TASKS_DIR="$TEAMWORK_DIR/tasks"
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

# Escape strings
SUBJECT_ESCAPED=$(echo "$SUBJECT" | jq -R .)
DESCRIPTION_ESCAPED=$(echo "${DESCRIPTION:-$SUBJECT}" | jq -R .)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Create task JSON
cat > "$TASK_FILE" << EOF
{
  "id": "$TASK_ID",
  "subject": $SUBJECT_ESCAPED,
  "description": $DESCRIPTION_ESCAPED,
  "status": "open",
  "owner": null,
  "role": "$ROLE",
  "blockedBy": $BLOCKED_BY_JSON,
  "evidence": [],
  "created_at": "$TIMESTAMP",
  "claimed_at": null,
  "completed_at": null
}
EOF

echo "OK: Task $TASK_ID created"
cat "$TASK_FILE"
