---
name: teamwork-worker
description: "Claim and complete teamwork tasks (one-shot or continuous loop)"
argument-hint: "[--project NAME] [--team NAME] [--role ROLE] [--loop] [--strict] | --help"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/worker-setup.js:*)", "Task", "TaskOutput", "Read", "Edit", "mcp__plugin_serena_serena__activate_project"]
---

# Teamwork Worker Command

## Overview

Workers claim and complete tasks from a teamwork project. Can run in one-shot mode (default) or continuous loop mode.

---

## Step 0: Serena Project Activation (Optional)

If the MCP tool `mcp__plugin_serena_serena__activate_project` is available, activate Serena for enhanced code navigation:

```python
# Check if Serena is available and activate
if "mcp__plugin_serena_serena__activate_project" in available_tools:
    try:
        mcp__plugin_serena_serena__activate_project(project=".")
        # Serena enabled - worker agents can use symbol-based tools
    except:
        pass  # Continue without Serena
```

**Benefits when Serena is active:**
- Workers: `replace_symbol_body`, `rename_symbol` for safe refactoring
- Role specialists: Symbol-based tools for their expertise area

**If Serena is not available, agents will use standard tools (Read, Edit, Grep).**

---

## Step 1: Parse Arguments

Execute the worker setup script:

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/worker-setup.js" $ARGUMENTS
```

Parse the output to get:
- Project name
- Sub-team name
- Role filter (optional)
- Loop mode (true/false)
- Strict mode (true/false)
- Teamwork directory path

**If no project found:** Show error and suggest `/teamwork "goal"` first.

**If `--loop` mode:**
Register loop state for this terminal:

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/loop-state.js" --set --project "{PROJECT}" --team "{SUB_TEAM}" --role "{ROLE}"
```

## Step 2: Check for Available Tasks

Read task files to find available work:

```bash
ls {TEAMWORK_DIR}/{PROJECT}/{SUB_TEAM}/tasks/
```

Count:
- Total tasks
- Open tasks
- Tasks matching role filter (if specified)

**If no open tasks:**
```
No open tasks available.
Project complete or all tasks claimed.

Use /teamwork-status to check progress.
```

## Step 3: Spawn Worker Agent

**ACTION REQUIRED - Call Task tool with:**
- subagent_type: "teamwork:worker" (or "teamwork:{role}" if role specified)
- model: "sonnet"
- prompt:
  ```
  TEAMWORK_DIR: {teamwork_dir}
  PROJECT: {project}
  SUB_TEAM: {sub_team}

  Options:
  - role_filter: {role or null}
  - strict_mode: {true or false}
  ```

Wait for worker to complete using TaskOutput.

**Strict Mode Behavior:**

When `--strict` is enabled, workers must:
- Provide concrete evidence for EVERY success criterion
- Run tests and capture exit codes
- Document file paths created/modified
- Include command outputs in evidence
- Never mark tasks resolved without verification

Without `--strict`, workers use relaxed evidence collection (implementation-focused).

## Step 4: Report Result

Display what happened:

```markdown
# Task Completed

## Task
{task.subject}

## Status
{resolved or failed}

## Evidence
{list of evidence}

## Progress
{resolved}/{total} tasks complete
```

## Step 5: Loop Mode (if --loop)

**If `--loop` was set and there are more open tasks:**

Output the continue marker:

```
__TEAMWORK_CONTINUE__
```

The hook reads state from `loop-state.js` and triggers the next iteration with saved context.

**If no more tasks:**

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/loop-state.js" --clear
```

Exit and report completion.

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |
| `--role ROLE` | Only claim tasks with this role |
| `--loop` | Continuous mode - keep claiming tasks |
| `--strict` | Enable strict evidence mode (require concrete verification for all criteria) |

## Role Options

| Role | Description |
|------|-------------|
| `frontend` | UI, components, styling |
| `backend` | API, services, database |
| `test` | Tests, fixtures, mocks |
| `devops` | CI/CD, deployment |
| `docs` | Documentation |
| `security` | Auth, permissions |
| `review` | Code review |

---

## Examples

```bash
# One-shot: complete one task
/teamwork-worker

# Continuous: keep working until done
/teamwork-worker --loop

# Specialized: only frontend tasks
/teamwork-worker --role frontend

# Specialized continuous
/teamwork-worker --role backend --loop

# Strict evidence mode (for wave verification)
/teamwork-worker --strict

# Strict + loop (continuous with verification)
/teamwork-worker --strict --loop

# Strict + role specialization
/teamwork-worker --role test --strict

# Specific project
/teamwork-worker --project myapp --team feature-x
```
