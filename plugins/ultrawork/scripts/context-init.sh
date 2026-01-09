#!/bin/bash
# context-init.sh - Initialize context.json with expected explorers
# Usage: context-init.sh --session <dir> --expected "overview,exp-1,exp-2,exp-3"

set -euo pipefail

SESSION_DIR=""
EXPECTED=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --session) SESSION_DIR="$2"; shift 2 ;;
    --expected) EXPECTED="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: context-init.sh --session <dir> --expected \"overview,exp-1,exp-2\""
      echo ""
      echo "Initializes context.json with expected explorer IDs."
      echo "exploration_complete will be set to true when all expected explorers are added."
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_DIR" || -z "$EXPECTED" ]]; then
  echo "Error: --session and --expected required" >&2
  exit 1
fi

CONTEXT_FILE="$SESSION_DIR/context.json"

# Build expected_explorers array
EXPECTED_JSON=$(echo "$EXPECTED" | tr ',' '\n' | jq -R . | jq -s .)

# Initialize or update context.json
if [[ ! -f "$CONTEXT_FILE" ]]; then
  cat > "$CONTEXT_FILE" << EOF
{
  "version": "2.1",
  "expected_explorers": $EXPECTED_JSON,
  "exploration_complete": false,
  "explorers": [],
  "key_files": [],
  "patterns": [],
  "constraints": []
}
EOF
else
  # Update existing context.json
  TEMP_FILE=$(mktemp)
  jq --argjson expected "$EXPECTED_JSON" '
    .expected_explorers = $expected |
    .exploration_complete = false
  ' "$CONTEXT_FILE" > "$TEMP_FILE"
  mv "$TEMP_FILE" "$CONTEXT_FILE"
fi

echo "OK: context.json initialized"
echo "    Expected explorers: $EXPECTED"
