#!/bin/bash

# Ultrawork Session Context Hook
# Injects session state into every user message when ultrawork is active
# v5.0: Uses session_id from stdin (multi-session safe)

set -euo pipefail

# Read stdin and extract session_id FIRST (before sourcing utils)
HOOK_INPUT=$(cat)
export ULTRAWORK_STDIN_SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# Get session info from stdin
SESSION_ID="$ULTRAWORK_STDIN_SESSION_ID"

# No session_id in stdin - no injection needed
if [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"

# Session file doesn't exist - still provide session_id for new sessions
if [[ ! -f "$SESSION_FILE" ]]; then
  # Provide session_id so AI can pass it to setup-ultrawork.sh
  jq -n --arg sid "$SESSION_ID" '{"systemMessage": ("CLAUDE_SESSION_ID: " + $sid + "\nUse this when calling ultrawork scripts: --session " + $sid)}'
  exit 0
fi

# Parse session state
PHASE=$(grep -o '"phase": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")
GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
EXPLORATION_STAGE=$(grep -o '"exploration_stage": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "not_started")

# Terminal states - no injection needed
if [[ "$PHASE" == "COMPLETE" || "$PHASE" == "CANCELLED" || "$PHASE" == "FAILED" ]]; then
  exit 0
fi

# Parse options
SKIP_VERIFY=$(grep -o '"skip_verify": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")
PLAN_ONLY=$(grep -o '"plan_only": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")
MAX_WORKERS=$(grep -o '"max_workers": *[0-9]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "0")
AUTO_MODE=$(grep -o '"auto_mode": *[^,}]*' "$SESSION_FILE" | cut -d':' -f2 | tr -d ' ' || echo "false")

# Count tasks and evidence (tr -d '[:space:]' removes all whitespace including newlines)
CHILD_TASKS=$(grep -o '"child_tasks": *\[[^]]*\]' "$SESSION_FILE" 2>/dev/null | grep -o '"[^"]*"' 2>/dev/null | wc -l | tr -d '[:space:]') || CHILD_TASKS="0"
EVIDENCE_COUNT=$(grep -c '"criteria":' "$SESSION_FILE" 2>/dev/null | tr -d '[:space:]') || EVIDENCE_COUNT="0"
PLANNER_STATUS=$(grep -o '"status": *"[^"]*"' "$SESSION_FILE" | head -1 | cut -d'"' -f4 || echo "unknown")

# Build context message based on phase
case "$PHASE" in
  PLANNING)
    if [[ "$AUTO_MODE" == "true" ]]; then
      NEXT_ACTION="1. Wait for planner agent to complete task graph
2. Once planner returns, update session.json with child_tasks
3. Transition to EXECUTION phase"
    else
      # Gate system for interactive planning
      case "$EXPLORATION_STAGE" in
        not_started)
          NEXT_ACTION="⛔ GATE SYSTEM - Skill-based Exploration

┌─ GATE 1: OVERVIEW [CURRENT] ────────────────────────┐
│                                                      │
│ FIRST ACTION (required):                             │
│ Skill(skill=\"ultrawork:overview-exploration\")        │
│                                                      │
│ Direct exploration (no agent spawn):                 │
│ ✓ Use Glob, Read, Grep to understand project        │
│ ✓ Write overview.md                                  │
│ ✗ No file edits (Edit, Write - except overview.md)  │
│                                                      │
│ Follow the procedure guided by the skill.           │
└──────────────────────────────────────────────────────┘

┌─ GATE 2: TARGETED EXPLORATION [LOCKED] ─────────────┐
│ Unlocks when: overview.md exists                     │
│ Agent: Task(subagent_type=\"ultrawork:explorer\")      │
└──────────────────────────────────────────────────────┘

┌─ GATE 3: PLANNING [LOCKED] ─────────────────────────┐
│ Unlocks when: exploration_stage == \"complete\"        │
└──────────────────────────────────────────────────────┘

┌─ GATE 4: EXECUTION [LOCKED] ────────────────────────┐
│ Unlocks when: design.md + tasks/*.json exist         │
└──────────────────────────────────────────────────────┘"
          ;;
        overview)
          NEXT_ACTION="⛔ GATE SYSTEM - You CANNOT skip gates

┌─ GATE 1: EXPLORATION [COMPLETE] ✓ ──────────────────┐
└──────────────────────────────────────────────────────┘

┌─ GATE 2: TARGETED EXPLORATION [CURRENT] ────────────┐
│                                                      │
│ 1. Read exploration/overview.md                      │
│ 2. Analyze goal + overview → generate search hints   │
│ 3. Spawn targeted explorers:                         │
│                                                      │
│ for hint in hints:                                   │
│   Task(                                              │
│     subagent_type=\"ultrawork:explorer\",              │
│     model=\"haiku\",                                   │
│     run_in_background=True,                          │
│     prompt=\"SESSION_ID: $SESSION_ID                  │
│             EXPLORER_ID: exp-{i}                     │
│             SEARCH_HINT: {hint}\"                     │
│   )                                                  │
│                                                      │
│ ALLOWED: Read overview.md, spawn explorers           │
│ BLOCKED: Direct exploration, file edits              │
└──────────────────────────────────────────────────────┘

┌─ GATE 3: PLANNING [LOCKED] ─────────────────────────┐
│ Unlocks when: exploration_stage == \"complete\"        │
└──────────────────────────────────────────────────────┘"
          ;;
        analyzing|targeted)
          NEXT_ACTION="⛔ GATE SYSTEM

┌─ GATE 1-2: EXPLORATION [IN PROGRESS] ───────────────┐
│ Stage: $EXPLORATION_STAGE                            │
│ Wait for all explorers to complete                   │
│ Poll with: TaskOutput(task_id=..., block=False)      │
└──────────────────────────────────────────────────────┘

┌─ GATE 3: PLANNING [LOCKED] ─────────────────────────┐
│ Unlocks when: exploration_stage == \"complete\"        │
└──────────────────────────────────────────────────────┘"
          ;;
        complete)
          NEXT_ACTION="⛔ GATE SYSTEM

┌─ GATE 1-2: EXPLORATION [COMPLETE] ✓ ────────────────┐
└──────────────────────────────────────────────────────┘

┌─ GATE 3: PLANNING [CURRENT] ────────────────────────┐
│                                                      │
│ 1. Read context.json and exploration/*.md            │
│ 2. Present findings to user                          │
│ 3. AskUserQuestion for clarifications                │
│ 4. Write design.md                                   │
│ 5. Create tasks with task-create.sh (NOT TodoWrite)  │
│ 6. Get user approval                                 │
│                                                      │
│ ALLOWED: Read exploration/*, AskUserQuestion,        │
│          Write design.md, task-create.sh             │
│ BLOCKED: Direct code edits, TodoWrite for tasks      │
└──────────────────────────────────────────────────────┘

┌─ GATE 4: EXECUTION [LOCKED] ────────────────────────┐
│ Unlocks when: design.md + tasks/*.json + approval    │
└──────────────────────────────────────────────────────┘"
          ;;
        *)
          NEXT_ACTION="Unknown exploration_stage: $EXPLORATION_STAGE - check session.json"
          ;;
      esac
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
╔═══════════════════════════════════════════════════════════╗
║ ⚠️  ULTRAWORK SESSION ACTIVE - DO NOT IGNORE THIS         ║
║                                                           ║
║ This message persists across conversation compaction.     ║
║ You MUST follow the ultrawork protocol below.             ║
║ If unsure about previous context, read session.json.      ║
╚═══════════════════════════════════════════════════════════╝

Session ID: $SESSION_ID
Goal: $GOAL
Phase: $PHASE
Exploration: $EXPLORATION_STAGE
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
