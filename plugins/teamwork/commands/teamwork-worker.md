---
name: teamwork-worker
description: "Join a teamwork project as a worker teammate"
argument-hint: '[--role ROLE] [--project NAME] [--team NAME]'
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/project-*.js:*)", "Task", "Read"]
---

# Teamwork Worker Command

## Overview

Join an existing teamwork project as a worker teammate. The worker uses native teammate API (TaskList, TaskUpdate, SendMessage) to find and complete tasks.

**Automatic Role Detection**: When `--role` is not specified, the worker reads available tasks from project metadata and selects the appropriate role-specific agent.

**Role Selection Precedence**: `--role` flag (explicit) > task.role (auto-detected) > "worker" (generic fallback)

---

## Step 1: Read Project Metadata

Read project metadata to verify the project exists and get context:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/project-status.js" --project "${PROJECT}" --team "${SUB_TEAM}" --format json
```

Parse options from arguments:
- `--project NAME`: Override project detection (default: git repo name)
- `--team NAME`: Override sub-team detection (default: branch name)
- `--role ROLE`: Specify worker role

**If project doesn't exist:**
```
Error: No teamwork project found for: {PROJECT}/{SUB_TEAM}

Start a project with: /teamwork "your goal"
```

## Step 2: Spawn Worker Agent as Teammate

**Determine agent type using precedence order:**

```python
# Precedence: user --role > default 'worker'
if user_specified_role:
    subagent_type = f"teamwork:{user_specified_role}"
else:
    subagent_type = "teamwork:worker"
```

**Valid role values**: `frontend`, `backend`, `test`, `devops`, `docs`, `security`, `review`, `worker`

**ACTION REQUIRED - Call Task tool with:**
- subagent_type: `{subagent_type}` (determined using logic above)
- team_name: `{project}-{sub_team}` (join existing team)
- name: `worker-{role}`
- prompt:
  ```
  PROJECT: {project}
  SUB_TEAM: {sub_team}
  ROLE: {role or "any"}

  You are a worker teammate. Use native API to find and complete tasks:

  1. TaskList() to find available tasks
  2. TaskUpdate(taskId, owner="worker-{role}", status="in_progress") to claim
  3. Implement the task using Read, Write, Edit, Bash
  4. TaskUpdate(taskId, status="completed") when done
  5. SendMessage to orchestrator with completion summary
  ```

Wait for worker to complete using TaskOutput.

## Step 3: Report Result

Display what happened:

```markdown
# Worker Complete

## Role
{role}

## Result
{worker's completion summary}

## Commands
- /teamwork-status    Check project progress
- /teamwork-worker    Start another worker
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |
| `--role ROLE` | Worker specialization role |

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

## Usage Examples

```bash
# Join as generic worker (auto-detect role from tasks)
/teamwork-worker

# Join as specific role
/teamwork-worker --role backend

# Join specific project
/teamwork-worker --project my-app --team auth-v2 --role frontend
```
