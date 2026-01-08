#!/bin/bash

# SessionStart Hook - Captures Claude Code session_id for ultrawork session management
# Receives JSON via stdin with session_id, writes to team-specific file

set -euo pipefail

# Read stdin JSON
INPUT=$(cat)

# Extract session_id
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [[ -z "$SESSION_ID" ]]; then
  # No session_id available, exit silently
  exit 0
fi

# Extract other useful info
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Get team name from CWD (git repo name)
if [[ -n "$CWD" ]] && [[ -d "$CWD/.git" ]]; then
  TEAM_NAME=$(basename "$CWD")
else
  TEAM_NAME="default"
fi

# Create directory structure
ULTRAWORK_BASE="$HOME/.claude/ultrawork"
TEAM_DIR="$ULTRAWORK_BASE/$TEAM_NAME"
mkdir -p "$TEAM_DIR"

# Write current Claude session info
# This file is read by setup-ultrawork.sh to get the session_id
cat > "$TEAM_DIR/.claude-session" << EOF
{
  "claude_session_id": "$SESSION_ID",
  "transcript_path": "$TRANSCRIPT_PATH",
  "cwd": "$CWD",
  "captured_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Clean up old session directories that don't match current Claude session
# Only clean if there are old sessions (more than 10)
SESSIONS_DIR="$TEAM_DIR/sessions"
if [[ -d "$SESSIONS_DIR" ]]; then
  SESSION_COUNT=$(find "$SESSIONS_DIR" -maxdepth 1 -type d | wc -l)
  if [[ $SESSION_COUNT -gt 10 ]]; then
    # Keep only sessions from the last 7 days
    find "$SESSIONS_DIR" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
  fi
fi

exit 0
