#!/bin/bash

# Gate Status Notification Hook
# Notifies AI when exploration_stage changes (gates unlock)
# v5.0: Uses session_id from stdin (multi-session safe)

set -euo pipefail

# Read stdin and extract session_id FIRST
HOOK_INPUT=$(cat)
export ULTRAWORK_STDIN_SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# Parse tool name
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")

# Only process Task tool completions
if [[ "$TOOL_NAME" != "Task" && "$TOOL_NAME" != "task" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}'
  exit 0
fi

# Get session info
SESSION_ID="$ULTRAWORK_STDIN_SESSION_ID"

# No active session - exit
if [[ -z "$SESSION_ID" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}'
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"

# Session file doesn't exist - exit
if [[ ! -f "$SESSION_FILE" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}'
  exit 0
fi

# Parse current state
PHASE=$(jq -r '.phase // ""' "$SESSION_FILE" 2>/dev/null || echo "")
EXPLORATION_STAGE=$(jq -r '.exploration_stage // "not_started"' "$SESSION_FILE" 2>/dev/null || echo "not_started")

# Only notify during PLANNING phase
if [[ "$PHASE" != "PLANNING" ]]; then
  echo '{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}'
  exit 0
fi

# Check if this was an explorer task
TASK_OUTPUT=$(echo "$HOOK_INPUT" | jq -r '.tool_response // ""' 2>/dev/null || echo "")
SUBAGENT_TYPE=$(echo "$HOOK_INPUT" | jq -r '.tool_input.subagent_type // ""' 2>/dev/null || echo "")

# Detect explorer completion
if [[ "$SUBAGENT_TYPE" == *"explorer"* ]] || [[ "$TASK_OUTPUT" == *"EXPLORER_ID"* ]] || [[ "$TASK_OUTPUT" == *"exploration"* ]]; then

  # Check for overview.md to detect overview completion
  if [[ -f "$SESSION_DIR/exploration/overview.md" && "$EXPLORATION_STAGE" == "not_started" ]]; then
    # Update exploration_stage to "overview"
    TMP_FILE="${SESSION_FILE}.tmp"
    jq '.exploration_stage = "overview"' "$SESSION_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$SESSION_FILE"

    # Notify AI
    jq -n '{
      "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": "🔓 GATE UPDATE\n═══════════════════════════════════════\nGATE 1 (Overview) → COMPLETE ✓\nGATE 2 (Targeted Exploration) → UNLOCKED\n═══════════════════════════════════════\n\nNEXT ACTION:\n1. Read exploration/overview.md\n2. Analyze goal + overview → generate hints\n3. Spawn targeted explorers for each hint"
      }
    }'
    exit 0
  fi

  # Check context.json for exploration_complete
  CONTEXT_FILE="$SESSION_DIR/context.json"
  if [[ -f "$CONTEXT_FILE" ]]; then
    EXPLORATION_COMPLETE=$(jq -r '.exploration_complete // false' "$CONTEXT_FILE" 2>/dev/null || echo "false")

    if [[ "$EXPLORATION_COMPLETE" == "true" && "$EXPLORATION_STAGE" != "complete" ]]; then
      # Update exploration_stage to "complete"
      TMP_FILE="${SESSION_FILE}.tmp"
      jq '.exploration_stage = "complete"' "$SESSION_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$SESSION_FILE"

      # Notify AI
      jq -n '{
        "hookSpecificOutput": {
          "hookEventName": "PostToolUse",
          "additionalContext": "🔓 GATE UPDATE\n═══════════════════════════════════════\nGATE 1-2 (Exploration) → COMPLETE ✓\nGATE 3 (Planning) → UNLOCKED\n═══════════════════════════════════════\n\nNEXT ACTION:\n1. Read context.json and exploration/*.md\n2. Present findings to user\n3. AskUserQuestion for clarifications\n4. Write design.md\n5. Create tasks with task-create.sh\n6. Get user approval"
        }
      }'
      exit 0
    fi
  fi
fi

# Check for design.md and tasks to detect planning completion
if [[ "$EXPLORATION_STAGE" == "complete" ]]; then
  DESIGN_EXISTS=$([[ -f "$SESSION_DIR/design.md" ]] && echo "true" || echo "false")
  TASKS_EXIST=$([[ -d "$SESSION_DIR/tasks" && -n "$(ls -A "$SESSION_DIR/tasks" 2>/dev/null)" ]] && echo "true" || echo "false")

  if [[ "$DESIGN_EXISTS" == "true" && "$TASKS_EXIST" == "true" ]]; then
    # Notify AI that planning is complete
    jq -n '{
      "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": "🔓 GATE UPDATE\n═══════════════════════════════════════\nGATE 3 (Planning) → COMPLETE ✓\nGATE 4 (Execution) → READY\n═══════════════════════════════════════\n\nNEXT ACTION:\nAsk user for plan approval, then:\nsession-update.sh --session SESSION_DIR --phase EXECUTION"
      }
    }'
    exit 0
  fi
fi

# No notification needed
echo '{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}'

exit 0
