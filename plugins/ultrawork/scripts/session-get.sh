#!/bin/bash
# session-get.sh - Get session info
# Usage: session-get.sh --session <ID> [--field phase|goal|options]

set -euo pipefail

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

SESSION_ID=""
FIELD=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_ID="$2"; shift 2 ;;
    --field) FIELD="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: session-get.sh --session <ID> [--field phase|goal|options]"
      exit 0
      ;;
    *) shift ;;
  esac
done

# Resolve session ID to file path
SESSION_FILE=$(resolve_session_id "$SESSION_ID") || exit 1

if [[ -n "$FIELD" ]]; then
  jq -r ".$FIELD" "$SESSION_FILE"
else
  cat "$SESSION_FILE"
fi
