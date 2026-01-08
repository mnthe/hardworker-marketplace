#!/bin/bash
# session-get.sh - Get session info
# Usage: session-get.sh --session <path> [--field phase|goal|options]

set -euo pipefail

SESSION_PATH=""
FIELD=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_PATH="$2"; shift 2 ;;
    --field) FIELD="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: session-get.sh --session <path> [--field phase|goal|options]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_PATH" ]]; then
  echo "Error: --session required" >&2
  exit 1
fi

if [[ ! -f "$SESSION_PATH" ]]; then
  echo "Error: Session file not found: $SESSION_PATH" >&2
  exit 1
fi

if [[ -n "$FIELD" ]]; then
  jq -r ".$FIELD" "$SESSION_PATH"
else
  cat "$SESSION_PATH"
fi
