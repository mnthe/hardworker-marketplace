#!/bin/bash
# task-create.sh - Create new task
# Usage: task-create.sh --session <ID> --id <id> --subject "..." --description "..." [--blocked-by "1,2"] [--complexity standard|complex] [--criteria "..."] [--approach standard|tdd] [--test-file "..."]

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
APPROACH=""
TEST_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_ID="$2"; shift 2 ;;
    --id) TASK_ID="$2"; shift 2 ;;
    --subject) SUBJECT="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --blocked-by) BLOCKED_BY="$2"; shift 2 ;;
    --complexity) COMPLEXITY="$2"; shift 2 ;;
    --criteria) CRITERIA="$2"; shift 2 ;;
    --approach) APPROACH="$2"; shift 2 ;;
    --test-file) TEST_FILE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-create.sh --session <ID> --id <id> --subject \"...\" --description \"...\" [options]"
      echo "Options:"
      echo "  --blocked-by \"1,2\"     Comma-separated task IDs"
      echo "  --complexity standard|complex"
      echo "  --criteria \"...\"       Pipe-separated criteria"
      echo "  --approach standard|tdd Development approach (default: standard)"
      echo "  --test-file \"...\"      Expected test file path (for TDD tasks)"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_ID" || -z "$TASK_ID" || -z "$SUBJECT" ]]; then
  echo "Error: --session, --id, and --subject required" >&2
  exit 1
fi

# Validate approach if provided
if [[ -n "$APPROACH" && "$APPROACH" != "standard" && "$APPROACH" != "tdd" ]]; then
  echo "Error: Invalid approach \"$APPROACH\". Must be: standard or tdd" >&2
  exit 1
fi

# Validate test-file requires tdd approach
if [[ -n "$TEST_FILE" && "$APPROACH" != "tdd" ]]; then
  echo "Error: --test-file requires --approach tdd" >&2
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

# Build TDD fields
APPROACH_JSON=""
if [[ -n "$APPROACH" ]]; then
  APPROACH_JSON=",
  \"approach\": \"$APPROACH\""
fi

TEST_FILE_JSON=""
if [[ -n "$TEST_FILE" ]]; then
  TEST_FILE_ESCAPED=$(echo "$TEST_FILE" | jq -R .)
  TEST_FILE_JSON=",
  \"test_file\": $TEST_FILE_ESCAPED"
fi

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
  "evidence": []$APPROACH_JSON$TEST_FILE_JSON
}
EOF

echo "OK: Task $TASK_ID created"
cat "$TASK_FILE"
