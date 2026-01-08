#!/bin/bash
# context-add.sh - Add explorer summary to context.json (lightweight, with link to detailed markdown)
# Usage: context-add.sh --session <dir> --explorer-id <id> --hint "..." --file "exploration/exp-1.md" --summary "..." --key-files "f1,f2" --patterns "p1,p2"

set -euo pipefail

SESSION_DIR=""
EXPLORER_ID=""
HINT=""
FILE=""
SUMMARY=""
KEY_FILES=""
PATTERNS=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_DIR="$2"; shift 2 ;;
    --explorer-id) EXPLORER_ID="$2"; shift 2 ;;
    --hint) HINT="$2"; shift 2 ;;
    --file) FILE="$2"; shift 2 ;;
    --summary) SUMMARY="$2"; shift 2 ;;
    --key-files) KEY_FILES="$2"; shift 2 ;;
    --patterns) PATTERNS="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: context-add.sh --session <dir> --explorer-id <id> --hint \"...\" --file \"exploration/exp-1.md\" --summary \"...\" --key-files \"f1,f2\" --patterns \"p1,p2\""
      echo ""
      echo "Adds a lightweight explorer entry to context.json with link to detailed markdown."
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_DIR" || -z "$EXPLORER_ID" ]]; then
  echo "Error: --session and --explorer-id required" >&2
  exit 1
fi

CONTEXT_FILE="$SESSION_DIR/context.json"

# Initialize context.json if needed
if [[ ! -f "$CONTEXT_FILE" ]]; then
  cat > "$CONTEXT_FILE" << 'EOF'
{
  "version": "2.0",
  "explorers": [],
  "key_files": [],
  "patterns": [],
  "constraints": []
}
EOF
fi

# Build key_files array
KEY_FILES_JSON="[]"
if [[ -n "$KEY_FILES" ]]; then
  KEY_FILES_JSON=$(echo "$KEY_FILES" | tr ',' '\n' | jq -R . | jq -s .)
fi

# Build patterns array
PATTERNS_JSON="[]"
if [[ -n "$PATTERNS" ]]; then
  PATTERNS_JSON=$(echo "$PATTERNS" | tr ',' '\n' | jq -R . | jq -s .)
fi

# Escape strings
HINT_ESCAPED=$(echo "${HINT:-}" | jq -R .)
FILE_ESCAPED=$(echo "${FILE:-}" | jq -R .)
SUMMARY_ESCAPED=$(echo "${SUMMARY:-}" | jq -R .)

# Build new explorer entry (lightweight - just summary and link)
NEW_EXPLORER=$(cat << EOF
{
  "id": "$EXPLORER_ID",
  "hint": $HINT_ESCAPED,
  "file": $FILE_ESCAPED,
  "summary": $SUMMARY_ESCAPED
}
EOF
)

# Add explorer to context
TEMP_FILE=$(mktemp)
jq ".explorers += [$NEW_EXPLORER]" "$CONTEXT_FILE" > "$TEMP_FILE"

# Merge key_files (deduplicate)
jq --argjson new_files "$KEY_FILES_JSON" '.key_files = (.key_files + $new_files | unique)' "$TEMP_FILE" > "${TEMP_FILE}.2"
mv "${TEMP_FILE}.2" "$TEMP_FILE"

# Merge patterns (deduplicate)
jq --argjson new_patterns "$PATTERNS_JSON" '.patterns = (.patterns + $new_patterns | unique)' "$TEMP_FILE" > "${TEMP_FILE}.2"
mv "${TEMP_FILE}.2" "$TEMP_FILE"

mv "$TEMP_FILE" "$CONTEXT_FILE"

echo "OK: Explorer $EXPLORER_ID added to context.json"
echo "    File: $FILE"
echo "    Summary: ${SUMMARY:0:50}..."
