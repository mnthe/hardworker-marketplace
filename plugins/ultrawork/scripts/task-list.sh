#!/bin/bash
# task-list.sh - List tasks with filtering
# Usage: task-list.sh --session <path> [--status open|resolved] [--format json|table]

set -euo pipefail

SESSION_PATH=""
STATUS_FILTER=""
FORMAT="table"

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_PATH="$2"; shift 2 ;;
    --status) STATUS_FILTER="$2"; shift 2 ;;
    --format) FORMAT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: task-list.sh --session <path> [--status open|resolved] [--format json|table]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_PATH" ]]; then
  echo "Error: --session required" >&2
  exit 1
fi

SESSION_DIR=$(dirname "$SESSION_PATH")
TASKS_DIR="$SESSION_DIR/tasks"

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
  blocked_by=$(jq -r '.blockedBy // [] | join(",")' "$task_file" 2>/dev/null || echo "")
  complexity=$(jq -r '.complexity // "standard"' "$task_file" 2>/dev/null || echo "standard")

  # Apply status filter
  if [[ -n "$STATUS_FILTER" && "$status" != "$STATUS_FILTER" ]]; then
    continue
  fi

  TASKS+=("$id|$status|$subject|$blocked_by|$complexity")
done

# Output
if [[ "$FORMAT" == "json" ]]; then
  echo "["
  first=true
  for task in "${TASKS[@]}"; do
    IFS='|' read -r id status subject blocked_by complexity <<< "$task"
    [[ "$first" == "true" ]] || echo ","
    first=false
    echo "  {\"id\": \"$id\", \"status\": \"$status\", \"subject\": \"$subject\", \"blockedBy\": \"$blocked_by\", \"complexity\": \"$complexity\"}"
  done
  echo "]"
else
  echo "ID|STATUS|SUBJECT|BLOCKED_BY|COMPLEXITY"
  for task in "${TASKS[@]}"; do
    echo "$task"
  done
fi
