#!/bin/bash
# session-get.sh - Get session info
# Usage: session-get.sh --session <ID> [--field phase|goal|options] [--dir] [--file]

set -euo pipefail

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

SESSION_ID=""
FIELD=""
GET_DIR=false
GET_FILE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_ID="$2"; shift 2 ;;
    --field) FIELD="$2"; shift 2 ;;
    --dir) GET_DIR=true; shift ;;
    --file) GET_FILE=true; shift ;;
    -h|--help)
      echo "Usage: session-get.sh --session <ID> [--field phase|goal|options] [--dir] [--file]"
      echo ""
      echo "Options:"
      echo "  --session <ID>   Session ID (required)"
      echo "  --field <name>   Get specific field from session.json"
      echo "  --dir            Return session directory path"
      echo "  --file           Return session.json file path"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_ID" ]]; then
  echo "Error: --session <ID> required" >&2
  exit 1
fi

# Return session directory path
if [[ "$GET_DIR" == "true" ]]; then
  get_session_dir "$SESSION_ID"
  exit 0
fi

# Return session file path
if [[ "$GET_FILE" == "true" ]]; then
  get_session_file "$SESSION_ID"
  exit 0
fi

# Resolve session ID to file path (validates existence)
SESSION_FILE=$(resolve_session_id "$SESSION_ID") || exit 1

if [[ -n "$FIELD" ]]; then
  jq -r ".$FIELD" "$SESSION_FILE"
else
  cat "$SESSION_FILE"
fi
