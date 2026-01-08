#!/bin/bash
# context-add.sh - Add explorer findings to context.json
# Usage: context-add.sh --session <path> --explorer-id <id> --hint "..." --files "f1,f2" --patterns "p1,p2" --summary "..."

set -euo pipefail

SESSION_PATH=""
EXPLORER_ID=""
HINT=""
FILES=""
PATTERNS=""
SUMMARY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_PATH="$2"; shift 2 ;;
    --explorer-id) EXPLORER_ID="$2"; shift 2 ;;
    --hint) HINT="$2"; shift 2 ;;
    --files) FILES="$2"; shift 2 ;;
    --patterns) PATTERNS="$2"; shift 2 ;;
    --summary) SUMMARY="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: context-add.sh --session <path> --explorer-id <id> --hint \"...\" --files \"f1,f2\" --patterns \"p1,p2\" --summary \"...\""
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_PATH" || -z "$EXPLORER_ID" ]]; then
  echo "Error: --session and --explorer-id required" >&2
  exit 1
fi

SESSION_DIR=$(dirname "$SESSION_PATH")
CONTEXT_FILE="$SESSION_DIR/context.json"

# Initialize context.json if needed
if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo '{"explorers": []}' > "$CONTEXT_FILE"
fi

# Build arrays
FILES_JSON="[]"
if [[ -n "$FILES" ]]; then
  FILES_JSON=$(echo "$FILES" | tr ',' '\n' | jq -R . | jq -s .)
fi

PATTERNS_JSON="[]"
if [[ -n "$PATTERNS" ]]; then
  PATTERNS_JSON=$(echo "$PATTERNS" | tr ',' '\n' | jq -R . | jq -s .)
fi

# Escape strings
HINT_ESCAPED=$(echo "${HINT:-}" | jq -R .)
SUMMARY_ESCAPED=$(echo "${SUMMARY:-}" | jq -R .)

# Build new explorer entry
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NEW_EXPLORER=$(cat << EOF
{
  "id": "$EXPLORER_ID",
  "hint": $HINT_ESCAPED,
  "findings": {
    "files": $FILES_JSON,
    "patterns": $PATTERNS_JSON,
    "summary": $SUMMARY_ESCAPED
  },
  "completed_at": "$TIMESTAMP"
}
EOF
)

# Add to context
TEMP_FILE=$(mktemp)
jq ".explorers += [$NEW_EXPLORER]" "$CONTEXT_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$CONTEXT_FILE"

echo "OK: Explorer $EXPLORER_ID added to context"
cat "$CONTEXT_FILE"
