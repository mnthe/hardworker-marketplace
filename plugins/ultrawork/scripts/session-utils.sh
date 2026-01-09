#!/bin/bash

# Ultrawork Session Utilities
# Common functions for session ID management across all scripts
# v3.1: Uses Claude Code session_id for session binding

# Get team name from git repo or default
get_team_name() {
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    basename "$(git rev-parse --show-toplevel)"
  else
    echo "default"
  fi
}

# Get the base ultrawork directory
get_ultrawork_base() {
  echo "$HOME/.claude/ultrawork"
}

# Get team directory
get_team_dir() {
  local team_name="${1:-$(get_team_name)}"
  echo "$(get_ultrawork_base)/$team_name"
}

# Get sessions directory (stores actual session data)
get_sessions_dir() {
  local team_dir="${1:-$(get_team_dir)}"
  echo "$team_dir/sessions"
}

# Generate fallback session ID (7-char lowercase UUID prefix)
# Used only when Claude session_id is not available
generate_session_id() {
  if command -v uuidgen &>/dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-7
  else
    # Fallback: use /dev/urandom
    head -c 100 /dev/urandom | md5sum | cut -c1-7
  fi
}

# Get Claude session_id from SessionStart hook capture file
get_claude_session_id() {
  local team_name="${1:-$(get_team_name)}"
  local team_dir=$(get_team_dir "$team_name")
  local claude_session_file="$team_dir/.claude-session"

  if [[ -f "$claude_session_file" ]]; then
    jq -r '.claude_session_id // empty' "$claude_session_file"
  else
    echo ""
  fi
}

# Get session directory for a session ID
get_session_dir() {
  local session_id="$1"
  local team_name="${2:-$(get_team_name)}"
  local team_dir=$(get_team_dir "$team_name")
  echo "$(get_sessions_dir "$team_dir")/$session_id"
}

# Get session.json path for current Claude session
get_current_session_file() {
  local team_name="${1:-$(get_team_name)}"
  local session_id=$(get_claude_session_id "$team_name")

  if [[ -n "$session_id" ]]; then
    local session_dir=$(get_session_dir "$session_id" "$team_name")
    if [[ -f "$session_dir/session.json" ]]; then
      echo "$session_dir/session.json"
    else
      echo ""
    fi
  else
    echo ""
  fi
}

# Alias for backward compatibility
get_current_session_id() {
  get_claude_session_id "$@"
}

# Unbind terminal from ultrawork session
# Removes the .claude-session file that links Claude session to ultrawork session
unbind_terminal() {
  local team_name="${1:-$(get_team_name)}"
  local team_dir=$(get_team_dir "$team_name")
  local claude_session_file="$team_dir/.claude-session"

  rm -f "$claude_session_file"
}

# List all active sessions for a team
list_active_sessions() {
  local team_name="${1:-$(get_team_name)}"
  local team_dir=$(get_team_dir "$team_name")
  local sessions_dir=$(get_sessions_dir "$team_dir")

  if [[ ! -d "$sessions_dir" ]]; then
    return
  fi

  for session_dir in "$sessions_dir"/*; do
    if [[ -d "$session_dir" ]]; then
      local session_id=$(basename "$session_dir")
      local session_file="$session_dir/session.json"

      if [[ -f "$session_file" ]]; then
        # Check cancelled_at - if not cancelled, session is active
        local cancelled_at=$(grep -o '"cancelled_at": *"[^"]*"' "$session_file" | cut -d'"' -f4 || echo "")

        if [[ -z "$cancelled_at" || "$cancelled_at" == "null" ]]; then
          echo "$session_id"
        fi
      fi
    fi
  done
}

# Clean up cancelled sessions older than N days
cleanup_old_sessions() {
  local days="${1:-7}"
  local team_name="${2:-$(get_team_name)}"
  local team_dir=$(get_team_dir "$team_name")
  local sessions_dir=$(get_sessions_dir "$team_dir")

  if [[ ! -d "$sessions_dir" ]]; then
    return
  fi

  find "$sessions_dir" -maxdepth 1 -type d -mtime +"$days" | while read -r session_dir; do
    if [[ -f "$session_dir/session.json" ]]; then
      # Check cancelled_at - only delete cancelled sessions
      local cancelled_at=$(grep -o '"cancelled_at": *"[^"]*"' "$session_dir/session.json" | cut -d'"' -f4 || echo "")

      if [[ -n "$cancelled_at" && "$cancelled_at" != "null" ]]; then
        rm -rf "$session_dir"
      fi
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
