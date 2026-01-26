---
name: teamwork-swarm
description: "Manage teamwork swarm workers (spawn, status, restart, stop)"
argument-hint: "<status|restart|stop|add> [--project NAME] [--team NAME] [--worker ID] [--role ROLE] | --help"
allowed-tools: ["Bash", "Read", "Glob"]
---

# Teamwork Swarm Command

## Overview

Manage a swarm of teamwork workers running in tmux sessions. Control worker lifecycle, monitor status, and coordinate parallel execution.

---

## Step 1: Parse Subcommand and Arguments

Parse the first argument as subcommand:
- `status`: Show swarm status
- `restart`: Restart a worker
- `stop`: Stop worker(s) or entire swarm
- `add`: Add new worker to swarm

Parse options:
- `--project NAME`: Override project detection
- `--team NAME`: Override sub-team detection
- `--worker ID`: Target specific worker (for restart/stop)
- `--role ROLE`: Worker role (for add)

Detect project/team if not specified:
```bash
# Default detection
PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" || echo "unknown")
SUB_TEAM=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo "main")

# Check for overrides in arguments
```

Teamwork directory: `~/.claude/teamwork/{PROJECT}/{SUB_TEAM}/`

---

## Step 2: Execute Subcommand

### Subcommand: status

Display current swarm status including worker information, task assignments, and health.

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

bun "${SCRIPTS}/swarm-status.js" \
  --project "${PROJECT}" \
  --team "${SUB_TEAM}"
```

**Output format:**
```
═══════════════════════════════════════════════
 SWARM STATUS
═══════════════════════════════════════════════

 Project: my-app
 Sub-team: master
 Session: teamwork-my-app

───────────────────────────────────────────────
 WORKERS
───────────────────────────────────────────────

 ID    Role       Pane  Status    Current Task
 ────  ─────────  ────  ────────  ─────────────
 w1    backend    0     working   #3
 w2    frontend   1     idle      -
 w3    test       2     working   #7

───────────────────────────────────────────────
 SWARM INFO
───────────────────────────────────────────────

 Total Workers: 3
 Active Tasks:  2
 Worktrees:     enabled
 Created:       2026-01-26 10:00:00

───────────────────────────────────────────────
 COMMANDS
───────────────────────────────────────────────

 /teamwork-swarm restart --worker w1
 /teamwork-swarm stop --worker w2
 /teamwork-swarm add --role devops
 /teamwork-swarm stop (stop all)

═══════════════════════════════════════════════
```

**If swarm doesn't exist:**
```
Error: No active swarm found for {PROJECT}/{SUB_TEAM}

To start a swarm, use:
  /teamwork "your goal" --workers 3
```

Exit with code 1.

---

### Subcommand: restart --worker <id>

Restart a specific worker. Useful when a worker is stuck or crashed.

```bash
# Validate --worker parameter
if [ -z "${WORKER_ID}" ]; then
  echo "Error: --worker required for restart"
  echo "Usage: /teamwork-swarm restart --worker <id>"
  exit 1
fi

SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

# Stop the worker first
bun "${SCRIPTS}/swarm-stop.js" \
  --project "${PROJECT}" \
  --team "${SUB_TEAM}" \
  --worker "${WORKER_ID}"

# Spawn new worker with same role
bun "${SCRIPTS}/swarm-spawn.js" \
  --project "${PROJECT}" \
  --team "${SUB_TEAM}" \
  --worker-id "${WORKER_ID}"
```

**Output:**
```
Restarting worker w1...
✓ Worker w1 stopped (pane 0)
✓ Worker w1 restarted (pane 0, role: backend)

Worker w1 is now ready to claim tasks.
```

**If worker doesn't exist:**
```
Error: Worker w1 not found in swarm

Available workers: w1, w2, w3

Use /teamwork-swarm status to see worker list.
```

---

### Subcommand: stop

Stop worker(s) or entire swarm.

#### Stop specific worker

```bash
if [ -n "${WORKER_ID}" ]; then
  # Stop single worker
  bun "${SCRIPTS}/swarm-stop.js" \
    --project "${PROJECT}" \
    --team "${SUB_TEAM}" \
    --worker "${WORKER_ID}"
fi
```

**Output:**
```
Stopping worker w2...
✓ Worker w2 stopped (pane 1)
✓ Worktree cleaned up

Worker w2 has been removed from swarm.
```

#### Stop entire swarm

```bash
if [ -z "${WORKER_ID}" ]; then
  # Stop all workers
  bun "${SCRIPTS}/swarm-stop.js" \
    --project "${PROJECT}" \
    --team "${SUB_TEAM}" \
    --all
fi
```

**Output:**
```
Stopping swarm for my-app/master...
✓ Worker w1 stopped
✓ Worker w2 stopped
✓ Worker w3 stopped
✓ tmux session 'teamwork-my-app' killed
✓ Worktrees cleaned up

Swarm stopped. Use /teamwork "goal" to restart.
```

---

### Subcommand: add --role <role>

Add a new worker to existing swarm.

```bash
# Validate --role parameter
if [ -z "${ROLE}" ]; then
  echo "Error: --role required for add"
  echo "Usage: /teamwork-swarm add --role <role>"
  echo ""
  echo "Available roles:"
  echo "  frontend, backend, test, devops, docs, security, review"
  exit 1
fi

SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

# Spawn new worker
bun "${SCRIPTS}/swarm-spawn.js" \
  --project "${PROJECT}" \
  --team "${SUB_TEAM}" \
  --role "${ROLE}" \
  --count 1
```

**Output:**
```
Adding worker to swarm...
✓ Worker w4 spawned (pane 3, role: devops)
✓ Worktree created at ~/.claude/teamwork/my-app/worktrees/w4

Worker w4 is now ready to claim tasks.

Current workers: w1 (backend), w2 (frontend), w3 (test), w4 (devops)
```

**If swarm doesn't exist:**
```
Error: No active swarm found for {PROJECT}/{SUB_TEAM}

To start a swarm, use:
  /teamwork "your goal" --workers 3
```

---

## Step 3: Display Results

For all subcommands, display the result in a clear, human-readable format.

Include:
- Success/error status
- Worker information (ID, role, pane, status)
- Next steps or suggested commands
- Error details if operation failed

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |
| `--worker ID` | Target specific worker (required for restart, optional for stop) |
| `--role ROLE` | Worker role (required for add) |

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
# Show swarm status
/teamwork-swarm status

# Show status for specific project
/teamwork-swarm status --project my-app --team feature-x

# Restart stuck worker
/teamwork-swarm restart --worker w1

# Stop single worker
/teamwork-swarm stop --worker w2

# Stop entire swarm
/teamwork-swarm stop

# Add backend worker to swarm
/teamwork-swarm add --role backend

# Add test worker
/teamwork-swarm add --role test
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| No active swarm | Swarm not started | Use `/teamwork "goal"` to create swarm |
| Worker not found | Invalid worker ID | Check `/teamwork-swarm status` for valid IDs |
| --worker required | Missing parameter | Specify `--worker <id>` for restart/stop |
| --role required | Missing parameter | Specify `--role <role>` for add |

---

## Integration with Orchestrator

The swarm commands are designed to work alongside the orchestrator:

1. **Orchestrator**: Creates project, decomposes tasks, spawns initial workers
2. **Swarm commands**: Provide manual control over worker lifecycle
3. **Orchestrator monitors**: Detects dead workers, triggers auto-restart
4. **Users**: Can intervene with `/teamwork-swarm` commands as needed

**Typical workflow:**

```bash
# 1. Orchestrator starts swarm automatically
/teamwork "Build API" --workers 3

# 2. Monitor progress
/teamwork-status

# 3. Check swarm status
/teamwork-swarm status

# 4. Restart stuck worker (if needed)
/teamwork-swarm restart --worker w2

# 5. Add more workers during execution
/teamwork-swarm add --role backend

# 6. Stop swarm when done (or let orchestrator finish)
/teamwork-swarm stop
```
