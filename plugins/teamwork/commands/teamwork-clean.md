---
name: teamwork-clean
description: "Clean up teamwork project"
argument-hint: '[--project NAME] [--team NAME]'
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/project-clean.js:*)", "TeamDelete"]
---

# Teamwork Clean Command

## Overview

Clean up a teamwork project by removing task data and deleting the native team. This allows restarting a project from scratch.

---

## Step 1: Parse Arguments

Parse options:
- `--project NAME`: Override project detection
- `--team NAME`: Override sub-team detection

Detect project/team:
```bash
# Default detection
PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" || echo "unknown")
SUB_TEAM=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo "main")

# Check for overrides in arguments
```

## Step 2: Clean Project Data

Call the project-clean.js script to remove task files and project metadata:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/project-clean.js" --project "${PROJECT}" --team "${SUB_TEAM}"
```

The script handles:
- Project existence check
- Deleting task files
- Updating project.json with cleanup timestamp
- Preserving project metadata (goal, creation date)

**If project doesn't exist:**
```
Error: Project not found: {PROJECT}/{SUB_TEAM}
```

## Step 3: Delete Native Team

Delete the native agent team to clean up teammates:

```python
TeamDelete()
```

This terminates any active teammates and removes the team.

## Step 4: Display Results

```markdown
# Teamwork Project Cleaned

## Project
- Name: {PROJECT}/{SUB_TEAM}
- Goal: {goal}

## Actions Taken
- Task files deleted
- Project metadata updated
- Native team deleted (teammates terminated)

## Start Fresh
/teamwork "your new goal" --project "{PROJECT}" --team "{SUB_TEAM}"
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |

---

## Safety Notes

- Cleanup is **destructive** -- all task data is permanently deleted
- Project metadata (goal, creation date) is preserved
- Cleanup is idempotent -- safe to run multiple times
- No git operations are performed

---

## Usage Examples

```bash
# Clean current project
/teamwork-clean

# Clean specific project
/teamwork-clean --project my-app --team feature-x

# Start fresh after cleaning
/teamwork-clean
/teamwork "revised goal with better approach"
```
