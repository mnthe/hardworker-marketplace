#!/bin/bash

# Gate Enforcement Hook (PreToolUse)
# Blocks Edit/Write during PLANNING phase (except design.md, session files)
# v5.0: Uses session_id from stdin (multi-session safe)

set -euo pipefail

# Read stdin and extract session_id FIRST
HOOK_INPUT=$(cat)
export ULTRAWORK_STDIN_SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# Parse tool from hook input
TOOL=$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""')

# Only process Edit and Write tools
if [[ "$TOOL" != "Edit" && "$TOOL" != "Write" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}'
  exit 0
fi

# Get session info
SESSION_ID="$ULTRAWORK_STDIN_SESSION_ID"

# No session - allow
if [[ -z "$SESSION_ID" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}'
  exit 0
fi

# Check if ultrawork session is active
if ! is_session_active_by_id "$SESSION_ID"; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}'
  exit 0  # No active session - allow
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"
PHASE=$(jq -r '.phase // ""' "$SESSION_FILE" 2>/dev/null || echo "")

# Only enforce during PLANNING phase
if [[ "$PHASE" != "PLANNING" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}'
  exit 0
fi

# Get file path from tool input
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // ""')

# Allowed files during PLANNING:
# - design.md (planning document)
# - session.json, context.json (session state)
# - exploration/*.md (explorer output)
# - tasks/*.json (task definitions via task-create.sh is OK, but direct Edit is blocked)

ALLOWED=false

# Check allowed patterns
if [[ "$FILE_PATH" == *"design.md"* ]]; then
  ALLOWED=true
elif [[ "$FILE_PATH" == *"session.json"* ]]; then
  ALLOWED=true
elif [[ "$FILE_PATH" == *"context.json"* ]]; then
  ALLOWED=true
elif [[ "$FILE_PATH" == *"/exploration/"* ]]; then
  ALLOWED=true
elif [[ "$FILE_PATH" == *"/.claude/ultrawork/"* ]]; then
  # Session directory files are allowed
  ALLOWED=true
fi

if [[ "$ALLOWED" == "true" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}'
  exit 0
fi

# Block with clear message
REASON="⛔ GATE VIOLATION: $TOOL blocked in PLANNING phase.

Current Phase: PLANNING
Blocked Tool: $TOOL
Target File: $FILE_PATH

Direct file modifications are prohibited during PLANNING phase.

Correct procedure:
1. Write design.md (Write allowed)
2. Create tasks with task-create.sh
3. Get user approval
4. Transition to EXECUTION phase
5. Worker agent performs actual work

Allowed files:
- design.md (planning document)
- session.json, context.json (session state)
- exploration/*.md (exploration results)"

jq -n \
  --arg reason "$REASON" \
  '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": $reason
    }
  }'

exit 0
