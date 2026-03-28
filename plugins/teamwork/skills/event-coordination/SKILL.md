---
name: event-coordination
description: |
  Event-driven coordination for teamwork orchestrators.
  Replaces polling-based monitoring loop with TeammateIdle and TaskCompleted hooks.
user-invocable: false
---

# Event-Driven Coordination

This skill provides the event-driven coordination model for teamwork v3 orchestrators. It replaces the v2 polling-based monitoring loop with native Claude Code hooks.

---

## How Hooks Work

Claude Code provides two lifecycle hooks that enable event-driven orchestration:

| Hook | Trigger | Purpose |
|------|---------|---------|
| **TaskCompleted** | A task's status changes to `completed` | Track project progress, detect completion |
| **TeammateIdle** | A teammate finishes its current work | Detect available workers for task assignment |

### Hook Execution Flow

```
Event occurs (e.g., task completed)
    |
    v
Claude Code fires hook
    |
    v
Plugin hook script runs (project-progress.js or teammate-idle.js)
    |
    v
Hook script outputs context information to stdout
    |
    v
Context is injected into the orchestrator's conversation
    |
    v
Orchestrator takes action based on context
```

Hooks do NOT take actions directly. They provide **context** that enables the orchestrator to make informed decisions.

---

## TaskCompleted Hook

### What It Does

When any task is marked as `completed`, `project-progress.js` runs and outputs the current project progress:

```
Progress: 4/7 completed, 2 in progress, 1 pending.
```

Or when all tasks are done:

```
All 7 tasks completed. Ready for final verification.
```

### Orchestrator Response

The orchestrator receives this context and decides:

- **More tasks remain**: Continue waiting, or spawn additional workers if needed
- **All tasks done**: Spawn the final verifier

```python
# When hook reports all tasks completed
Task(
    subagent_type="teamwork:final-verifier",
    team_name="<team>",
    name="verifier",
    prompt="Verify project completion: run full build, full test suite, check all evidence..."
)
```

---

## TeammateIdle Hook

### What It Does

When a teammate becomes idle, `teammate-idle.js` runs and reports whether unassigned tasks are available:

```
worker-backend idle. 3 unassigned tasks available.
```

Or when no work remains:

```
worker-backend idle. No tasks available.
```

### Orchestrator Response

The orchestrator receives this context and decides:

- **Tasks available**: The idle worker will pick up a new task (via its own Phase 1: Find Task)
- **No tasks available**: Consider shutting down the idle worker

```python
# When no more tasks for an idle worker
SendMessage(
    type="shutdown_request",
    recipient="worker-backend",
    content="All tasks assigned or completed. You may stop."
)
```

---

## Event Flow: Full Lifecycle

```
1. Orchestrator creates tasks and spawns workers
   |
   v
2. Workers claim tasks (TaskUpdate: owner, status=in_progress)
   |
   v
3. Workers implement and collect evidence
   |
   v
4. Worker completes task (TaskUpdate: status=completed)
   |
   v
5. TaskCompleted hook fires
   |-- Hook outputs: "Progress: 4/7 completed..."
   |-- Orchestrator reads progress
   |
   v
6. Worker becomes idle
   |
   v
7. TeammateIdle hook fires
   |-- Hook outputs: "worker-backend idle. 2 unassigned tasks."
   |-- Worker picks up next task (return to step 2)
   |
   v
8. When all tasks completed:
   |-- TaskCompleted hook: "All 7 tasks completed."
   |-- Orchestrator spawns final-verifier
   |
   v
9. Final verification
   |-- Verifier checks build, tests, evidence
   |-- SendMessage to orchestrator with results
   |
   v
10. Orchestrator handles result
    |-- PASS: Shutdown workers, TeamDelete, report success
    |-- FAIL: Create fix tasks, workers pick them up (return to step 2)
```

---

## Comparison with v2 Polling Loop

| Aspect | v2 (Polling) | v3 (Event-Driven) |
|--------|--------------|-------------------|
| **Mechanism** | `mailbox-poll.js` with timeout | Native hooks (TaskCompleted, TeammateIdle) |
| **Response time** | Up to timeout interval (30s default) | Immediate on event |
| **Infrastructure** | Mailbox scripts, inbox files, polling loop | Zero custom infrastructure |
| **Wave management** | Wave status tracking, wave-calculate.js | Native `addBlockedBy` dependency resolution |
| **Code required** | ~600 lines (monitoring-loop skill + scripts) | ~50 lines (2 hook scripts) |
| **Orchestrator role** | Active polling in a loop | Reactive to hook context |
| **Failure detection** | Manual stale task checking | Hook reports on every state change |

### Key Differences

1. **No explicit loop**: The orchestrator does not run a monitoring loop. It reacts to hook-injected context.
2. **No wave system**: Dependencies are handled by native `addBlockedBy`. Tasks unblock automatically when their dependencies complete.
3. **No mailbox**: Workers communicate via `SendMessage` (native, auto-delivered). No inbox files or poll scripts.
4. **No wave verification**: There is no intermediate verification between task groups. Only final verification runs after all tasks complete.

---

## Hook Configuration

Hooks are configured in `hooks/hooks.json`:

```json
{
  "hooks": {
    "TaskCompleted": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/project-progress.js"
      }]
    }],
    "TeammateIdle": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/teammate-idle.js"
      }]
    }]
  }
}
```

Hook scripts:
- Read hook input from stdin (JSON, schema defensive-parsed)
- Read task states to compute progress
- Output context string to stdout
- Exit quickly (non-blocking, < 1 second)
- Silent on errors (log to stderr, exit 0)

---

## Best Practices

### For Orchestrators

1. **React, do not poll**: Wait for hook context instead of actively checking status
2. **Trust dependency resolution**: Native `addBlockedBy` handles task ordering. Do not manually track which tasks are unblocked.
3. **Spawn final verifier once**: When TaskCompleted hook reports all tasks done, spawn exactly one final-verifier
4. **Handle verification failure**: If final verification fails, create fix tasks with appropriate `addBlockedBy` dependencies and let workers pick them up naturally
5. **Clean shutdown**: After success, send shutdown messages to all workers and call `TeamDelete()`

### For Hook Scripts

1. **Defensive parsing**: Hook input schema is not fully documented. Parse with try/catch and exit 0 on errors.
2. **Idempotent output**: Hook may fire multiple times for the same event. Output must be safe to process repeatedly.
3. **Fast execution**: Hooks must complete in under 1 second. Do not perform expensive operations.
4. **No side effects**: Hooks provide context only. They must not modify task state, send messages, or spawn agents.

### For Workers

1. **Self-directed task discovery**: Workers find their own tasks via `TaskList()` and claim them. The orchestrator does not assign tasks directly.
2. **Notify on completion**: After completing a task, send a `SendMessage` to the orchestrator summarizing the result.
3. **Handle shutdown gracefully**: When receiving a `shutdown_request` message, finish current work and stop.

---

## Error Handling

| Scenario | Detection | Response |
|----------|-----------|----------|
| Hook script fails | stderr output, non-zero exit | Claude Code ignores output, orchestrator continues |
| Task stuck in_progress | TeammateIdle with no progress | Orchestrator checks stale tasks, releases if needed |
| All workers idle, tasks remain | Multiple TeammateIdle events | Orchestrator checks for blocked tasks, creates unblock tasks if needed |
| Final verification fails | Verifier sends failure message | Orchestrator creates fix tasks, workers resume |
| Hook fires but orchestrator missed it | Duplicate events possible | Idempotent orchestrator actions (check before acting) |
