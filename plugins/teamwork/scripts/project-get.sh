#!/bin/bash
# project-get.sh - Get teamwork project info
# Usage: project-get.sh --dir <path>

set -euo pipefail

TEAMWORK_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) TEAMWORK_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: project-get.sh --dir <path>"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$TEAMWORK_DIR" ]]; then
  echo "Error: --dir required" >&2
  exit 1
fi

PROJECT_FILE="$TEAMWORK_DIR/project.json"

if [[ ! -f "$PROJECT_FILE" ]]; then
  echo "Error: Project file not found: $PROJECT_FILE" >&2
  exit 1
fi

cat "$PROJECT_FILE"
