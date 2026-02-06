---
name: teamwork-status
description: "Show teamwork project status dashboard"
argument-hint: '[--project NAME] [--team NAME]'
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/project-status.js:*)", "Read", "TaskList"]
---

# Teamwork Status Command

## Overview

Display a dashboard-style status view of a teamwork project. Uses native TaskList for live task status and project-status.js for project metadata.

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

## Step 2: Gather Status Data

**Option A: Use project-status.js for project metadata**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/project-status.js" --project "${PROJECT}" --team "${SUB_TEAM}" --format table
```

**Option B: Use native TaskList for live task status**

```python
tasks = TaskList()
# Parse task list for status counts
```

Combine both sources for a comprehensive dashboard.

**If project doesn't exist:**
```
Error: Project not found: {PROJECT}/{SUB_TEAM}

Start a project with: /teamwork "your goal"
```

## Step 3: Display Dashboard

```markdown
# Teamwork Status

## Project
- Name: {PROJECT}
- Sub-team: {SUB_TEAM}
- Goal: {goal}

## Progress

{completed}/{total} tasks ({percentage}%)

| Status | Count |
|--------|-------|
| Completed | {n} |
| In Progress | {n} |
| Pending | {n} |
| Blocked | {n} |

## Tasks

| ID | Task | Status | Owner |
|----|------|--------|-------|
| 1 | ... | completed | worker-backend |
| 2 | ... | in_progress | worker-frontend |
| 3 | ... | pending | - |

## Commands
- /teamwork-worker     Start a worker
- /teamwork-verify     Run verification
- /teamwork-clean      Clean up project
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |
