---
name: teamwork
description: "Start a teamwork project with multi-session collaboration support"
argument-hint: "[--project NAME] [--team NAME] <goal> | --help"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-teamwork.js:*)", "Task", "TaskOutput", "Read", "Edit", "AskUserQuestion"]
---

# Teamwork Command

## Overview

Teamwork enables multi-session collaboration with role-based workers and file-per-task storage.

---

## Step 1: Initialize Project

Execute the setup script:

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-teamwork.js" $ARGUMENTS
```

This creates project at: `~/.claude/teamwork/{project}/{sub-team}/`

Parse the output to get:
- Project name
- Sub-team name
- Teamwork directory path
- Goal

## Step 2: Spawn Coordinator

<CRITICAL>
**SPAWN THE COORDINATOR AGENT NOW.**

The coordinator will:
1. Explore the codebase
2. Create task breakdown
3. Assign roles to tasks
4. Write task files
</CRITICAL>

**ACTION REQUIRED - Call Task tool with:**
- subagent_type: "teamwork:coordinator"
- model: "opus"
- prompt:
  ```
  TEAMWORK_DIR: {teamwork_dir}
  PROJECT: {project}
  SUB_TEAM: {sub_team}

  Goal: {goal}
  ```

Wait for coordinator to complete using TaskOutput.

## Step 3: Display Results

Read the project.json and task files:

```bash
cat {TEAMWORK_DIR}/{PROJECT}/{SUB_TEAM}/project.json
ls {TEAMWORK_DIR}/{PROJECT}/{SUB_TEAM}/tasks/
```

Display summary:

```markdown
# Teamwork Project Created

## Project
- Name: {PROJECT}
- Sub-team: {SUB_TEAM}
- Goal: {goal}
- Tasks: {total_tasks}

## Tasks

| ID | Task | Role | Blocked By |
|----|------|------|------------|
| 1 | ... | backend | - |
| 2 | ... | frontend | 1 |

## Next Steps
1. Open new terminal and run: /teamwork-worker
2. Check progress: /teamwork-status
3. Workers can specialize: /teamwork-worker --role frontend
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |

---

## Directory Structure

```
~/.claude/teamwork/{project}/{sub-team}/
├── project.json        # Project metadata
└── tasks/
    ├── 1.json
    ├── 2.json
    └── ...
```

## Related Commands

```bash
/teamwork-worker        # Claim and complete a task
/teamwork-worker --loop # Continuous worker mode
/teamwork-status        # Check project status
```
