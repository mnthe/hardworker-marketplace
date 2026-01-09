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
  exit 0
fi

# Plan-only mode - allow exit after planning
if [[ "$PLAN_ONLY" == "true" && "$PHASE" != "PLANNING" ]]; then
  exit 0
fi

# Skip-verify mode - allow exit after execution
if [[ "$SKIP_VERIFY" == "true" && "$PHASE" == "EXECUTION" ]]; then
  # Check if all tasks are done
  PENDING_TASKS=$(grep -c '"status": *"pending"' "$SESSION_FILE" 2>/dev/null || echo "0")
  IN_PROGRESS=$(grep -c '"status": *"in_progress"' "$SESSION_FILE" 2>/dev/null || echo "0")

  if [[ "$PENDING_TASKS" == "0" && "$IN_PROGRESS" == "0" ]]; then
    exit 0
  fi
fi

# Interactive mode planning - orchestrator does planning inline, don't block
if [[ "$PHASE" == "PLANNING" && "$AUTO_MODE" != "true" ]]; then
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
COMPLETED_TASKS=$(jq '[.child_tasks[]? | select(.status == "completed")] | length' "$SESSION_FILE" 2>/dev/null || echo "0")

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

# Check for retry marker (execute->verify loop)
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""')
if [[ -n "$TRANSCRIPT_PATH" && -f "$TRANSCRIPT_PATH" ]]; then
  # Check if last output contains retry marker
  if grep -q "__ULTRAWORK_RETRY__" "$TRANSCRIPT_PATH" 2>/dev/null; then
    ITERATION=$(jq -r '.iteration // 1' "$SESSION_FILE")
    MAX_ITERATIONS=$(jq -r '.options.max_iterations // 5' "$SESSION_FILE")

    if [[ $ITERATION -lt $MAX_ITERATIONS ]]; then
      # Continue with execution loop
      jq -n \
        --arg session_id "$SESSION_ID" \
        --arg goal "$GOAL" \
        --arg iteration "$ITERATION" \
        --arg max "$MAX_ITERATIONS" \
        '{
          "decision": "block",
          "reason": ("Continue execution after verification failure.\n\nIteration: " + $iteration + "/" + $max),
          "systemMessage": ("🔄 ULTRAWORK [" + $session_id + "]: Retry iteration " + $iteration + " - " + $goal)
        }'
      exit 0
    fi
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
