#!/bin/bash

# Ultrawork Setup Script
# v5.1: Added working_dir to session.json for project deliverables

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
SESSION_ID=""

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
  --session <id>         Session ID (required, provided by AI)
  --max-workers <n>      Maximum parallel workers (default: unlimited)
  --max-iterations <n>   Max execute→verify loops (default: 5)
  --skip-verify          Skip verification phase (fast mode)
  --plan-only            Only run planner, don't execute tasks
  --auto                 Skip plan confirmation, run automatically
  --force                Force start even if active session exists
  --resume               Resume cancelled/failed session
  -h, --help             Show this help message

═══════════════════════════════════════════════════════════
HELP_EOF
      exit 0
      ;;
    --session)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --session requires a session ID argument" >&2
        exit 1
      fi
      SESSION_ID="$2"
      shift 2
      ;;
    --max-workers)
      if [[ -z "${2:-}" ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "❌ Error: --max-workers requires a positive integer" >&2
        exit 1
      fi
      MAX_WORKERS="$2"
      shift 2
      ;;
    --max-iterations)
      if [[ -z "${2:-}" ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "❌ Error: --max-iterations requires a positive integer" >&2
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
    *)
      GOAL_PARTS+=("$1")
      shift
      ;;
  esac
done

# Join all goal parts with spaces
GOAL="${GOAL_PARTS[*]:-}"

# Validate --session is provided
if [[ -z "$SESSION_ID" ]]; then
  echo "❌ Error: --session is required" >&2
  echo "" >&2
  echo "   AI should provide session ID from CLAUDE_SESSION_ID." >&2
  echo "   Example: setup-ultrawork.sh --session abc123 \"goal\"" >&2
  exit 1
fi

# Session directories
SESSIONS_DIR=$(get_sessions_dir)
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"

# Create sessions directory
mkdir -p "$SESSIONS_DIR"

# Handle --resume
if [[ "$RESUME" == true ]]; then
  if [[ ! -f "$SESSION_FILE" ]]; then
    echo "❌ Error: No session to resume (ID: $SESSION_ID)" >&2
    echo "" >&2
    echo "   Active sessions:" >&2
    list_active_sessions | while read -r sid; do
      sf="$(get_session_dir "$sid")/session.json"
      g=$(grep -o '"goal": *"[^"]*"' "$sf" 2>/dev/null | cut -d'"' -f4 || echo "unknown")
      echo "     $sid: $g"
    done
    exit 1
  fi

  EXISTING_GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Clear cancelled_at if resuming
  if acquire_session_lock "$SESSION_FILE"; then
    trap 'release_session_lock "$SESSION_FILE"' EXIT
    TMP_FILE="${SESSION_FILE}.tmp"
    jq --arg ts "$TIMESTAMP" '.cancelled_at = null | .updated_at = $ts' "$SESSION_FILE" > "$TMP_FILE"
    mv "$TMP_FILE" "$SESSION_FILE"
    release_session_lock "$SESSION_FILE"
    trap - EXIT
  fi

  cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION RESUMED
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID
 Goal: $EXISTING_GOAL
 Resumed: $TIMESTAMP

═══════════════════════════════════════════════════════════
EOF
  echo "$EXISTING_GOAL"
  exit 0
fi

# Validate goal is non-empty
if [[ -z "$GOAL" ]]; then
  echo "❌ Error: No goal provided" >&2
  echo "" >&2
  echo "   Example: /ultrawork implement user authentication" >&2
  exit 1
fi

# Check for existing active session
if [[ -f "$SESSION_FILE" ]] && [[ "$FORCE" != true ]]; then
  PHASE=$(grep -o '"phase": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")
  CANCELLED_AT=$(grep -o '"cancelled_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")

  # Session is active if not in terminal state
  if [[ "$PHASE" != "COMPLETE" && "$PHASE" != "CANCELLED" && "$PHASE" != "FAILED" ]] && \
     [[ -z "$CANCELLED_AT" || "$CANCELLED_AT" == "null" ]]; then
    EXISTING_GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
    echo "⚠️  Warning: Active session exists (ID: $SESSION_ID)" >&2
    echo "   Goal: $EXISTING_GOAL" >&2
    echo "" >&2
    echo "   Use /ultrawork-cancel to cancel it first" >&2
    echo "   Use /ultrawork --force to override" >&2
    exit 1
  fi
fi

# Create session directory
mkdir -p "$SESSION_DIR/tasks"
mkdir -p "$SESSION_DIR/exploration"

# Generate timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Get working directory (project root)
WORKING_DIR="$(pwd)"

# Create session.json
cat > "$SESSION_FILE" <<EOF
{
  "version": "5.1",
  "session_id": "$SESSION_ID",
  "working_dir": "$WORKING_DIR",
  "goal": "$GOAL",
  "started_at": "$TIMESTAMP",
  "updated_at": "$TIMESTAMP",
  "phase": "PLANNING",
  "exploration_stage": "not_started",
  "iteration": 1,
  "plan": {
    "approved_at": null
  },
  "options": {
    "max_workers": $MAX_WORKERS,
    "max_iterations": $MAX_ITERATIONS,
    "skip_verify": $SKIP_VERIFY,
    "plan_only": $PLAN_ONLY,
    "auto_mode": $AUTO_MODE
  },
  "evidence_log": [],
  "cancelled_at": null
}
EOF

# Create empty context.json
cat > "$SESSION_DIR/context.json" <<EOF
{
  "explorers": [],
  "exploration_complete": false
}
EOF

# Output setup message
cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION STARTED
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID
 Working Dir: $WORKING_DIR
 Goal: $GOAL
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
 SESSION DIRECTORY (Internal Metadata)
───────────────────────────────────────────────────────────

 $SESSION_DIR/
   ├── session.json
   ├── context.json
   ├── exploration/
   └── tasks/

───────────────────────────────────────────────────────────
 PROJECT DELIVERABLES
───────────────────────────────────────────────────────────

 Design documents → $WORKING_DIR/docs/plans/
 Code changes     → $WORKING_DIR/

───────────────────────────────────────────────────────────
 WORKFLOW
───────────────────────────────────────────────────────────

 1. [→] PLANNING     - Explore and create task graph
 2. $(if [[ "$PLAN_ONLY" == true ]]; then echo "[⊘]"; else echo "[ ]"; fi) EXECUTION    - Workers implementing tasks
 3. $(if [[ "$SKIP_VERIFY" == true || "$PLAN_ONLY" == true ]]; then echo "[⊘]"; else echo "[ ]"; fi) VERIFICATION - Verifier checking evidence
 4. [ ] COMPLETE     - All criteria met

───────────────────────────────────────────────────────────
 ZERO TOLERANCE RULES
───────────────────────────────────────────────────────────

 ✗ No "should work" - require evidence
 ✗ No "basic implementation" - complete work only
 ✗ No TODO/FIXME - finish everything

═══════════════════════════════════════════════════════════
EOF

echo "$GOAL"
