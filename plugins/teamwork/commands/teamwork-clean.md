---
name: teamwork-clean
description: "Clean teamwork project by deleting task and verification directories"
argument-hint: "[--project NAME] [--team NAME] | --help"
allowed-tools: ["Bash", "Read", "Glob"]
---

# Teamwork Clean Command

## Overview

Clean a teamwork project by deleting task and verification directories while preserving project metadata. This allows restarting a project from scratch with the same configuration.

---

## Step 1: Parse Arguments

Parse options:
- `--project NAME`: Override project detection
- `--team NAME`: Override sub-team detection
- `--help`: Show help message

Detect project/team:
```bash
# Default detection
PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" || echo "unknown")
SUB_TEAM=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo "main")

# Check for overrides in arguments
```

Teamwork directory: `~/.claude/teamwork/{PROJECT}/{SUB_TEAM}/`

## Step 2: Validate Project Exists

Check if project directory and project.json exist:

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"
PROJECT_FILE="${HOME}/.claude/teamwork/${PROJECT}/${SUB_TEAM}/project.json"

if [ ! -f "${PROJECT_FILE}" ]; then
    echo "Error: Project ${PROJECT}/${SUB_TEAM} not found"
    exit 1
fi
```

**If project doesn't exist:**
```
Error: Project not found: {PROJECT}/{SUB_TEAM}
```

Exit with code 1. Suggest:
- Check project name: `/teamwork-status` to list projects
- Create new project: `/teamwork "your goal"`

## Step 3: Execute Cleanup

Call the project-clean.js script:

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

bun "${SCRIPTS}/project-clean.js" --project "${PROJECT}" --team "${SUB_TEAM}"
```

The script automatically handles:
- Project existence check (exits with error if not found)
- Checking if already cleaned (exits gracefully if cleaned_at is set)
- Deleting directories: `tasks/`, `verification/`, `workers/`
- Updating `project.json` with `cleaned_at` timestamp
- Resetting stats to zero (total, open, in_progress, resolved all set to 0)
- Preserving project metadata (goal, created_at, etc.)

**If already cleaned:**
```
Project {PROJECT}/{SUB_TEAM} already cleaned at {timestamp}
```

Exit with code 0. Project can be cleaned multiple times safely.

**Error cases:**
- Failed to read project: Invalid JSON or file corruption
- Failed to delete directories: Permission issues
- Failed to update project: File system issues

## Step 4: Display Results

The script outputs a formatted cleanup report:

```markdown
═══════════════════════════════════════════════════════════
 TEAMWORK PROJECT CLEANED
═══════════════════════════════════════════════════════════

 Project: {PROJECT}/{SUB_TEAM}
 Goal: {goal}
 Created: {created_at}
 Cleaned: {cleaned_at}

───────────────────────────────────────────────────────────

 Deleted directories:
 - tasks/
 - verification/
 - workers/

 Project metadata preserved in:
 {project_file}

 Start fresh with:
 /teamwork --project "{PROJECT}" --team "{SUB_TEAM}"

═══════════════════════════════════════════════════════════
```

**Post-cleanup state:**
- Project directory still exists
- `project.json` updated with `cleaned_at` timestamp
- All task files deleted
- All verification files deleted
- All worker state files deleted
- Stats reset to zero
- Goal and other metadata preserved

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Project not found` | Project directory doesn't exist | Check project name with `/teamwork-status` or create with `/teamwork "goal"` |
| `Failed to read project` | Invalid JSON in project.json | Check file integrity, restore from backup if available |
| `Failed to delete {dir}` | Permission issues or locked files | Check file permissions, ensure no processes have files open |
| `Failed to update project` | File system errors | Check disk space and permissions |

### Safety Notes

- Cleanup is **destructive** - all tasks and verification results are permanently deleted
- Project metadata (goal, creation date) is preserved
- Cleanup is idempotent - safe to run multiple times
- No git operations are performed - only affects `~/.claude/teamwork/` directory

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |
| `--help` | Show help message |

---

## Related Commands

```bash
# Check project status before cleaning
/teamwork-status --project myapp --team feature-x

# Clean project (current directory detection)
/teamwork-clean

# Clean specific project
/teamwork-clean --project myapp --team feature-x

# Start fresh after cleaning
/teamwork --project myapp --team feature-x "new goal"

# View help
/teamwork-clean --help
```

---

## Use Cases

### Restart Failed Project
```bash
# Project got stuck or needs complete reset
/teamwork-clean --project myapp
/teamwork --project myapp "revised goal with better task breakdown"
```

### Clean Up Test Project
```bash
# After testing teamwork workflow
/teamwork-clean --project test-project
```

### Multiple Attempts
```bash
# Try different task decompositions
/teamwork "initial attempt"
# ... work on tasks ...
/teamwork-clean  # Start over
/teamwork "improved approach"
```
