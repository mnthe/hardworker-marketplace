#!/bin/bash

# Teamwork Setup Script
# Creates project structure for multi-session collaboration

set -euo pipefail

# Default values
GOAL_PARTS=()
PROJECT_OVERRIDE=""
TEAM_OVERRIDE=""
TEAMWORK_BASE="$HOME/.claude/teamwork"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
═══════════════════════════════════════════════════════════
 TEAMWORK - Multi-Session Collaboration Mode
═══════════════════════════════════════════════════════════

USAGE:
  /teamwork [OPTIONS] <GOAL...>

ARGUMENTS:
  GOAL...    Project goal (can be multiple words without quotes)

OPTIONS:
  --project NAME    Override project name (default: git repo name)
  --team NAME       Override sub-team name (default: branch name)
  -h, --help        Show this help message

───────────────────────────────────────────────────────────
 WHAT IT DOES
───────────────────────────────────────────────────────────

Teamwork enables multi-session collaboration:

  ✓ File-per-task storage (no conflicts)
  ✓ Role-based workers (frontend, backend, etc.)
  ✓ Parallel execution across terminals
  ✓ Dashboard status view

───────────────────────────────────────────────────────────
 WORKFLOW
───────────────────────────────────────────────────────────

  1. COORDINATOR    Create project and tasks
                    → Analyze goal
                    → Break down work
                    → Assign roles

  2. WORKERS        Claim and complete tasks
                    → Each terminal = one worker
                    → Concurrent execution
                    → Evidence collection

  3. MONITOR        Track progress
                    → Dashboard view
                    → By-role breakdown
                    → Active workers

───────────────────────────────────────────────────────────
 EXAMPLES
───────────────────────────────────────────────────────────

  Basic usage:
    /teamwork build a payment processing system

  Override project:
    /teamwork --project payments add checkout flow

  Override sub-team:
    /teamwork --team sprint-5 implement user stories

───────────────────────────────────────────────────────────
 RELATED COMMANDS
───────────────────────────────────────────────────────────

  /teamwork-worker        Claim and complete tasks
  /teamwork-worker --loop Continuous worker mode
  /teamwork-status        Check project status

───────────────────────────────────────────────────────────
 DIRECTORY STRUCTURE
───────────────────────────────────────────────────────────

  ~/.claude/teamwork/{project}/{sub-team}/
    ├── project.json        # Project metadata
    └── tasks/
        ├── 1.json          # Task files
        ├── 2.json
        └── ...

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
    *)
      GOAL_PARTS+=("$1")
      shift
      ;;
  esac
done

# Join all goal parts
GOAL="${GOAL_PARTS[*]:-}"

# Validate goal
if [[ -z "$GOAL" ]]; then
  echo "❌ Error: No goal provided" >&2
  echo "" >&2
  echo "   Usage: /teamwork <goal>" >&2
  echo "" >&2
  echo "   Examples:" >&2
  echo "     /teamwork build a REST API" >&2
  echo "     /teamwork --project myapp add authentication" >&2
  echo "" >&2
  echo "   For help: /teamwork --help" >&2
  exit 1
fi

# Detect project name
if [[ -n "$PROJECT_OVERRIDE" ]]; then
  PROJECT="$PROJECT_OVERRIDE"
else
  PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" || echo "unknown")
fi

# Detect sub-team name (from branch)
if [[ -n "$TEAM_OVERRIDE" ]]; then
  SUB_TEAM="$TEAM_OVERRIDE"
else
  SUB_TEAM=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo "main")
fi

# Create directory structure
TEAMWORK_DIR="$TEAMWORK_BASE/$PROJECT/$SUB_TEAM"
mkdir -p "$TEAMWORK_DIR/tasks"

# Generate timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Output setup message
cat <<EOF
═══════════════════════════════════════════════════════════
 TEAMWORK PROJECT INITIALIZED
═══════════════════════════════════════════════════════════

 Project: $PROJECT
 Sub-team: $SUB_TEAM
 Goal: $GOAL
 Started: $TIMESTAMP

───────────────────────────────────────────────────────────
 DIRECTORY
───────────────────────────────────────────────────────────

 $TEAMWORK_DIR/
   ├── project.json
   └── tasks/

───────────────────────────────────────────────────────────
 NEXT STEPS
───────────────────────────────────────────────────────────

 Spawning coordinator to create tasks...

═══════════════════════════════════════════════════════════

TEAMWORK_DIR=$TEAMWORK_DIR
PROJECT=$PROJECT
SUB_TEAM=$SUB_TEAM
GOAL=$GOAL
EOF
