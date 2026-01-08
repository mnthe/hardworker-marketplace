#!/bin/bash

# Teamwork Worker Setup Script
# Prepares worker environment and validates project exists

set -euo pipefail

# Default values
PROJECT_OVERRIDE=""
TEAM_OVERRIDE=""
ROLE_FILTER=""
LOOP_MODE=false
TEAMWORK_BASE="$HOME/.claude/teamwork"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 TEAMWORK WORKER - Claim and Complete Tasks
═══════════════════════════════════════════════════════════

USAGE:
  /teamwork-worker [OPTIONS]

OPTIONS:
  --project NAME    Override project name (default: git repo name)
  --team NAME       Override sub-team name (default: branch name)
  --role ROLE       Only claim tasks with this role
  --loop            Continuous mode (keep claiming tasks)
  -h, --help        Show this help message

───────────────────────────────────────────────────────────
 ROLES
───────────────────────────────────────────────────────────

  frontend    UI, components, styling
  backend     API, services, database
  test        Tests, fixtures, mocks
  devops      CI/CD, deployment
  docs        Documentation
  security    Auth, permissions
  review      Code review

───────────────────────────────────────────────────────────
 EXAMPLES
───────────────────────────────────────────────────────────

  One-shot mode (complete one task):
    /teamwork-worker

  Continuous mode (keep working):
    /teamwork-worker --loop

  Role-specific:
    /teamwork-worker --role frontend
    /teamwork-worker --role backend --loop

  Specific project:
    /teamwork-worker --project myapp --team feature-x

───────────────────────────────────────────────────────────
 HOW IT WORKS
───────────────────────────────────────────────────────────

  1. Find an open, unblocked task
  2. Claim it (mark as owned)
  3. Complete the work
  4. Collect evidence
  5. Mark as resolved

  In --loop mode, repeat until no tasks remain.

═══════════════════════════════════════════════════════════
HELP_EOF
      exit 0
      ;;
    --project)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --project requires a name argument" >&2
        exit 1
      fi
      PROJECT_OVERRIDE="$2"
      shift 2
      ;;
    --team)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --team requires a name argument" >&2
        exit 1
      fi
      TEAM_OVERRIDE="$2"
      shift 2
      ;;
    --role)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --role requires a role name" >&2
        echo "   Valid roles: frontend, backend, test, devops, docs, security, review" >&2
        exit 1
      fi
      ROLE_FILTER="$2"
      shift 2
      ;;
    --loop)
      LOOP_MODE=true
      shift
      ;;
    *)
      echo "⚠️  Unknown argument: $1" >&2
      shift
      ;;
  esac
done

# Detect project name
if [[ -n "$PROJECT_OVERRIDE" ]]; then
  PROJECT="$PROJECT_OVERRIDE"
else
  PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" || echo "unknown")
fi

# Detect sub-team name
if [[ -n "$TEAM_OVERRIDE" ]]; then
  SUB_TEAM="$TEAM_OVERRIDE"
else
  SUB_TEAM=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo "main")
fi

# Build paths
TEAMWORK_DIR="$TEAMWORK_BASE/$PROJECT/$SUB_TEAM"
PROJECT_FILE="$TEAMWORK_DIR/project.json"
TASKS_DIR="$TEAMWORK_DIR/tasks"

# Check if project exists
if [[ ! -f "$PROJECT_FILE" ]]; then
  echo "❌ Error: No teamwork project found" >&2
  echo "" >&2
  echo "   Project: $PROJECT" >&2
  echo "   Sub-team: $SUB_TEAM" >&2
  echo "   Expected at: $TEAMWORK_DIR" >&2
  echo "" >&2
  echo "   Start a project first:" >&2
  echo "     /teamwork \"your goal here\"" >&2
  echo "" >&2
  exit 1
fi

# Count tasks
TOTAL_TASKS=0
OPEN_TASKS=0

if [[ -d "$TASKS_DIR" ]]; then
  for task_file in "$TASKS_DIR"/*.json; do
    [[ -e "$task_file" ]] || continue
    TOTAL_TASKS=$((TOTAL_TASKS + 1))

    status=$(grep -o '"status": *"[^"]*"' "$task_file" 2>/dev/null | cut -d'"' -f4 || echo "")
    owner=$(grep -o '"owner": *[^,}]*' "$task_file" 2>/dev/null | sed 's/.*: *//' | tr -d ' "' || echo "")

    if [[ "$status" == "open" && ("$owner" == "null" || -z "$owner") ]]; then
      OPEN_TASKS=$((OPEN_TASKS + 1))
    fi
  done
fi

# Output worker info
cat <<EOF
═══════════════════════════════════════════════════════════
 TEAMWORK WORKER READY
═══════════════════════════════════════════════════════════

 Project: $PROJECT
 Sub-team: $SUB_TEAM
 Role filter: ${ROLE_FILTER:-"any"}
 Loop mode: $LOOP_MODE

───────────────────────────────────────────────────────────
 STATUS
───────────────────────────────────────────────────────────

 Total tasks: $TOTAL_TASKS
 Open tasks: $OPEN_TASKS

───────────────────────────────────────────────────────────

TEAMWORK_DIR=$TEAMWORK_DIR
PROJECT=$PROJECT
SUB_TEAM=$SUB_TEAM
ROLE_FILTER=${ROLE_FILTER:-}
LOOP_MODE=$LOOP_MODE
OPEN_TASKS=$OPEN_TASKS
EOF

# Exit with error if no open tasks
if [[ $OPEN_TASKS -eq 0 ]]; then
  echo "" >&2
  echo "⚠️  No open tasks available." >&2
  echo "   All tasks may be complete or claimed by other workers." >&2
  echo "" >&2
  echo "   Check status: /teamwork-status" >&2
  exit 1
fi
