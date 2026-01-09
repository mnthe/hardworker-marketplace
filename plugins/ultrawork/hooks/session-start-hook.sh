#!/bin/bash

# SessionStart Hook - Cleanup old ultrawork sessions
# v5.0: Simplified - no more .claude-session file needed
# Session ID is now passed via stdin to all hooks

set -euo pipefail

# Read stdin JSON (not used, but consume it)
INPUT=$(cat)

# Cleanup old sessions (completed/cancelled/failed older than 7 days)
SESSIONS_DIR="$HOME/.claude/ultrawork/sessions"

if [[ -d "$SESSIONS_DIR" ]]; then
  SESSION_COUNT=$(find "$SESSIONS_DIR" -maxdepth 1 -type d 2>/dev/null | wc -l)

  # Only cleanup if there are more than 10 sessions
  if [[ $SESSION_COUNT -gt 10 ]]; then
    find "$SESSIONS_DIR" -maxdepth 1 -type d -mtime +7 2>/dev/null | while read -r session_dir; do
      if [[ -f "$session_dir/session.json" ]]; then
        # Check if session is in terminal state
        phase=$(jq -r '.phase // ""' "$session_dir/session.json" 2>/dev/null || echo "")
        if [[ "$phase" == "COMPLETE" || "$phase" == "CANCELLED" || "$phase" == "FAILED" ]]; then
          rm -rf "$session_dir"
        fi
      fi
    done
  fi
fi

exit 0
