#!/bin/bash

# Ultrawork Cancel Script
# v5.0: Requires --session from AI

set -euo pipefail

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

# Parse arguments
SESSION_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 ULTRAWORK-CANCEL - Cancel Session
═══════════════════════════════════════════════════════════

USAGE:
  /ultrawork-cancel --session <id>

OPTIONS:
  --session <id>   Session ID (required, provided by AI)
  -h, --help       Show this help message

═══════════════════════════════════════════════════════════
HELP_EOF
      exit 0
      ;;
    --session)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --session requires a session ID argument" >&2
        exit 1
      fi
      SESSION_ID="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Validate --session
if [[ -z "$SESSION_ID" ]]; then
  echo "❌ Error: --session is required" >&2
  exit 1
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"

if [[ ! -f "$SESSION_FILE" ]]; then
  echo "❌ Session $SESSION_ID not found." >&2
  exit 1
fi

# Get current info
GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
STARTED=$(grep -o '"started_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
CANCELLED_AT=$(grep -o '"cancelled_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")

# Check if already cancelled
if [[ -n "$CANCELLED_AT" && "$CANCELLED_AT" != "null" ]]; then
  echo "Session $SESSION_ID already cancelled at $CANCELLED_AT"
  exit 0
fi

# Generate timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Update session.json
if acquire_session_lock "$SESSION_FILE"; then
  trap 'release_session_lock "$SESSION_FILE"' EXIT
  TMP_FILE="${SESSION_FILE}.tmp"
  jq --arg ts "$TIMESTAMP" '.updated_at = $ts | .cancelled_at = $ts | .phase = "CANCELLED"' "$SESSION_FILE" > "$TMP_FILE"
  mv "$TMP_FILE" "$SESSION_FILE"
  release_session_lock "$SESSION_FILE"
  trap - EXIT
fi

# Output cancellation message
cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION CANCELLED
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID
 Goal: $GOAL
 Started: $STARTED
 Cancelled: $TIMESTAMP

───────────────────────────────────────────────────────────

 Session history preserved in:
 $SESSION_FILE

 Start a new session with:
 /ultrawork "your new goal"

═══════════════════════════════════════════════════════════
EOF
