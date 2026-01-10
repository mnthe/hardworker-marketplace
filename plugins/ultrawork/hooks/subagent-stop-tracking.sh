#!/bin/bash

# Subagent Stop Tracking Hook
# Captures worker agent results when they complete and updates session state
# v5.0: Uses session_id from stdin (multi-session safe)

set -euo pipefail

# Read stdin and extract session_id FIRST
HOOK_INPUT=$(cat)
export ULTRAWORK_STDIN_SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# Parse hook input fields
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // ""')
AGENT_OUTPUT=$(echo "$HOOK_INPUT" | jq -r '.output // ""')
TASK_ID=$(echo "$HOOK_INPUT" | jq -r '.task_id // ""')

# Get session info
SESSION_ID="$ULTRAWORK_STDIN_SESSION_ID"

# No active ultrawork session - not an ultrawork worker
if [[ -z "$SESSION_ID" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "SubagentStop"}}'
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"

# Session file doesn't exist - exit silently
if [[ ! -f "$SESSION_FILE" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "SubagentStop"}}'
  exit 0
fi

# Check if this agent is tracked as an ultrawork worker
WORKER_EXISTS=$(jq -e --arg aid "$AGENT_ID" '
  .workers // [] | any(.agent_id == $aid)
' "$SESSION_FILE" 2>/dev/null || echo "false")

if [[ "$WORKER_EXISTS" != "true" ]]; then
  # Check if this task_id exists in our session (tasks are stored as individual files)
  if [[ -n "$TASK_ID" ]]; then
    TASK_FILE="$SESSION_DIR/tasks/$TASK_ID.json"
    if [[ ! -f "$TASK_FILE" ]]; then
      echo '{"hookSpecificOutput": {"hookEventName": "SubagentStop"}}'
      exit 0  # Not an ultrawork worker
    fi
  else
    echo '{"hookSpecificOutput": {"hookEventName": "SubagentStop"}}'
    exit 0  # No task_id and not in workers array
  fi
fi

# Parse worker output for status
STATUS="completed"
FAILURE_REASON=""

if echo "$AGENT_OUTPUT" | grep -qi "task failed\|failed\|error"; then
  STATUS="failed"
  FAILURE_REASON=$(echo "$AGENT_OUTPUT" | grep -i "fail\|error" | head -3 | tr '\n' ' ')
fi

# Extract task ID if not provided
if [[ -z "$TASK_ID" ]]; then
  TASK_ID=$(jq -r --arg aid "$AGENT_ID" '
    .workers[] | select(.agent_id == $aid) | .task_id
  ' "$SESSION_FILE" 2>/dev/null || echo "")
fi

if [[ -z "$TASK_ID" ]]; then
  # Try to extract from agent output
  TASK_ID=$(echo "$AGENT_OUTPUT" | grep -oP 'Task.*?:\s*\K[A-Z]-\d+' | head -1 || echo "")
fi

# Timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Update worker status and task status in session
if [[ -n "$TASK_ID" ]]; then
  # Update with locking
  (
    if acquire_session_lock "$SESSION_FILE"; then
      trap "release_session_lock '$SESSION_FILE'" EXIT

      TMP_FILE="${SESSION_FILE}.tmp"
      jq --arg aid "$AGENT_ID" \
         --arg tid "$TASK_ID" \
         --arg status "$STATUS" \
         --arg ts "$TIMESTAMP" \
         --arg failure_reason "$FAILURE_REASON" \
         --arg output "$AGENT_OUTPUT" '
        # Update or add worker entry
        if (.workers // []) | any(.agent_id == $aid) then
          (.workers[] | select(.agent_id == $aid)) |= (
            .status = $status |
            .completed_at = $ts |
            if $failure_reason != "" then .failure_reason = $failure_reason else . end
          )
        else
          .workers = ((.workers // []) + [{
            agent_id: $aid,
            task_id: $tid,
            started_at: $ts,
            completed_at: $ts,
            status: $status
          }])
        end |
        # Add evidence log entry
        .evidence_log += [{
          timestamp: $ts,
          type: "agent_completed",
          agent_id: $aid,
          task_id: $tid,
          status: $status,
          summary: ($output | split("\n") | .[0:3] | join(" "))
        }]
      ' "$SESSION_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$SESSION_FILE"

      release_session_lock "$SESSION_FILE"
      trap - EXIT
    fi
  ) 2>/dev/null || {
    echo "Failed to update session for agent $AGENT_ID" >&2
  }
fi

# Log completion for debugging
echo "Agent $AGENT_ID completed (task: $TASK_ID, status: $STATUS)" >&2

# Output hookSpecificOutput
echo '{"hookSpecificOutput": {"hookEventName": "SubagentStop"}}'

exit 0
