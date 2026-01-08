#!/bin/bash

# Ultrawork Evidence Script
# Displays collected evidence for current session with Session ID support

set -euo pipefail

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

# Parse arguments
SESSION_ID_ARG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 ULTRAWORK-EVIDENCE - View Collected Evidence
═══════════════════════════════════════════════════════════

USAGE:
  /ultrawork-evidence [OPTIONS]

OPTIONS:
  --session <id>   Show evidence from specific session
  -h, --help       Show this help message

DESCRIPTION:
  Displays all evidence collected during the ultrawork session.
  Evidence is organized by task and criterion.

EVIDENCE TYPES:
  • command_output  - Shell command results (npm test, etc.)
  • test_result     - Test suite output
  • api_response    - HTTP response verification
  • file_content    - File diff or content
  • manual          - User-provided evidence

OUTPUT FORMAT:
  Task: Setup database
  ───────────────────────────────────────
  ✓ Criteria: Migration runs without error
    Command: npx prisma migrate deploy
    Output: "All migrations applied"

  ⏳ Criteria: Tests pass
    Status: pending

EVIDENCE REQUIREMENTS:
  Every success criterion MUST have:
  • Concrete proof (not "it works")
  • Command output with exit code
  • Timestamp of collection

RELATED:
  /ultrawork-status   Check session progress
  /ultrawork-cancel   Cancel session

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
    *)
      shift
      ;;
  esac
done

# Get team info
TEAM_NAME=$(get_team_name)

# Determine which session to show
if [[ -n "$SESSION_ID_ARG" ]]; then
  SESSION_ID="$SESSION_ID_ARG"
else
  SESSION_ID=$(get_current_session_id "$TEAM_NAME")
fi

# Check if we have a session
if [[ -z "$SESSION_ID" ]]; then
  echo "No ultrawork session bound to this terminal."
  echo ""
  echo "Options:"
  echo "  List all sessions: /ultrawork-status --all"
  echo "  View specific:     /ultrawork-evidence --session <id>"
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID" "$TEAM_NAME")
SESSION_FILE="$SESSION_DIR/session.json"

if [[ ! -f "$SESSION_FILE" ]]; then
  echo "Session $SESSION_ID not found."
  exit 1
fi

# Get basic info
GOAL=$(grep -o '"goal": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")
PHASE=$(grep -o '"phase": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "unknown")

# Output header
cat <<EOF
═══════════════════════════════════════════════════════════
 ULTRAWORK EVIDENCE LOG
═══════════════════════════════════════════════════════════

 Session ID: $SESSION_ID
 Goal: $GOAL
 Phase: $PHASE

───────────────────────────────────────────────────────────
 EVIDENCE
───────────────────────────────────────────────────────────

EOF

# Display evidence_log section from JSON
# This is a simplified display - Claude will interpret the full JSON

echo "Raw evidence data from session.json:"
echo ""

# Extract and display evidence_log array (basic extraction)
if grep -q '"evidence_log"' "$SESSION_FILE"; then
  # Show the evidence_log section
  sed -n '/"evidence_log"/,/^\s*\]/p' "$SESSION_FILE" | head -50

  if [[ $(sed -n '/"evidence_log"/,/^\s*\]/p' "$SESSION_FILE" | wc -l) -gt 50 ]]; then
    echo ""
    echo "... (truncated, see full file for more)"
  fi
else
  echo "  (no evidence collected yet)"
fi

cat <<EOF

───────────────────────────────────────────────────────────
 SESSION FILE
───────────────────────────────────────────────────────────

 $SESSION_FILE

 To view full session data:
   jq '.' "$SESSION_FILE"

═══════════════════════════════════════════════════════════
EOF
