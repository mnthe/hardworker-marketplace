#!/bin/bash

# Ultrawork Stop Hook
# Prevents session exit when ultrawork session is active without verification
# v5.0: Uses session_id from stdin (multi-session safe)

set -euo pipefail

# Read stdin and extract session_id FIRST
HOOK_INPUT=$(cat)
export ULTRAWORK_STDIN_SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# Get session info
SESSION_ID="$ULTRAWORK_STDIN_SESSION_ID"

# No session_id - allow exit
if [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"

# Session file doesn't exist - not an ultrawork session, allow exit
if [[ ! -f "$SESSION_FILE" ]]; then
  exit 0
fi

# Parse session state
PHASE=$(grep -o '"phase": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")
GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
SKIP_VERIFY=$(grep -o '"skip_verify": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")
PLAN_ONLY=$(grep -o '"plan_only": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")
AUTO_MODE=$(grep -o '"auto_mode": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")

# Terminal states - allow exit
if [[ "$PHASE" == "COMPLETE" || "$PHASE" == "CANCELLED" || "$PHASE" == "FAILED" ]]; then
  echo '{}'
  exit 0
fi

# Plan-only mode - allow exit after planning
if [[ "$PLAN_ONLY" == "true" && "$PHASE" != "PLANNING" ]]; then
  echo '{}'
  exit 0
fi

# Skip-verify mode - allow exit after execution
if [[ "$SKIP_VERIFY" == "true" && "$PHASE" == "EXECUTION" ]]; then
  # Check if all tasks are done
  PENDING_TASKS=$(grep -c '"status": *"pending"' "$SESSION_FILE" 2>/dev/null || echo "0")
  IN_PROGRESS=$(grep -c '"status": *"in_progress"' "$SESSION_FILE" 2>/dev/null || echo "0")

  if [[ "$PENDING_TASKS" == "0" && "$IN_PROGRESS" == "0" ]]; then
    echo '{}'
    exit 0
  fi
fi

# Interactive mode planning - orchestrator does planning inline, don't block
if [[ "$PHASE" == "PLANNING" && "$AUTO_MODE" != "true" ]]; then
  echo '{}'
  exit 0
fi

# Active session not complete - block exit
case "$PHASE" in
  PLANNING)
    # Only reaches here if AUTO_MODE is true (planner agent running in background)
    REASON="Planner agent is creating task graph. Wait for planning to complete or use /ultrawork-cancel."
    SYSTEM_MSG="⚠️ ULTRAWORK [$SESSION_ID]: Planning in progress for '$GOAL'"
    ;;
  EXECUTION)
    REASON="Workers are implementing tasks. Wait for execution to complete or use /ultrawork-cancel."
    SYSTEM_MSG="⚠️ ULTRAWORK [$SESSION_ID]: Execution in progress for '$GOAL'"
    ;;
  VERIFICATION)
    REASON="Verifier is checking evidence. Wait for verification to complete or use /ultrawork-cancel."
    SYSTEM_MSG="⚠️ ULTRAWORK [$SESSION_ID]: Verification in progress for '$GOAL'"
    ;;
  *)
    REASON="Ultrawork session is active (phase: $PHASE). Complete the session or use /ultrawork-cancel."
    SYSTEM_MSG="⚠️ ULTRAWORK [$SESSION_ID]: Session active for '$GOAL'"
    ;;
esac

# Enhanced evidence validation
EVIDENCE_COUNT=$(jq '.evidence_log | length' "$SESSION_FILE" 2>/dev/null || echo "0")
# Count completed tasks from tasks directory (tasks are stored as individual files)
TASKS_DIR="$SESSION_DIR/tasks"
COMPLETED_TASKS=0
if [[ -d "$TASKS_DIR" ]]; then
  for task_file in "$TASKS_DIR"/*.json; do
    [[ -e "$task_file" ]] || continue
    task_status=$(jq -r '.status // "open"' "$task_file" 2>/dev/null || echo "open")
    [[ "$task_status" == "resolved" ]] && ((COMPLETED_TASKS++)) || true
  done
fi

# Check for blocked phrases in recent evidence
BLOCKED_PHRASES=("should work" "probably works" "basic implementation" "TODO:" "FIXME:" "you can extend")
BLOCKED_PHRASE_FOUND=""

for phrase in "${BLOCKED_PHRASES[@]}"; do
  if jq -e --arg phrase "$phrase" '.evidence_log[-5:][]? | .output? | select(. != null) | contains($phrase)' "$SESSION_FILE" >/dev/null 2>&1; then
    BLOCKED_PHRASE_FOUND="$phrase"
    break
  fi
done

# Block if blocked phrases detected in recent evidence
if [[ -n "$BLOCKED_PHRASE_FOUND" ]]; then
  REASON="Detected blocked phrase '$BLOCKED_PHRASE_FOUND' in recent outputs. Complete work before exiting."
  SYSTEM_MSG="⚠️ ULTRAWORK [$SESSION_ID]: Incomplete work detected"

  jq -n \
    --arg reason "$REASON" \
    --arg msg "$SYSTEM_MSG" \
    --arg session_id "$SESSION_ID" \
    --arg goal "$GOAL" \
    --arg phrase "$BLOCKED_PHRASE_FOUND" \
    '{
      "decision": "block",
      "reason": ("INCOMPLETE WORK DETECTED\n\nSession ID: " + $session_id + "\nGoal: " + $goal + "\n\nBlocked phrase found: \"" + $phrase + "\"\n\n" + $reason + "\n\nZERO TOLERANCE RULES:\n✗ No \"should work\" - require command output evidence\n✗ No \"basic implementation\" - complete work only\n✗ No TODO/FIXME in code - finish everything\n\nCommands:\n  /ultrawork-status   - Check progress\n  /ultrawork-evidence - View evidence\n  /ultrawork-cancel   - Cancel session"),
      "systemMessage": $msg
    }'
  exit 0
fi

# For EXECUTION phase, require evidence for completed tasks
if [[ "$PHASE" == "EXECUTION" ]]; then
  # Require at least 1 evidence entry per completed task
  if [[ $COMPLETED_TASKS -gt 0 && $EVIDENCE_COUNT -lt $COMPLETED_TASKS ]]; then
    REASON="Completed tasks without sufficient evidence. Found $EVIDENCE_COUNT evidence entries for $COMPLETED_TASKS completed tasks."
    SYSTEM_MSG="⚠️ ULTRAWORK [$SESSION_ID]: Insufficient evidence"

    jq -n \
      --arg reason "$REASON" \
      --arg msg "$SYSTEM_MSG" \
      --arg session_id "$SESSION_ID" \
      --arg goal "$GOAL" \
      --arg evidence "$EVIDENCE_COUNT" \
      --arg tasks "$COMPLETED_TASKS" \
      '{
        "decision": "block",
        "reason": ("INSUFFICIENT EVIDENCE\n\nSession ID: " + $session_id + "\nGoal: " + $goal + "\nCompleted tasks: " + $tasks + "\nEvidence collected: " + $evidence + "\n\n" + $reason + "\n\nEvery completed task requires evidence:\n• Test results (command output)\n• File operations (read/write/edit)\n• Verification commands\n\nCommands:\n  /ultrawork-status   - Check progress\n  /ultrawork-evidence - View evidence\n  /ultrawork-cancel   - Cancel session"),
        "systemMessage": $msg
      }'
    exit 0
  fi
fi

# Ralph Loop: Check session status for auto-continuation
AUTO_LOOP=$(jq -r '.options.auto_loop // false' "$SESSION_FILE" 2>/dev/null || echo "false")
ITERATION=$(jq -r '.iteration // 1' "$SESSION_FILE" 2>/dev/null || echo "1")
MAX_ITERATIONS=$(jq -r '.options.max_iterations // 10' "$SESSION_FILE" 2>/dev/null || echo "10")

if [[ "$AUTO_LOOP" == "true" ]] && [[ "$PHASE" == "EXECUTION" || "$PHASE" == "VERIFICATION" ]]; then
  # Count pending/in_progress tasks
  TASKS_DIR="$SESSION_DIR/tasks"
  PENDING_COUNT=0
  IN_PROGRESS_COUNT=0

  if [[ -d "$TASKS_DIR" ]]; then
    for task_file in "$TASKS_DIR"/*.json; do
      [[ -e "$task_file" ]] || continue
      task_status=$(jq -r '.status // "open"' "$task_file" 2>/dev/null || echo "open")
      case "$task_status" in
        open|pending) ((PENDING_COUNT++)) || true ;;
        in_progress) ((IN_PROGRESS_COUNT++)) || true ;;
      esac
    done
  fi

  REMAINING=$((PENDING_COUNT + IN_PROGRESS_COUNT))

  # If tasks remain and under max iterations, continue
  if [[ $REMAINING -gt 0 && $ITERATION -lt $MAX_ITERATIONS ]]; then
    # Increment iteration
    jq --argjson iter "$((ITERATION + 1))" '.iteration = $iter' "$SESSION_FILE" > "${SESSION_FILE}.tmp"
    mv "${SESSION_FILE}.tmp" "$SESSION_FILE"

    jq -n \
      --arg session_id "$SESSION_ID" \
      --arg goal "$GOAL" \
      --arg iteration "$ITERATION" \
      --arg max "$MAX_ITERATIONS" \
      --arg pending "$PENDING_COUNT" \
      --arg in_progress "$IN_PROGRESS_COUNT" \
      '{
        "decision": "block",
        "reason": ("RALPH LOOP: Continuing execution\n\nIteration: " + $iteration + "/" + $max + "\nPending tasks: " + $pending + "\nIn progress: " + $in_progress + "\n\nContinue working on remaining tasks."),
        "systemMessage": ("🔄 ULTRAWORK [" + $session_id + "]: Loop " + $iteration + "/" + $max + " - " + $pending + " tasks remaining")
      }'
    exit 0
  fi
fi

# Output JSON to block the stop
jq -n \
  --arg reason "$REASON" \
  --arg msg "$SYSTEM_MSG" \
  --arg session_id "$SESSION_ID" \
  --arg goal "$GOAL" \
  --arg phase "$PHASE" \
  --arg evidence "$EVIDENCE_COUNT" \
  '{
    "decision": "block",
    "reason": ("ULTRAWORK SESSION ACTIVE\n\nSession ID: " + $session_id + "\nGoal: " + $goal + "\nPhase: " + $phase + "\nEvidence collected: " + $evidence + "\n\n" + $reason + "\n\nCommands:\n  /ultrawork-status   - Check progress\n  /ultrawork-evidence - View evidence\n  /ultrawork-cancel   - Cancel session"),
    "systemMessage": $msg
  }'

exit 0
