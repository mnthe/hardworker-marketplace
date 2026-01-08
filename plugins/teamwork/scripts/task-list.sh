#!/bin/bash
# task-list.sh - List teamwork tasks with filtering
# Usage: task-list.sh --dir <path> [--status open|resolved] [--role <role>] [--available] [--format json|table]

set -euo pipefail

TEAMWORK_DIR=""
STATUS_FILTER=""
ROLE_FILTER=""
AVAILABLE_ONLY=false
FORMAT="table"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) TEAMWORK_DIR="$2"; shift 2 ;;
    --status) STATUS_FILTER="$2"; shift 2 ;;
    --role) ROLE_FILTER="$2"; shift 2 ;;
    --available) AVAILABLE_ONLY=true; shift ;;
    --format) FORMAT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-list.sh --dir <path> [--status open|resolved] [--role <role>] [--available] [--format json|table]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$TEAMWORK_DIR" ]]; then
  echo "Error: --dir required" >&2
  exit 1
fi

TASKS_DIR="$TEAMWORK_DIR/tasks"

if [[ ! -d "$TASKS_DIR" ]]; then
  echo "No tasks directory found" >&2
  exit 1
fi

# Collect tasks
TASKS=()
for task_file in "$TASKS_DIR"/*.json; do
  [[ -e "$task_file" ]] || continue

  id=$(basename "$task_file" .json)
  status=$(jq -r '.status // "open"' "$task_file" 2>/dev/null || echo "open")
  subject=$(jq -r '.subject // "Unknown"' "$task_file" 2>/dev/null || echo "Unknown")
  role=$(jq -r '.role // "general"' "$task_file" 2>/dev/null || echo "general")
  owner=$(jq -r '.owner // null' "$task_file" 2>/dev/null || echo "null")
  blocked_by=$(jq -r '.blockedBy // [] | join(",")' "$task_file" 2>/dev/null || echo "")

  # Apply filters
  if [[ -n "$STATUS_FILTER" && "$status" != "$STATUS_FILTER" ]]; then
    continue
  fi

  if [[ -n "$ROLE_FILTER" && "$role" != "$ROLE_FILTER" ]]; then
    continue
  fi

  if [[ "$AVAILABLE_ONLY" == "true" ]]; then
    # Available = open, no owner, not blocked
    if [[ "$status" != "open" || "$owner" != "null" || -n "$blocked_by" ]]; then
      continue
    fi
  fi

  TASKS+=("$id|$status|$role|$subject|$owner|$blocked_by")
done

# Output
if [[ "$FORMAT" == "json" ]]; then
  echo "["
  first=true
  for task in "${TASKS[@]}"; do
    IFS='|' read -r id status role subject owner blocked_by <<< "$task"
    [[ "$first" == "true" ]] || echo ","
    first=false
    echo "  {\"id\": \"$id\", \"status\": \"$status\", \"role\": \"$role\", \"subject\": \"$subject\", \"owner\": \"$owner\", \"blockedBy\": \"$blocked_by\"}"
  done
  echo "]"
else
  echo "ID|STATUS|ROLE|SUBJECT|OWNER|BLOCKED_BY"
  for task in "${TASKS[@]}"; do
    echo "$task"
  done
fi
