#!/bin/bash

# Ultrawork Status Script
# Displays current session status with Session ID support

set -euo pipefail

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

# Parse arguments
SESSION_ID_ARG=""
LIST_ALL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 ULTRAWORK-STATUS - Check Session Progress
═══════════════════════════════════════════════════════════

USAGE:
  /ultrawork-status [OPTIONS]

OPTIONS:
  --session <id>   Show status of specific session
  --all            List all active sessions for this team
  -h, --help       Show this help message

DESCRIPTION:
  Displays the current ultrawork session status including:

  • Session ID and isolation info
  • Current phase (PLANNING/EXECUTION/VERIFICATION/COMPLETE)
  • Task progress and completion count
  • Evidence collection status
  • Time elapsed

OUTPUT EXAMPLE:
  ┌─────────────────────────────────────┐
  │ Session: abc1234                    │
  │ Goal: implement auth system         │
  │ Phase: EXECUTION                    │
  │                                     │
  │ [✓] PLANNING     - Task graph done  │
  │ [→] EXECUTION    - 3/5 tasks done   │
  │ [ ] VERIFICATION - Waiting          │
  │ [ ] COMPLETE                        │
  └─────────────────────────────────────┘

RELATED:
  /ultrawork-evidence   View collected evidence
  /ultrawork-cancel     Cancel session

═══════════════════════════════════════════════════════════
HELP_EOF
      exit 0
      ;;
    --session)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --session requires a session ID argument" >&2
        exit 1
      fi
      SESSION_ID_ARG="$2"
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

# Get team info
TEAM_NAME=$(get_team_name)
TEAM_DIR=$(get_team_dir "$TEAM_NAME")
SESSIONS_DIR=$(get_sessions_dir "$TEAM_DIR")

# Handle --all flag
if [[ "$LIST_ALL" == true ]]; then
  echo "═══════════════════════════════════════════════════════════"
  echo " ALL ULTRAWORK SESSIONS - Team: $TEAM_NAME"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  CURRENT_SESSION_ID=$(get_current_session_id "$TEAM_NAME")
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

          # Mark current session
          if [[ "$session_id" == "$CURRENT_SESSION_ID" ]]; then
            marker=" ← current"
          else
            marker=""
          fi

          echo " [$session_id]$marker"
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
    echo ""
    echo " View specific session: /ultrawork-status --session <id>"
  fi
  echo "═══════════════════════════════════════════════════════════"
  exit 0
fi

# Determine which session to show
if [[ -n "$SESSION_ID_ARG" ]]; then
  SESSION_ID="$SESSION_ID_ARG"
else
  SESSION_ID=$(get_current_session_id "$TEAM_NAME")
fi

# Check if we have a session
if [[ -z "$SESSION_ID" ]]; then
  echo "No active ultrawork session bound to this terminal."
  echo ""
  echo "Options:"
  echo "  Start a new session: /ultrawork \"your goal\""
  echo "  List all sessions:   /ultrawork-status --all"
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID" "$TEAM_NAME")
SESSION_FILE="$SESSION_DIR/session.json"

if [[ ! -f "$SESSION_FILE" ]]; then
  echo "Session $SESSION_ID not found."
  echo ""
  echo "Use /ultrawork-status --all to list available sessions."
  exit 0
fi

# Parse session.json
GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
PHASE=$(grep -o '"phase": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
STARTED=$(grep -o '"started_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
UPDATED=$(grep -o '"updated_at": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
TERMINAL_ID=$(grep -o '"terminal_id": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")

# Count tasks and evidence (rough count)
TASK_COUNT=$(grep -c '"id":' "$SESSION_FILE" 2>/dev/null || echo "0")
EVIDENCE_COUNT=$(grep -c '"criteria":' "$SESSION_FILE" 2>/dev/null || echo "0")

# Check if this is current terminal's session
CURRENT_SESSION_ID=$(get_current_session_id "$TEAM_NAME")
if [[ "$SESSION_ID" == "$CURRENT_SESSION_ID" ]]; then
  CURRENT_MARKER=" (current terminal)"
else
  CURRENT_MARKER=""
fi

# Output status
cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION$CURRENT_MARKER
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID
 Goal: $GOAL
 Team: $TEAM_NAME
 Phase: $PHASE
 Started: $STARTED
 Updated: $UPDATED
 Terminal: $TERMINAL_ID

───────────────────────────────────────────────────────────
 WORKFLOW
───────────────────────────────────────────────────────────

EOF

# Show phase progress
if [[ "$PHASE" == "PLANNING" ]]; then
  echo " 1. [→] PLANNING     - Planner creating task graph"
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

 Tasks: ~$TASK_COUNT
 Evidence items: ~$EVIDENCE_COUNT

───────────────────────────────────────────────────────────
 SESSION FILE
───────────────────────────────────────────────────────────

 $SESSION_FILE

───────────────────────────────────────────────────────────

 Run /ultrawork-evidence for detailed evidence
 Run /ultrawork-cancel to cancel session
 Run /ultrawork-status --all to see all sessions

═══════════════════════════════════════════════════════════
EOF
