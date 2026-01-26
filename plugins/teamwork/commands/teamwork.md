---
name: teamwork
description: "Start a teamwork project with multi-session collaboration support"
argument-hint: '"<goal>" [--workers N|role:count,...] [--worktree] [--plans file] [--project NAME] [--team NAME]'
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-teamwork.js:*)", "Task", "TaskOutput", "Read", "Edit", "AskUserQuestion", "mcp__plugin_serena_serena__activate_project"]
---

# Teamwork Command

## Overview

Teamwork enables multi-session collaboration with role-based workers and file-per-task storage.

---

## Step 0: Serena Project Activation (Optional)

If the MCP tool `mcp__plugin_serena_serena__activate_project` is available, activate Serena for enhanced code navigation:

```python
# Check if Serena is available and activate
if "mcp__plugin_serena_serena__activate_project" in available_tools:
    try:
        mcp__plugin_serena_serena__activate_project(project=".")
        # Serena enabled - agents can use symbol-based tools
    except:
        pass  # Continue without Serena
```

**Benefits when Serena is active:**
- Orchestrator: `get_symbols_overview`, `find_symbol` for precise code structure analysis
- Workers: Symbol-based editing tools for safe refactoring

**If Serena is not available, agents will use standard tools (Read, Edit, Grep).**

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
- Plans option (if provided)

## Step 2: Parse Options

Parse the command-line options:

```javascript
const options = {
  workers: parseWorkersOption($ARGUMENTS),  // "5", "backend:2,frontend:1", "0", or null (default)
  worktree: hasWorktreeFlag($ARGUMENTS),    // boolean
  plans: parsePlansOption($ARGUMENTS)       // file list or null
}
```

**Default behavior (no --workers):**
- Orchestrator determines unique roles from tasks
- Spawns one worker per unique role

**--workers N:**
- Spawns N generic workers (no role specialization)

**--workers role:count,...:**
- Spawns specified count for each role
- Example: `--workers backend:2,frontend:1` → 2 backend + 1 frontend workers

**--workers 0:**
- Manual mode (no auto-spawning)
- Users start workers manually via `/teamwork-worker`

**--worktree:**
- Enables git worktree isolation
- Each worker operates in separate worktree branch
- Prevents file conflicts during parallel execution

## Step 3: Load Plan Documents (if --plans provided)

**If `--plans` option was provided:**

Read each plan file specified:

```bash
# For each plan file in comma-separated list
cat {plan_file_1}
cat {plan_file_2}
```

**Plans are optional.** If no plans provided, skip this step.

**Plan documents provide:**
- Technical requirements
- Component breakdown
- Dependencies between components
- Acceptance criteria
- Architecture decisions

## Step 4: Spawn Orchestrator

<CRITICAL>
**SPAWN THE ORCHESTRATOR AGENT NOW.**

The orchestrator handles the full project lifecycle:
1. Load plan documents (if --plans provided)
2. Explore the codebase
3. Create task breakdown with dependencies
4. Calculate waves for parallel execution
5. Monitor wave execution continuously
6. Trigger wave verification after each wave
7. Handle verification failures
8. Report project completion
</CRITICAL>

**ACTION REQUIRED - Call Task tool with:**
- subagent_type: "teamwork:orchestrator"
- model: "opus"
- prompt:
  ```
  TEAMWORK_DIR: {teamwork_dir}
  PROJECT: {project}
  SUB_TEAM: {sub_team}
  SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts

  Goal: {goal}

  Options:
  - plans: {comma_separated_plan_files or "none"}
  - workers: {workers_option or "auto"}
  - worktree: {true or false}
  - monitor_interval: 10
  - max_iterations: 1000
  ```

Wait for orchestrator to complete using TaskOutput.

**Note:** The orchestrator runs a monitoring loop and handles both planning and execution phases. If no plans are provided, it will decompose the goal into tasks directly.

## Step 5: Display Results

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

## Options

### --workers

Worker 수와 배치 방식을 지정합니다.

- **(기본)**: task의 unique role 수만큼 자동 spawn
- **숫자**: generic worker N개
- **role:count**: 특정 role별 worker 수 지정
- **0**: 수동 모드 (spawn 안 함)

**예시:**
```bash
# 기본: role 기반 자동 spawn
/teamwork "build API"

# 숫자: generic worker 5개
/teamwork "build API" --workers 5

# role:count 형식: backend 2개, frontend 1개
/teamwork "build API" --workers backend:2,frontend:1

# 수동 모드: spawn 안 함 (기존 동작)
/teamwork "build API" --workers 0
```

### --worktree

Git worktree 격리를 활성화합니다. 각 worker가 별도 worktree에서 작업하여 파일 충돌을 방지합니다.

**예시:**
```bash
/teamwork "build API" --worktree
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |
| `--plans FILE1,FILE2,...` | Load plan documents for orchestrator to create wave-based execution (optional) |
| `--workers N\|role:count,...` | Worker spawning mode (default: auto-detect from roles) |
| `--worktree` | Enable git worktree isolation for parallel execution |

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
