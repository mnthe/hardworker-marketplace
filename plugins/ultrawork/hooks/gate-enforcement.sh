#!/bin/bash

# Gate Enforcement Hook (PreToolUse)
# Blocks Edit/Write during PLANNING phase (except design.md, session files)
# v5.0: Uses session_id from stdin (multi-session safe)

set -euo pipefail

# Read stdin and extract session_id FIRST
HOOK_INPUT=$(cat)
export ULTRAWORK_STDIN_SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

# Get script directory and source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
source "$PLUGIN_ROOT/scripts/session-utils.sh"

# Parse tool from hook input
TOOL=$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""')

# Only process Edit and Write tools
if [[ "$TOOL" != "Edit" && "$TOOL" != "Write" ]]; then
  exit 0
fi

# Get session info
SESSION_ID="$ULTRAWORK_STDIN_SESSION_ID"

# No session - allow
if [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Check if ultrawork session is active
if ! is_session_active_by_id "$SESSION_ID"; then
  exit 0  # No active session - allow
fi

# Get session file
SESSION_DIR=$(get_session_dir "$SESSION_ID")
SESSION_FILE="$SESSION_DIR/session.json"
PHASE=$(jq -r '.phase // ""' "$SESSION_FILE" 2>/dev/null || echo "")

# Only enforce during PLANNING phase
if [[ "$PHASE" != "PLANNING" ]]; then
  exit 0
fi

# Get file path from tool input
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // ""')

# Allowed files during PLANNING:
# - design.md (planning document)
# - session.json, context.json (session state)
# - exploration/*.md (explorer output)
# - tasks/*.json (task definitions via task-create.sh is OK, but direct Edit is blocked)

ALLOWED=false

# Check allowed patterns
if [[ "$FILE_PATH" == *"design.md"* ]]; then
  ALLOWED=true
elif [[ "$FILE_PATH" == *"session.json"* ]]; then
  ALLOWED=true
elif [[ "$FILE_PATH" == *"context.json"* ]]; then
  ALLOWED=true
elif [[ "$FILE_PATH" == *"/exploration/"* ]]; then
  ALLOWED=true
elif [[ "$FILE_PATH" == *"/.claude/ultrawork/"* ]]; then
  # Session directory files are allowed
  ALLOWED=true
fi

if [[ "$ALLOWED" == "true" ]]; then
  exit 0
fi

# Block with clear message
cat << EOF
{"decision": "block", "reason": "⛔ GATE VIOLATION: $TOOL blocked in PLANNING phase.

Current Phase: PLANNING
Blocked Tool: $TOOL
Target File: $FILE_PATH

PLANNING 단계에서는 직접 파일 수정이 금지됩니다.

올바른 절차:
1. design.md 작성 (Write 허용)
2. task-create.sh로 태스크 생성
3. 사용자 승인 받기
4. EXECUTION 단계로 전환
5. Worker agent가 실제 작업 수행

허용된 파일:
- design.md (계획 문서)
- session.json, context.json (세션 상태)
- exploration/*.md (탐색 결과)"}
EOF

exit 0
