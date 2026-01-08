#!/bin/bash

# Ultrawork Cancel Script
# Cancels current ultrawork session with Session ID support

set -euo pipefail

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

# Parse arguments
SESSION_ID_ARG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 ULTRAWORK-CANCEL - Cancel Current Session
═══════════════════════════════════════════════════════════

USAGE:
  /ultrawork-cancel [OPTIONS]

OPTIONS:
  --session <id>   Cancel specific session by ID
  -h, --help       Show this help message

DESCRIPTION:
  Cancels the current ultrawork session.

  • Marks session as CANCELLED
  • Preserves all history and evidence
  • Allows starting a new session with --force

WHAT HAPPENS:
  1. Session marked as CANCELLED
  2. Timestamp recorded
  3. All tasks and evidence preserved
  4. Session file remains for reference

WHEN TO USE:
  • Task requirements changed
  • Started wrong task
  • Need to restart with different approach
  • Session stuck or blocked

NOTE:
  Cancelling does NOT delete history.
  Previous session data remains in:
  ~/.claude/ultrawork/<team>/sessions/<session-id>/session.json

RELATED:
  /ultrawork          Start new session
  /ultrawork-status   Check current session

═══════════════════════════════════════════════════════════
HELP_EOF
      exit 0
      ;;
    --session)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --session requires a session ID argument" >&2
        exit 1
      fi
      SESSION_ID_ARG="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Get team info
TEAM_NAME=$(get_team_name)

# Determine which session to cancel
if [[ -n "$SESSION_ID_ARG" ]]; then
  SESSION_ID="$SESSION_ID_ARG"
else
  SESSION_ID=$(get_current_session_id "$TEAM_NAME")
fi

# Check if we have a session
if [[ -z "$SESSION_ID" ]]; then
  echo "No active ultrawork session to cancel."
  echo ""
  echo "Options:"
  echo "  List all sessions: /ultrawork-status --all"
  echo "  Cancel specific:   /ultrawork-cancel --session <id>"
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID" "$TEAM_NAME")
SESSION_FILE="$SESSION_DIR/session.json"

if [[ ! -f "$SESSION_FILE" ]]; then
  echo "Session $SESSION_ID not found."
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

# Update session.json - set cancelled_at
update_session_json "$SESSION_FILE" ".updated_at = \"$TIMESTAMP\" | .cancelled_at = \"$TIMESTAMP\""

# Output cancellation message
cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION CANCELLED
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID
 Goal: $GOAL
 Team: $TEAM_NAME
 Started: $STARTED
 Cancelled: $TIMESTAMP

───────────────────────────────────────────────────────────

 Session history preserved in:
 $SESSION_FILE

 Note: Tasks created via native Task system remain.
 Use TaskList to view them.

 Start a new session with:
 /ultrawork "your new goal"

═══════════════════════════════════════════════════════════
EOF
