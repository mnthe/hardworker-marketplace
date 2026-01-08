#!/usr/bin/env bash
#
# Teamwork loop detector hook
# Detects __TEAMWORK_CONTINUE__ marker and triggers next worker iteration
# Uses loop-state.sh for session tracking
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
LOOP_STATE="$PLUGIN_ROOT/scripts/loop-state.sh"

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Check if loop is active for this terminal
STATE=$("$LOOP_STATE" state 2>/dev/null || echo '{"active": false}')
ACTIVE=$(echo "$STATE" | jq -r '.active' 2>/dev/null || echo "false")

if [[ "$ACTIVE" != "true" ]]; then
    exit 0
fi

# Extract transcript from hook input
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript // .output // ""' 2>/dev/null || echo "$HOOK_INPUT")

# Check for continue marker
if ! echo "$TRANSCRIPT" | grep -q "__TEAMWORK_CONTINUE__"; then
    # No continue marker = loop done, clean up state
    "$LOOP_STATE" stop 2>/dev/null || true
    exit 0
fi

# Get loop context from state file
PROJECT=$(echo "$STATE" | jq -r '.project // ""')
TEAM=$(echo "$STATE" | jq -r '.team // ""')
ROLE=$(echo "$STATE" | jq -r '.role // ""')

# Build command
CMD="/teamwork-worker --loop"
[[ -n "$PROJECT" && "$PROJECT" != "null" ]] && CMD="$CMD --project $PROJECT"
[[ -n "$TEAM" && "$TEAM" != "null" ]] && CMD="$CMD --team $TEAM"
[[ -n "$ROLE" && "$ROLE" != "null" ]] && CMD="$CMD --role $ROLE"

# Output JSON to trigger next iteration
jq -n \
    --arg cmd "$CMD" \
    --arg project "$PROJECT" \
    --arg team "$TEAM" \
    --arg role "$ROLE" \
    '{
        "decision": "continue",
        "command": $cmd,
        "context": {
            "project": $project,
            "team": $team,
            "role": $role
        },
        "systemMessage": "Teamwork loop: continuing to next task"
    }'

exit 0
