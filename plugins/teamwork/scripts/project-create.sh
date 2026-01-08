#!/bin/bash
# project-create.sh - Create teamwork project
# Usage: project-create.sh --dir <path> --project <name> --team <name> --goal "..."

set -euo pipefail

TEAMWORK_DIR=""
PROJECT=""
TEAM=""
GOAL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) TEAMWORK_DIR="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --team) TEAM="$2"; shift 2 ;;
    --goal) GOAL="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: project-create.sh --dir <path> --project <name> --team <name> --goal \"...\""
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$TEAMWORK_DIR" || -z "$PROJECT" || -z "$TEAM" || -z "$GOAL" ]]; then
  echo "Error: --dir, --project, --team, and --goal required" >&2
  exit 1
fi

# Create directory
mkdir -p "$TEAMWORK_DIR/tasks"

PROJECT_FILE="$TEAMWORK_DIR/project.json"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Escape goal
GOAL_ESCAPED=$(echo "$GOAL" | jq -R .)

# Create project.json
cat > "$PROJECT_FILE" << EOF
{
  "project": "$PROJECT",
  "sub_team": "$TEAM",
  "goal": $GOAL_ESCAPED,
  "created_at": "$TIMESTAMP",
  "total_tasks": 0,
  "roles_used": []
}
EOF

echo "OK: Project created"
cat "$PROJECT_FILE"
