#!/usr/bin/env bash
#
# Teamwork loop state management
# Tracks active loop sessions per terminal/project
#

set -euo pipefail

TEAMWORK_DIR="${HOME}/.claude/teamwork"
STATE_DIR="${TEAMWORK_DIR}/.loop-state"

# Get unique terminal identifier
get_terminal_id() {
    echo "${CLAUDE_SESSION_ID:-$$}"
}

# State file path for current terminal
get_state_file() {
    local terminal_id=$(get_terminal_id)
    echo "${STATE_DIR}/${terminal_id}.json"
}

# Start loop - save state
loop_start() {
    local project="${1:-}"
    local team="${2:-}"
    local role="${3:-}"

    mkdir -p "$STATE_DIR"

    local state_file=$(get_state_file)

    cat > "$state_file" << EOF
{
    "active": true,
    "project": "$project",
    "team": "$team",
    "role": "$role",
    "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "terminal_id": "$(get_terminal_id)"
}
EOF

    echo "Loop started: $state_file"
}

# Stop loop - remove state
loop_stop() {
    local state_file=$(get_state_file)

    if [[ -f "$state_file" ]]; then
        rm -f "$state_file"
        echo "Loop stopped"
    else
        echo "No active loop"
    fi
}

# Check if loop is active
loop_check() {
    local state_file=$(get_state_file)

    if [[ -f "$state_file" ]]; then
        cat "$state_file"
        exit 0
    else
        echo '{"active": false}'
        exit 1
    fi
}

# Get loop state as JSON
loop_state() {
    local state_file=$(get_state_file)

    if [[ -f "$state_file" ]]; then
        cat "$state_file"
    else
        echo '{"active": false}'
    fi
}

# Main
case "${1:-}" in
    start)
        loop_start "${2:-}" "${3:-}" "${4:-}"
        ;;
    stop)
        loop_stop
        ;;
    check)
        loop_check
        ;;
    state)
        loop_state
        ;;
    *)
        echo "Usage: $0 {start|stop|check|state} [project] [team] [role]"
        exit 1
        ;;
esac
