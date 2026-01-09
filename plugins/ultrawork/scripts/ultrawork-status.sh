#!/bin/bash

# Ultrawork Status Script
# v5.0: Requires --session from AI

set -euo pipefail

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

# Parse arguments
SESSION_ID=""
LIST_ALL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 ULTRAWORK-STATUS - Check Session Progress
═══════════════════════════════════════════════════════════

USAGE:
  /ultrawork-status --session <id>

OPTIONS:
  --session <id>   Session ID (required, provided by AI)
  --all            List all sessions
  -h, --help       Show this help message

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
    --all)
      LIST_ALL=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Handle --all flag (doesn't require --session)
if [[ "$LIST_ALL" == true ]]; then
  SESSIONS_DIR=$(get_sessions_dir)

  echo "═══════════════════════════════════════════════════════════"
  echo " ALL ULTRAWORK SESSIONS"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  SESSION_COUNT=0

  if [[ -d "$SESSIONS_DIR" ]]; then
    for session_dir in "$SESSIONS_DIR"/*; do
      if [[ -d "$session_dir" ]]; then
        session_id=$(basename "$session_dir")
        session_file="$session_dir/session.json"

        if [[ -f "$session_file" ]]; then
          goal=$(grep -o '"goal": *"[^"]*"' "$session_file" | cut -d'"' -f4 || echo "unknown")
          phase=$(grep -o '"phase": *"[^"]*"' "$session_file" | cut -d'"' -f4 || echo "unknown")
          started=$(grep -o '"started_at": *"[^"]*"' "$session_file" | cut -d'"' -f4 || echo "unknown")

          echo " [$session_id]"
          echo "   Goal: $goal"
          echo "   Phase: $phase"
          echo "   Started: $started"
          echo ""
          ((SESSION_COUNT++))
        fi
      fi
    done
  fi

  if [[ $SESSION_COUNT -eq 0 ]]; then
    echo " No sessions found."
    echo ""
    echo " Start one with: /ultrawork \"your goal\""
  else
    echo "───────────────────────────────────────────────────────────"
    echo " Total: $SESSION_COUNT session(s)"
  fi
  echo "═══════════════════════════════════════════════════════════"
  exit 0
fi

# Validate --session
if [[ -z "$SESSION_ID" ]]; then
  echo "❌ Error: --session is required" >&2
  exit 1
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"

if [[ ! -f "$SESSION_FILE" ]]; then
  echo "❌ Session $SESSION_ID not found." >&2
  exit 1
fi

# Parse session.json
GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
PHASE=$(grep -o '"phase": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
STARTED=$(grep -o '"started_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
UPDATED=$(grep -o '"updated_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
EXPLORATION_STAGE=$(grep -o '"exploration_stage": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "not_started")

# Count tasks and evidence (rough count)
TASK_COUNT=$(ls -1 "$SESSION_DIR/tasks/"*.json 2>/dev/null | wc -l | tr -d '[:space:]') || TASK_COUNT="0"
EVIDENCE_COUNT=$(grep -c '"criteria":' "$SESSION_FILE" 2>/dev/null | tr -d '[:space:]') || EVIDENCE_COUNT="0"

# Output status
cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION STATUS
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID
 Goal: $GOAL
 Phase: $PHASE
 Exploration: $EXPLORATION_STAGE
 Started: $STARTED
 Updated: $UPDATED

───────────────────────────────────────────────────────────
 WORKFLOW
───────────────────────────────────────────────────────────

EOF

# Show phase progress
if [[ "$PHASE" == "PLANNING" ]]; then
  echo " 1. [→] PLANNING     - Exploration: $EXPLORATION_STAGE"
  echo " 2. [ ] EXECUTION    - Workers implementing tasks"
  echo " 3. [ ] VERIFICATION - Verifier checking evidence"
  echo " 4. [ ] COMPLETE     - All criteria met"
elif [[ "$PHASE" == "EXECUTION" ]]; then
  echo " 1. [✓] PLANNING     - Task graph created"
  echo " 2. [→] EXECUTION    - Workers implementing tasks"
  echo " 3. [ ] VERIFICATION - Verifier checking evidence"
  echo " 4. [ ] COMPLETE     - All criteria met"
elif [[ "$PHASE" == "VERIFICATION" ]]; then
  echo " 1. [✓] PLANNING     - Task graph created"
  echo " 2. [✓] EXECUTION    - Tasks implemented"
  echo " 3. [→] VERIFICATION - Verifier checking evidence"
  echo " 4. [ ] COMPLETE     - All criteria met"
elif [[ "$PHASE" == "COMPLETE" ]]; then
  echo " 1. [✓] PLANNING     - Task graph created"
  echo " 2. [✓] EXECUTION    - Tasks implemented"
  echo " 3. [✓] VERIFICATION - Evidence verified"
  echo " 4. [✓] COMPLETE     - All criteria met"
elif [[ "$PHASE" == "CANCELLED" ]]; then
  echo " Session was cancelled by user"
elif [[ "$PHASE" == "FAILED" ]]; then
  echo " Session failed - check failure_reason in session.json"
fi

cat <<EOF

───────────────────────────────────────────────────────────
 STATS
───────────────────────────────────────────────────────────

 Tasks: $TASK_COUNT
 Evidence items: ~$EVIDENCE_COUNT

───────────────────────────────────────────────────────────
 SESSION DIRECTORY
───────────────────────────────────────────────────────────

 $SESSION_DIR/
   ├── session.json
   ├── context.json
   ├── exploration/
   └── tasks/

───────────────────────────────────────────────────────────

 /ultrawork-evidence - View detailed evidence
 /ultrawork-cancel   - Cancel session

═══════════════════════════════════════════════════════════
EOF
