#!/bin/bash

# Ultrawork Evidence Script
# v5.0: Requires --session from AI

set -euo pipefail

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/session-utils.sh"

# Parse arguments
SESSION_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 ULTRAWORK-EVIDENCE - View Collected Evidence
═══════════════════════════════════════════════════════════

USAGE:
  /ultrawork-evidence --session <id>

OPTIONS:
  --session <id>   Session ID (required, provided by AI)
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
    *)
      shift
      ;;
  esac
done

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
 SESSION DIRECTORY
───────────────────────────────────────────────────────────

 $SESSION_DIR/
   ├── session.json
   ├── context.json
   ├── exploration/
   └── tasks/

 To view full session data:
   jq '.' "$SESSION_FILE"

═══════════════════════════════════════════════════════════
EOF
