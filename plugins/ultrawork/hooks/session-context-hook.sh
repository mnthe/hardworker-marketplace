#!/bin/bash

# Ultrawork Session Context Hook
# Injects session state into every user message when ultrawork is active
# Now supports Session ID-based isolation for multi-session environments

set -euo pipefail

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# Get team and session info
TEAM_NAME=$(get_team_name)
SESSION_ID=$(get_current_session_id "$TEAM_NAME")

# No active session bound to this terminal - no injection needed
if [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID" "$TEAM_NAME")
SESSION_FILE="$SESSION_DIR/session.json"

# Session file doesn't exist - clean up binding and exit
if [[ ! -f "$SESSION_FILE" ]]; then
  unbind_terminal "$TEAM_NAME"
  exit 0
fi

# Parse session state
PHASE=$(grep -o '"phase": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")
GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")

# Terminal states - no injection needed
if [[ "$PHASE" == "COMPLETE" || "$PHASE" == "CANCELLED" || "$PHASE" == "FAILED" ]]; then
  exit 0
fi

# Parse options
SKIP_VERIFY=$(grep -o '"skip_verify": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")
PLAN_ONLY=$(grep -o '"plan_only": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")
MAX_WORKERS=$(grep -o '"max_workers": *[0-9]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "0")
AUTO_MODE=$(grep -o '"auto_mode": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")

# Count tasks and evidence
CHILD_TASKS=$(grep -o '"child_tasks": *\[[^]]*\]' "$SESSION_FILE" | grep -o '"[^"]*"' | wc -l | tr -d ' ' || echo "0")
EVIDENCE_COUNT=$(grep -c '"criteria":' "$SESSION_FILE" 2>/dev/null || echo "0")
PLANNER_STATUS=$(grep -o '"status": *"[^"]*"' "$SESSION_FILE" | head -1 | cut -d'"' -f4 || echo "unknown")

# Build context message based on phase
case "$PHASE" in
  PLANNING)
    if [[ "$AUTO_MODE" == "true" ]]; then
      NEXT_ACTION="1. Wait for planner agent to complete task graph
2. Once planner returns, update session.json with child_tasks
3. Transition to EXECUTION phase"
    else
      NEXT_ACTION="1. Run exploration (spawn ultrawork:explorer agents)
2. Read context.json and exploration/*.md
3. Present findings, clarify requirements with AskUserQuestion
4. Write design.md and create tasks with task-create.sh
5. Get user approval, then transition to EXECUTION phase"
    fi
    ;;
  EXECUTION)
    NEXT_ACTION="1. Check which child tasks are unblocked (no pending dependencies)
2. Spawn worker agents for unblocked tasks (max: ${MAX_WORKERS:-unlimited})
3. Collect evidence from completed workers
4. Update session.json with evidence_log entries
5. When ALL tasks complete, transition to VERIFICATION phase"
    ;;
  VERIFICATION)
    NEXT_ACTION="1. Spawn verifier agent to validate all criteria
2. Verifier checks evidence_log against success criteria
3. Verifier scans for blocked patterns
4. If PASS: mark phase=COMPLETE
5. If FAIL: mark phase=FAILED with failure_reason"
    ;;
  *)
    NEXT_ACTION="Unknown phase - check session.json"
    ;;
esac

# Build system message with session ID prominently displayed
read -r -d '' CONTEXT_MSG << EOF || true
<ultrawork-session>
ACTIVE ULTRAWORK SESSION
═══════════════════════════════════════════════════════════

Session ID: $SESSION_ID
Goal: $GOAL
Phase: $PHASE
Team: $TEAM_NAME
Tasks: $CHILD_TASKS
Evidence: $EVIDENCE_COUNT items

Options:
  auto_mode: $AUTO_MODE
  skip_verify: $SKIP_VERIFY
  plan_only: $PLAN_ONLY
  max_workers: ${MAX_WORKERS:-0}

───────────────────────────────────────────────────────────
NEXT ACTIONS REQUIRED:
$NEXT_ACTION

───────────────────────────────────────────────────────────
ZERO TOLERANCE RULES (ENFORCED):
✗ No "should work" - require command output evidence
✗ No "basic implementation" - complete work only
✗ No TODO/FIXME in code - finish everything
✗ No completion without verification

───────────────────────────────────────────────────────────
SESSION FILE OPERATIONS:

To update session state, use:
  Session file: $SESSION_FILE

To read current state:
  jq '.' "$SESSION_FILE"

───────────────────────────────────────────────────────────
COMMANDS:
  /ultrawork-status   - Check detailed progress
  /ultrawork-evidence - View collected evidence
  /ultrawork-cancel   - Cancel session

</ultrawork-session>
EOF

# Output JSON with system message injection
jq -n --arg msg "$CONTEXT_MSG" '{"systemMessage": $msg}'

exit 0
