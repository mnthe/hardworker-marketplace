#!/bin/bash

# Ultrawork Setup Script
# Creates session state for ultrawork mode with Session ID isolation

set -euo pipefail

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

# Parse arguments
GOAL_PARTS=()
MAX_WORKERS=0
MAX_ITERATIONS=5
SKIP_VERIFY=false
PLAN_ONLY=false
AUTO_MODE=false
FORCE=false
RESUME=false
SESSION_ID_ARG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 ULTRAWORK - Strict Verification-First Development Mode
═══════════════════════════════════════════════════════════

USAGE:
  /ultrawork [OPTIONS] <GOAL...>

ARGUMENTS:
  GOAL...    Task description (can be multiple words without quotes)

OPTIONS:
  --max-workers <n>      Maximum parallel workers (default: unlimited)
  --max-iterations <n>   Max execute→verify loops (default: 5)
  --skip-verify          Skip verification phase (fast mode)
  --plan-only            Only run planner, don't execute tasks
  --auto                 Skip plan confirmation, run automatically
  --force                Force start even if active session exists
  --resume               Resume cancelled/failed session
  --session <id>         Resume specific session by ID
  -h, --help             Show this help message

───────────────────────────────────────────────────────────
 SESSION BINDING
───────────────────────────────────────────────────────────

Ultrawork sessions are bound to Claude Code sessions.
This means:
  • Same Claude session = same ultrawork session
  • Session persists across terminal restarts
  • New Claude session = can start new ultrawork session

Session structure:
  ~/.claude/ultrawork/<team>/
    ├── .claude-session   # Current Claude session ID
    └── sessions/
        └── <claude-session-id>/
            ├── session.json    # Metadata
            ├── context.json    # Explorer findings
            └── tasks/
                ├── 1.json      # Task files
                └── verify.json

───────────────────────────────────────────────────────────
 WHAT IT DOES
───────────────────────────────────────────────────────────

Ultrawork enforces rigorous development practices:

  ✓ Mandatory planning via planner agent (opus)
  ✓ Success criteria defined BEFORE implementation
  ✓ Evidence collection for every criterion
  ✓ Zero tolerance for partial completion
  ✓ Parallel worker execution for speed

───────────────────────────────────────────────────────────
 WORKFLOW
───────────────────────────────────────────────────────────

  1. PLANNING      Planner agent creates task graph
                   → Spawns explorers for context
                   → Defines success criteria per task
                   → Sets up dependencies

  2. EXECUTION     Workers implement tasks in parallel
                   → Each worker collects evidence
                   → Reports results with proof

  3. VERIFICATION  Verifier agent validates all criteria
                   → Scans for blocked patterns
                   → Runs tests and builds
                   → Makes pass/fail determination

  4. COMPLETE      All criteria met with evidence
                   → Session marked complete
                   → Summary reported

───────────────────────────────────────────────────────────
 EXAMPLES
───────────────────────────────────────────────────────────

  Basic usage:
    /ultrawork implement user authentication with JWT

  Limit workers:
    /ultrawork --max-workers 3 add unit tests for all services

  Plan only (dry run):
    /ultrawork --plan-only refactor the database layer

  Fast mode (skip verification):
    /ultrawork --skip-verify fix typo in README

  Auto mode (no confirmation):
    /ultrawork --auto implement user login

  Force restart:
    /ultrawork --force implement new feature

  Resume session:
    /ultrawork --resume

  Resume specific session:
    /ultrawork --session abc1234 --resume

───────────────────────────────────────────────────────────
 ZERO TOLERANCE RULES
───────────────────────────────────────────────────────────

  These phrases BLOCK completion:
    ✗ "should work"      → Require evidence
    ✗ "basic impl"       → Complete work only
    ✗ "TODO/FIXME"       → Finish everything
    ✗ "you can extend"   → Not your job

───────────────────────────────────────────────────────────
 RELATED COMMANDS
───────────────────────────────────────────────────────────

  /ultrawork-status     Check current phase and progress
  /ultrawork-evidence   View collected evidence
  /ultrawork-cancel     Cancel session

───────────────────────────────────────────────────────────
 SESSION FILES
───────────────────────────────────────────────────────────

  Location: ~/.claude/ultrawork/<team>/sessions/<session-id>/
    ├── session.json    # Metadata and phase
    ├── context.json    # Explorer findings
    └── tasks/          # Individual task files

  Team is auto-detected from git repository name.
  Session ID is bound to Claude Code session ID.

═══════════════════════════════════════════════════════════
HELP_EOF
      exit 0
      ;;
    --max-workers)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --max-workers requires a number argument" >&2
        echo "" >&2
        echo "   Valid examples:" >&2
        echo "     --max-workers 3" >&2
        echo "     --max-workers 5" >&2
        echo "     --max-workers 0  (unlimited)" >&2
        exit 1
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "❌ Error: --max-workers must be a positive integer or 0, got: $2" >&2
        exit 1
      fi
      MAX_WORKERS="$2"
      shift 2
      ;;
    --max-iterations)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --max-iterations requires a number argument" >&2
        exit 1
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "❌ Error: --max-iterations must be a positive integer, got: $2" >&2
        exit 1
      fi
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --skip-verify)
      SKIP_VERIFY=true
      shift
      ;;
    --plan-only)
      PLAN_ONLY=true
      shift
      ;;
    --auto)
      AUTO_MODE=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --resume)
      RESUME=true
      shift
      ;;
    --session)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --session requires a session ID argument" >&2
        exit 1
      fi
      SESSION_ID_ARG="$2"
      shift 2
      ;;
    *)
      GOAL_PARTS+=("$1")
      shift
      ;;
  esac
done

# Join all goal parts with spaces
GOAL="${GOAL_PARTS[*]:-}"

# Get team name
TEAM_NAME=$(get_team_name)
TEAM_DIR=$(get_team_dir "$TEAM_NAME")
SESSIONS_DIR=$(get_sessions_dir "$TEAM_DIR")

# Create directories
mkdir -p "$SESSIONS_DIR"

# Read Claude session_id from SessionStart hook output
CLAUDE_SESSION_FILE="$TEAM_DIR/.claude-session"
if [[ -f "$CLAUDE_SESSION_FILE" ]]; then
  CLAUDE_SESSION_ID=$(jq -r '.claude_session_id // empty' "$CLAUDE_SESSION_FILE")
else
  CLAUDE_SESSION_ID=""
fi

# Fallback: generate session ID if Claude session not available
if [[ -z "$CLAUDE_SESSION_ID" ]]; then
  CLAUDE_SESSION_ID=$(generate_session_id)
  echo "⚠️  Note: Using generated session ID (Claude session not captured)" >&2
fi

# Handle --resume
if [[ "$RESUME" == true ]]; then
  # Determine which session to resume
  if [[ -n "$SESSION_ID_ARG" ]]; then
    SESSION_ID="$SESSION_ID_ARG"
  else
    # Use current Claude session ID
    SESSION_ID="$CLAUDE_SESSION_ID"
  fi

  SESSION_DIR="$SESSIONS_DIR/$SESSION_ID"
  SESSION_FILE="$SESSION_DIR/session.json"

  if [[ ! -f "$SESSION_FILE" ]]; then
    echo "❌ Error: No session to resume for Claude session $SESSION_ID" >&2
    echo "" >&2
    echo "   Start a new session: /ultrawork <goal>" >&2
    echo "   Resume specific session: /ultrawork --session <id> --resume" >&2
    echo "" >&2
    echo "   Active sessions:" >&2
    list_active_sessions "$TEAM_NAME" | while read -r sid; do
      sf="$SESSIONS_DIR/$sid/session.json"
      g=$(grep -o '"goal": *"[^"]*"' "$sf" 2>/dev/null | cut -d'"' -f4 || echo "unknown")
      echo "     $sid: $g"
    done
    exit 1
  fi

  EXISTING_GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")
  CANCELLED_AT=$(grep -o '"cancelled_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")

  # Update timestamp and clear cancelled_at if resuming cancelled session
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  if [[ -n "$CANCELLED_AT" && "$CANCELLED_AT" != "null" ]]; then
    update_session_json "$SESSION_FILE" ".cancelled_at = null | .updated_at = \"$TIMESTAMP\""
  else
    update_session_json "$SESSION_FILE" ".updated_at = \"$TIMESTAMP\""
  fi

  WAS_CANCELLED=""
  if [[ -n "$CANCELLED_AT" && "$CANCELLED_AT" != "null" ]]; then
    WAS_CANCELLED="(was cancelled)"
  fi

  cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION RESUMED
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID (Claude session)
 Goal: $EXISTING_GOAL
 Team: $TEAM_NAME
 Status: Resuming $WAS_CANCELLED
 Resumed: $TIMESTAMP

───────────────────────────────────────────────────────────

 Continuing from where we left off...
 Check tasks/ directory for current task states.

═══════════════════════════════════════════════════════════
EOF
  echo "$EXISTING_GOAL"
  exit 0
fi

# Validate goal is non-empty (not needed for --resume)
if [[ -z "$GOAL" ]]; then
  echo "❌ Error: No goal provided" >&2
  echo "" >&2
  echo "   Ultrawork needs a task description." >&2
  echo "" >&2
  echo "   Examples:" >&2
  echo "     /ultrawork implement user authentication" >&2
  echo "     /ultrawork --max-workers 3 add tests for services" >&2
  echo "     /ultrawork --plan-only refactor database layer" >&2
  echo "" >&2
  echo "   For help: /ultrawork --help" >&2
  exit 1
fi

# Check for existing session for this Claude session (unless --force)
SESSION_ID="$CLAUDE_SESSION_ID"
SESSION_DIR="$SESSIONS_DIR/$SESSION_ID"
SESSION_FILE="$SESSION_DIR/session.json"

if [[ -f "$SESSION_FILE" ]] && [[ "$FORCE" != true ]]; then
  # Check if session was cancelled
  CANCELLED_AT=$(grep -o '"cancelled_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")

  # Session is active if not cancelled
  if [[ -z "$CANCELLED_AT" || "$CANCELLED_AT" == "null" ]]; then
    EXISTING_GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
    echo "⚠️  Warning: Active session exists (ID: $SESSION_ID)" >&2
    echo "   Goal: $EXISTING_GOAL" >&2
    echo "" >&2
    echo "   Use /ultrawork-status to check progress" >&2
    echo "   Use /ultrawork-cancel to cancel it first" >&2
    echo "   Use /ultrawork --force to override" >&2
    echo "   Use /ultrawork --resume to continue" >&2
    echo "" >&2
    exit 1
  fi
  # Session was cancelled - will be overwritten below
fi

# Create session directory with tasks subdirectory
mkdir -p "$SESSION_DIR/tasks"

# Generate timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Create session.json (metadata only - tasks stored in tasks/ directory)
cat > "$SESSION_FILE" <<EOF
{
  "version": "5.0",
  "session_id": "$SESSION_ID",
  "claude_session_id": "$CLAUDE_SESSION_ID",
  "goal": "$GOAL",
  "started_at": "$TIMESTAMP",
  "updated_at": "$TIMESTAMP",
  "team": "$TEAM_NAME",
  "phase": "PLANNING",
  "iteration": 1,
  "options": {
    "max_workers": $MAX_WORKERS,
    "max_iterations": $MAX_ITERATIONS,
    "skip_verify": $SKIP_VERIFY,
    "plan_only": $PLAN_ONLY,
    "auto_mode": $AUTO_MODE
  },
  "plan": null,
  "cancelled_at": null
}
EOF

# Create empty context.json for explorer findings
cat > "$SESSION_DIR/context.json" <<EOF
{
  "explorers": []
}
EOF
# Directory Structure:
#   {SESSION_DIR}/
#   ├── session.json      # Session metadata (phase, goal, options)
#   ├── context.json      # Explorer findings
#   └── tasks/
#       ├── 1.json        # Individual task files (created by planner)
#       └── verify.json   # Verification task

# Output setup message
cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION STARTED
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID (Claude session)
 Goal: $GOAL
 Team: $TEAM_NAME
 Phase: PLANNING
 Started: $TIMESTAMP

───────────────────────────────────────────────────────────
 OPTIONS
───────────────────────────────────────────────────────────

 Max workers:    $(if [[ $MAX_WORKERS -gt 0 ]]; then echo $MAX_WORKERS; else echo "unlimited"; fi)
 Max iterations: $MAX_ITERATIONS
 Skip verify:    $SKIP_VERIFY
 Plan only:      $PLAN_ONLY
 Auto mode:      $AUTO_MODE

───────────────────────────────────────────────────────────
 SESSION BINDING
───────────────────────────────────────────────────────────

 This ultrawork session is bound to Claude Code session: $SESSION_ID
 Session persists across terminal restarts within same Claude session.

 Session directory: $SESSION_DIR/
   ├── session.json
   ├── context.json
   └── tasks/

───────────────────────────────────────────────────────────
 WORKFLOW
───────────────────────────────────────────────────────────

 1. [→] PLANNING     - Planner creating task graph
 2. $(if [[ "$PLAN_ONLY" == true ]]; then echo "[⊘]"; else echo "[ ]"; fi) EXECUTION    - Workers implementing tasks
 3. $(if [[ "$SKIP_VERIFY" == true || "$PLAN_ONLY" == true ]]; then echo "[⊘]"; else echo "[ ]"; fi) VERIFICATION - Verifier checking evidence
 4. [ ] COMPLETE     - All criteria met

───────────────────────────────────────────────────────────
 COMMANDS
───────────────────────────────────────────────────────────

 /ultrawork-status     Check progress
 /ultrawork-evidence   View evidence
 /ultrawork-cancel     Cancel session

───────────────────────────────────────────────────────────
 ZERO TOLERANCE RULES
───────────────────────────────────────────────────────────

 ✗ No "should work" - require evidence
 ✗ No "basic implementation" - complete work only
 ✗ No TODO/FIXME - finish everything
 ✗ No completion without verification

═══════════════════════════════════════════════════════════

Spawning planner agent to create task graph...

EOF

echo "$GOAL"
