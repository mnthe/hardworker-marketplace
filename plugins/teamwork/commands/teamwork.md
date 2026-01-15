---
name: teamwork
description: "Start a teamwork project with multi-session collaboration support"
argument-hint: "[--project NAME] [--team NAME] [--plans FILE1,FILE2,...] <goal> | --help"
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
- Coordinator: `get_symbols_overview`, `find_symbol` for precise code structure analysis
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

## Step 2: Load Plan Documents (if --plans provided)

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

## Step 3: Spawn Orchestrator or Coordinator

**Decision logic:**

- **If `--plans` provided** → Spawn **orchestrator** (wave-based execution with monitoring)
- **If no plans** → Spawn **coordinator** (simple task decomposition)

### Option A: Spawn Orchestrator (with --plans)

<CRITICAL>
**SPAWN THE ORCHESTRATOR AGENT NOW.**

The orchestrator will:
1. Load plan documents
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

  Goal: {goal}

  Options:
  - plans: {comma_separated_plan_files}
  - monitor_interval: 10
  - max_iterations: 1000
  ```

Wait for orchestrator to complete using TaskOutput.

**Note:** Orchestrator runs a monitoring loop, so this may take longer than coordinator.

### Option B: Spawn Coordinator (no plans - simple mode)

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

## Step 4: Display Results

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
| `--plans FILE1,FILE2,...` | Load plan documents for wave-based execution (spawns orchestrator instead of coordinator) |

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
