#!/bin/bash

# Gate Enforcement Hook (PreToolUse)
# Blocks Edit/Write during PLANNING phase (except design.md, session files)
# Enforces TDD order: test files must be written before implementation
# v6.0: Added TDD enforcement

set -euo pipefail

# Read stdin and extract session_id FIRST
HOOK_INPUT=$(cat)
export ULTRAWORK_STDIN_SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# ============================================================================
# TDD Enforcement Functions
# ============================================================================

# Check if a file path looks like a test file
is_test_file() {
  local file_path="$1"
  [[ -z "$file_path" ]] && return 1

  # Common test file patterns
  if [[ "$file_path" == *".test."* ]] || \
     [[ "$file_path" == *".spec."* ]] || \
     [[ "$file_path" == *"__tests__/"* ]] || \
     [[ "$file_path" == *"/tests/"* ]] || \
     [[ "$file_path" == *"/test/"* ]] || \
     [[ "$file_path" == *"_test.js" ]] || \
     [[ "$file_path" == *"_test.ts" ]] || \
     [[ "$file_path" == *"_test.py" ]]; then
    return 0
  fi
  return 1
}

# Get the current in-progress TDD task for the session
# Returns task JSON on stdout, empty if not found
get_current_tdd_task() {
  local session_id="$1"
  local session_dir
  session_dir=$(get_session_dir "$session_id" 2>/dev/null) || return 1

  local tasks_dir="$session_dir/tasks"
  [[ ! -d "$tasks_dir" ]] && return 1

  # Find in-progress TDD task
  for task_file in "$tasks_dir"/*.json; do
    [[ ! -f "$task_file" ]] && continue

    local approach status
    approach=$(jq -r '.approach // "standard"' "$task_file" 2>/dev/null) || continue
    status=$(jq -r '.status // ""' "$task_file" 2>/dev/null) || continue

    if [[ "$approach" == "tdd" && "$status" == "in_progress" ]]; then
      cat "$task_file"
      return 0
    fi
  done

  return 1
}

# Check if TDD-RED evidence exists for a task
# Input: task JSON on stdin
has_tdd_red_evidence() {
  local task_json="$1"

  # Check if any evidence contains TDD-RED
  local has_red
  has_red=$(echo "$task_json" | jq -r '.evidence // [] | map(select(.description | contains("TDD-RED"))) | length' 2>/dev/null) || return 1

  [[ "$has_red" -gt 0 ]] && return 0
  return 1
}

# Create TDD violation response
create_tdd_violation_response() {
  local tool="$1"
  local file_path="$2"
  local task_subject="$3"
  local task_id="$4"

  local reason="⛔ TDD VIOLATION: Write test first!

Task \"$task_subject\" uses TDD approach.
You must write and run a failing test BEFORE implementation.

Current file: $file_path
Task ID: $task_id
Task approach: tdd

TDD Workflow:
1. 🔴 RED: Write test file first → run test → verify it FAILS
2. 🟢 GREEN: Write implementation → run test → verify it PASSES
3. 🔄 REFACTOR: Improve code → verify tests still pass

Current state: Missing TDD-RED evidence (test not written/run yet)

To proceed:
1. Write your test file first (*.test.ts, *.spec.js, etc.)
2. Run the test and record the failure
3. Then implement the feature"

  jq -n \
    --arg reason "$reason" \
    '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": $reason
      }
    }'
}

# ============================================================================
# Main Logic
# ============================================================================

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

# Get file path from tool input (needed for both phase checks)
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // ""')

# Helper: Check if file is allowed during PLANNING
is_file_allowed() {
  local fp="$1"
  [[ "$fp" == *"design.md"* ]] && return 0
  [[ "$fp" == *"session.json"* ]] && return 0
  [[ "$fp" == *"context.json"* ]] && return 0
  [[ "$fp" == *"/exploration/"* ]] && return 0
  [[ "$fp" == *"/.claude/ultrawork/"* ]] && return 0
  return 1
}

# ============================================================================
# Phase 1: PLANNING phase enforcement
# ============================================================================
if [[ "$PHASE" == "PLANNING" ]]; then
  # Check if file is allowed during PLANNING
  if is_file_allowed "$FILE_PATH"; then
    echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}'
    exit 0
  fi

  # Block with clear message
  REASON="⛔ GATE VIOLATION: $TOOL blocked in PLANNING phase.

Current Phase: PLANNING
Blocked Tool: $TOOL
Target File: $FILE_PATH

Session ID: $SESSION_ID
Session File: $SESSION_FILE

Direct file modifications are prohibited during PLANNING phase.

To proceed, either:
1. Complete planning → transition to EXECUTION phase
2. Cancel session: /ultrawork-cancel

If this is unexpected (orphaned session), cancel with:
  /ultrawork-cancel

Allowed files during PLANNING:
- design.md, session.json, context.json, exploration/*.md"

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
fi

# ============================================================================
# Phase 2: TDD enforcement during EXECUTION phase
# ============================================================================
if [[ "$PHASE" == "EXECUTION" ]]; then
  # Check for current TDD task
  TDD_TASK=$(get_current_tdd_task "$SESSION_ID" 2>/dev/null) || TDD_TASK=""

  if [[ -n "$TDD_TASK" ]]; then
    # If writing to a non-test file, check TDD-RED evidence
    if ! is_test_file "$FILE_PATH" && ! is_file_allowed "$FILE_PATH"; then
      # Check if TDD-RED evidence exists
      if ! has_tdd_red_evidence "$TDD_TASK"; then
        # Block: trying to write implementation before test
        TASK_SUBJECT=$(echo "$TDD_TASK" | jq -r '.subject // "Unknown"')
        TASK_ID=$(echo "$TDD_TASK" | jq -r '.id // "Unknown"')
        create_tdd_violation_response "$TOOL" "$FILE_PATH" "$TASK_SUBJECT" "$TASK_ID"
        exit 0
      fi
    fi
  fi
fi

# Allow all other cases
echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}'
exit 0
