#!/bin/bash

# Ultrawork Session Utilities
# Common functions for session ID management across all scripts
# v5.0: Simplified - no team directories, session_id from stdin only
#
# Session structure: ~/.claude/ultrawork/sessions/{session_id}/
# Claude Code provides session_id in stdin JSON for ALL hooks.

# Get the base ultrawork directory
get_ultrawork_base() {
  echo "$HOME/.claude/ultrawork"
}

# Get sessions directory
get_sessions_dir() {
  echo "$(get_ultrawork_base)/sessions"
}

# Get session directory for a session ID
get_session_dir() {
  local session_id="$1"
  echo "$(get_sessions_dir)/$session_id"
}

# Get session.json path for a session ID
get_session_file() {
  local session_id="$1"
  echo "$(get_session_dir "$session_id")/session.json"
}

# Validate session ID and return session file path
# Usage: SESSION_FILE=$(resolve_session_id "$SESSION_ID") || exit 1
resolve_session_id() {
  local session_id="$1"

  if [[ -z "$session_id" ]]; then
    echo "Error: --session <ID> required" >&2
    return 1
  fi

  local session_file=$(get_session_file "$session_id")

  if [[ ! -f "$session_file" ]]; then
    echo "Error: Session not found: $session_id" >&2
    echo "Expected file: $session_file" >&2
    return 1
  fi

  echo "$session_file"
}

# Get Claude session_id from environment variable
# Hooks must set ULTRAWORK_STDIN_SESSION_ID before calling this
get_claude_session_id() {
  echo "${ULTRAWORK_STDIN_SESSION_ID:-}"
}

# Alias for backward compatibility
get_current_session_id() {
  get_claude_session_id
}

# Get session.json path for current session
get_current_session_file() {
  local session_id=$(get_claude_session_id)

  if [[ -n "$session_id" ]]; then
    local session_dir=$(get_session_dir "$session_id")
    if [[ -f "$session_dir/session.json" ]]; then
      echo "$session_dir/session.json"
    else
      echo ""
    fi
  else
    echo ""
  fi
}

# Check if session exists and is active (not in terminal state)
is_session_active_by_id() {
  local session_id="$1"
  local session_dir=$(get_session_dir "$session_id")
  local session_file="$session_dir/session.json"

  if [[ ! -f "$session_file" ]]; then
    return 1
  fi

  local phase=$(jq -r '.phase // "unknown"' "$session_file" 2>/dev/null)

  case "$phase" in
    PLANNING|EXECUTION|VERIFICATION)
      return 0  # Active
      ;;
    *)
      return 1  # Terminal or unknown
      ;;
  esac
}

# List all active sessions (scans all session directories)
list_active_sessions() {
  local sessions_dir=$(get_sessions_dir)

  if [[ ! -d "$sessions_dir" ]]; then
    return
  fi

  for session_dir in "$sessions_dir"/*; do
    if [[ -d "$session_dir" ]]; then
      local session_id=$(basename "$session_dir")
      if is_session_active_by_id "$session_id"; then
        echo "$session_id"
      fi
    fi
  done
}

# Clean up old sessions (completed/cancelled/failed older than N days)
cleanup_old_sessions() {
  local days="${1:-7}"
  local sessions_dir=$(get_sessions_dir)

  if [[ ! -d "$sessions_dir" ]]; then
    return
  fi

  find "$sessions_dir" -maxdepth 1 -type d -mtime +"$days" | while read -r session_dir; do
    local session_id=$(basename "$session_dir")
    # Only delete non-active sessions
    if ! is_session_active_by_id "$session_id"; then
      rm -rf "$session_dir"
    fi
  done
}

# Acquire lock for session file operations
acquire_session_lock() {
  local session_file="$1"
  local lock_file="${session_file}.lock"
  local timeout="${2:-10}"

  local start_time=$(date +%s)
  while true; do
    if mkdir "$lock_file" 2>/dev/null; then
      return 0
    fi

    local current_time=$(date +%s)
    if (( current_time - start_time >= timeout )); then
      return 1
    fi

    sleep 0.1
  done
}

# Release lock for session file
release_session_lock() {
  local session_file="$1"
  local lock_file="${session_file}.lock"

  rmdir "$lock_file" 2>/dev/null || true
}


# Safe JSON update with locking
update_session_json() {
  local session_file="$1"
  local jq_filter="$2"

  if ! acquire_session_lock "$session_file"; then
    echo "Failed to acquire lock for $session_file" >&2
    return 1
  fi

  trap 'release_session_lock "$session_file"' EXIT

  local tmp_file="${session_file}.tmp"
  if jq "$jq_filter" "$session_file" > "$tmp_file"; then
    mv "$tmp_file" "$session_file"
    release_session_lock "$session_file"
    trap - EXIT
    return 0
  else
    rm -f "$tmp_file"
    release_session_lock "$session_file"
    trap - EXIT
    return 1
  fi
}
