---
name: teamwork
description: "Start a teamwork project with native agent team collaboration"
argument-hint: '"<goal>" [--project NAME] [--team NAME]'
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-teamwork.js:*)", "Task", "TaskOutput", "Read", "AskUserQuestion", "mcp__plugin_serena_serena__activate_project"]
---

# Teamwork Command

## Overview

Teamwork enables native agent team collaboration. An orchestrator (team lead) handles the full project lifecycle: planning, spawning workers, coordination, and verification -- all through Claude's native teammate API.

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

This initializes project metadata and validates the environment (including `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).

Parse the output to get:
- Project name
- Sub-team name
- Teamwork directory path
- Goal

## Step 2: Spawn Orchestrator

<CRITICAL>
**SPAWN THE ORCHESTRATOR AGENT NOW.**

The orchestrator is the team lead. It handles the full project lifecycle:
1. Explore the codebase
2. Create tasks with dependencies (TaskCreate + addBlockedBy)
3. Spawn worker teammates (Task with team_name)
4. Coordinate via SendMessage
5. Monitor progress via TaskList
6. Trigger final verification
7. Report project completion
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
  ```

Wait for orchestrator to complete using TaskOutput.

**Note:** The orchestrator uses native TeamCreate, TaskCreate, Task (to spawn workers), SendMessage, and TaskList. It does not use file-based task management or polling loops.

## Step 3: Display Results

After the orchestrator completes, display the project summary:

```markdown
# Teamwork Project Complete

## Project
- Name: {PROJECT}
- Sub-team: {SUB_TEAM}
- Goal: {goal}

## Result
{orchestrator's completion summary}

## Commands
- /teamwork-status    Check project status
- /teamwork-verify    Run final verification manually
- /teamwork-clean     Clean up project
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |

---

## Usage Examples

```bash
# Start a project (orchestrator handles everything)
/teamwork "Build user authentication system"

# Explicit project/team names
/teamwork "Add search feature" --project my-app --team search-v2
```

---

## Related Commands

```bash
/teamwork-worker     Join as a worker teammate
/teamwork-status     Check project status dashboard
/teamwork-verify     Manually trigger final verification
/teamwork-clean      Clean up teamwork project
```
