#!/bin/bash

# Ultrawork PostToolUse Evidence Hook
# Automatically captures evidence from tool executions
# Captures: bash outputs, test results, file operations

set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# Get team and session info
TEAM_NAME=$(get_team_name)
SESSION_ID=$(get_current_session_id "$TEAM_NAME")

# No active session - exit early
if [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID" "$TEAM_NAME")
SESSION_FILE="$SESSION_DIR/session.json"

# Session file doesn't exist - exit
if [[ ! -f "$SESSION_FILE" ]]; then
  exit 0
fi

# Parse session state
PHASE=$(grep -o '"phase": *"[^"]*"' "$SESSION_FILE" | cut -d'"' -f4 || echo "")

# Only capture evidence during EXECUTION phase
if [[ "$PHASE" != "EXECUTION" ]]; then
  exit 0
fi

# Parse hook input
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool // empty' 2>/dev/null || echo "")
if [[ -z "$TOOL_NAME" ]]; then
  exit 0
fi

# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Function to truncate large outputs
truncate_output() {
  local text="$1"
  local max_len="${2:-10000}"

  if [[ ${#text} -gt $max_len ]]; then
    echo "${text:0:5000}
... [truncated $(( ${#text} - 10000 )) bytes] ...
${text: -5000}"
  else
    echo "$text"
  fi
}

# Function to detect test command patterns
is_test_command() {
  local cmd="$1"

  if [[ "$cmd" =~ (npm|yarn|pnpm)\ (run\ )?test ]] || \
     [[ "$cmd" =~ pytest ]] || \
     [[ "$cmd" =~ cargo\ test ]] || \
     [[ "$cmd" =~ go\ test ]] || \
     [[ "$cmd" =~ jest ]] || \
     [[ "$cmd" =~ vitest ]] || \
     [[ "$cmd" =~ phpunit ]] || \
     [[ "$cmd" =~ ruby\ .*test ]] || \
     [[ "$cmd" =~ python.*test ]]; then
    return 0
  else
    return 1
  fi
}

# Function to parse test results
parse_test_output() {
  local output="$1"
  local summary=""

  # npm/jest/vitest pattern
  if echo "$output" | grep -q "Tests:.*passed"; then
    summary=$(echo "$output" | grep "Tests:" | head -1 | sed 's/^[[:space:]]*//')
  # pytest pattern
  elif echo "$output" | grep -q "passed.*failed"; then
    summary=$(echo "$output" | grep -E "(passed|failed)" | tail -1 | sed 's/^[[:space:]]*//')
  # cargo test pattern
  elif echo "$output" | grep -q "test result:"; then
    summary=$(echo "$output" | grep "test result:" | head -1 | sed 's/^[[:space:]]*//')
  # go test pattern
  elif echo "$output" | grep -q "PASS\|FAIL"; then
    summary=$(echo "$output" | grep -E "^(PASS|FAIL)" | head -1)
  fi

  if [[ -n "$summary" ]]; then
    echo "$summary"
  else
    truncate_output "$output" 1000
  fi
}

# Process based on tool type
case "$TOOL_NAME" in
  bash|Bash)
    # Extract command and output
    COMMAND=$(echo "$HOOK_INPUT" | jq -r '.input // empty' 2>/dev/null || echo "")
    OUTPUT=$(echo "$HOOK_INPUT" | jq -r '.output // empty' 2>/dev/null || echo "")
    EXIT_CODE=$(echo "$HOOK_INPUT" | jq -r '.exit_code // 0' 2>/dev/null || echo "0")

    # Skip if no command
    if [[ -z "$COMMAND" ]]; then
      exit 0
    fi

    # Determine evidence type and summary
    if is_test_command "$COMMAND"; then
      TYPE="test_result"
      SUMMARY=$(parse_test_output "$OUTPUT")
      SUCCESS=$([[ $EXIT_CODE -eq 0 ]] && echo "true" || echo "false")
    else
      TYPE="command_output"
      SUMMARY=$(truncate_output "$OUTPUT" 1000)
      SUCCESS=$([[ $EXIT_CODE -eq 0 ]] && echo "true" || echo "false")
    fi

    # Build evidence entry
    EVIDENCE_ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg type "$TYPE" \
      --arg tool "bash" \
      --arg cmd "$COMMAND" \
      --arg out "$SUMMARY" \
      --argjson code "$EXIT_CODE" \
      --argjson success "$SUCCESS" \
      '{
        timestamp: $ts,
        type: $type,
        tool: $tool,
        context: {
          command: $cmd,
          exit_code: $code,
          success: $success
        },
        output: $out
      }')

    # Append to evidence_log with locking
    if acquire_session_lock "$SESSION_FILE"; then
      trap 'release_session_lock "$SESSION_FILE"' EXIT

      # Append evidence
      TMP_FILE="${SESSION_FILE}.tmp"
      jq --argjson entry "$EVIDENCE_ENTRY" '.evidence_log += [$entry]' "$SESSION_FILE" > "$TMP_FILE"
      mv "$TMP_FILE" "$SESSION_FILE"

      release_session_lock "$SESSION_FILE"
      trap - EXIT
    fi
    ;;

  read|Read)
    # Extract file path
    FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.file_path // empty' 2>/dev/null || echo "")

    # Skip if no file path
    if [[ -z "$FILE_PATH" ]]; then
      exit 0
    fi

    # Build evidence entry
    EVIDENCE_ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg type "file_operation" \
      --arg tool "read" \
      --arg file "$FILE_PATH" \
      '{
        timestamp: $ts,
        type: $type,
        tool: $tool,
        context: {
          file: $file,
          operation: "read",
          success: true
        }
      }')

    # Append to evidence_log with locking
    if acquire_session_lock "$SESSION_FILE"; then
      trap 'release_session_lock "$SESSION_FILE"' EXIT

      TMP_FILE="${SESSION_FILE}.tmp"
      jq --argjson entry "$EVIDENCE_ENTRY" '.evidence_log += [$entry]' "$SESSION_FILE" > "$TMP_FILE"
      mv "$TMP_FILE" "$SESSION_FILE"

      release_session_lock "$SESSION_FILE"
      trap - EXIT
    fi
    ;;

  write|Write)
    # Extract file path
    FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.file_path // empty' 2>/dev/null || echo "")

    # Skip if no file path
    if [[ -z "$FILE_PATH" ]]; then
      exit 0
    fi

    # Build evidence entry
    EVIDENCE_ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg type "file_operation" \
      --arg tool "write" \
      --arg file "$FILE_PATH" \
      '{
        timestamp: $ts,
        type: $type,
        tool: $tool,
        context: {
          file: $file,
          operation: "write",
          success: true
        }
      }')

    # Append to evidence_log with locking
    if acquire_session_lock "$SESSION_FILE"; then
      trap 'release_session_lock "$SESSION_FILE"' EXIT

      TMP_FILE="${SESSION_FILE}.tmp"
      jq --argjson entry "$EVIDENCE_ENTRY" '.evidence_log += [$entry]' "$SESSION_FILE" > "$TMP_FILE"
      mv "$TMP_FILE" "$SESSION_FILE"

      release_session_lock "$SESSION_FILE"
      trap - EXIT
    fi
    ;;

  edit|Edit)
    # Extract file path
    FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.file_path // empty' 2>/dev/null || echo "")

    # Skip if no file path
    if [[ -z "$FILE_PATH" ]]; then
      exit 0
    fi

    # Build evidence entry
    EVIDENCE_ENTRY=$(jq -n \
      --arg ts "$TIMESTAMP" \
      --arg type "file_operation" \
      --arg tool "edit" \
      --arg file "$FILE_PATH" \
      '{
        timestamp: $ts,
        type: $type,
        tool: $tool,
        context: {
          file: $file,
          operation: "edit",
          success: true
        }
      }')

    # Append to evidence_log with locking
    if acquire_session_lock "$SESSION_FILE"; then
      trap 'release_session_lock "$SESSION_FILE"' EXIT

      TMP_FILE="${SESSION_FILE}.tmp"
      jq --argjson entry "$EVIDENCE_ENTRY" '.evidence_log += [$entry]' "$SESSION_FILE" > "$TMP_FILE"
      mv "$TMP_FILE" "$SESSION_FILE"

      release_session_lock "$SESSION_FILE"
      trap - EXIT
    fi
    ;;
esac

exit 0
