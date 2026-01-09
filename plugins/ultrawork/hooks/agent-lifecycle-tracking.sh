#!/bin/bash

# Agent Lifecycle Tracking Hook (PreToolUse)
# Tracks when agents are spawned via Task tool during ultrawork sessions
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

# Only process Task tool usage - exit silently for other tools
if [[ "$TOOL" != "Task" ]]; then
  exit 0
fi

# Get session info
SESSION_ID="$ULTRAWORK_STDIN_SESSION_ID"

# No active ultrawork session - allow without tracking
if [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"

# Session file doesn't exist - allow without tracking
if [[ ! -f "$SESSION_FILE" ]]; then
  jq -n '{"decision": "allow"}'
  exit 0
fi

# Track during active phases (EXPLORATION, EXECUTION, VERIFICATION)
PHASE=$(jq -r '.phase // "unknown"' "$SESSION_FILE" 2>/dev/null)
if [[ "$PHASE" != "EXPLORATION" && "$PHASE" != "EXECUTION" && "$PHASE" != "VERIFICATION" ]]; then
  jq -n '{"decision": "allow"}'
  exit 0
fi

# Parse Task tool parameters
TASK_ID=$(echo "$HOOK_INPUT" | jq -r '.tool_input.task_id // ""')
DESCRIPTION=$(echo "$HOOK_INPUT" | jq -r '.tool_input.description // ""')

# If no task_id, this isn't a worker spawn (might be TaskCreate, TaskUpdate, etc.)
if [[ -z "$TASK_ID" ]]; then
  jq -n '{"decision": "allow"}'
  exit 0
fi

# Log agent spawn attempt
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Update session with agent spawn tracking (with locking)
(
  if acquire_session_lock "$SESSION_FILE"; then
    trap "release_session_lock '$SESSION_FILE'" EXIT

    TMP_FILE="${SESSION_FILE}.tmp"
    jq --arg ts "$TIMESTAMP" \
       --arg tid "$TASK_ID" \
       --arg desc "$DESCRIPTION" \
       '.evidence_log += [{
          timestamp: $ts,
          type: "agent_spawn_initiated",
          task_id: $tid,
          description: $desc
        }]' "$SESSION_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$SESSION_FILE"

    release_session_lock "$SESSION_FILE"
    trap - EXIT
  fi
) 2>/dev/null || true

# Allow the Task tool to proceed
jq -n '{"decision": "allow"}'

exit 0
