---
name: teamwork-clean
description: "Reset and clean up teamwork project state. Use when project is stuck, failed, or needs a fresh start. Uses native TeamDelete API for cleanup."
user-invocable: false
---

# Teamwork Clean

## Overview

Teamwork-clean resets a project to start fresh by cleaning up team and task state.

### Core Principles

1. **Native API cleanup** - Uses `TeamDelete()` to remove team and all associated tasks
2. **Idempotent operation** - Safe to run multiple times
3. **Clean shutdown** - Sends shutdown messages to active workers before cleanup

### Use Case

When task state becomes inconsistent, workflow fails, or you need to restart execution with the same project configuration.

---

## When to Use

**USE teamwork-clean for:**
- Starting a new run in the same project (multiple attempts at same goal)
- Recovering from failed orchestration or stuck workers
- Cleaning up after testing or experimentation
- Resolving state corruption (stuck tasks, orphaned workers)

**DON'T use teamwork-clean for:**
- Normal project completion (state is valuable)
- Fixing a single task (release the task instead)
- Active projects with workers running (shut down workers first)

---

## Cleanup Process

### Step 1: Shutdown Active Workers

Before cleaning, send shutdown messages to all active teammates:

```python
# Notify all workers to stop
SendMessage(
    type="shutdown_request",
    recipient="worker-backend",
    content="Project cleanup in progress. Please stop."
)
SendMessage(
    type="shutdown_request",
    recipient="worker-frontend",
    content="Project cleanup in progress. Please stop."
)
```

### Step 2: Delete Team

Use the native `TeamDelete` API to remove the team and all associated tasks:

```python
# Delete team (removes all tasks and team state)
TeamDelete()
```

This removes:
- All task definitions and their status
- Task ownership and dependency information
- Team metadata

### Step 3: Recreate (Optional)

If restarting with the same goal, create a new team:

```python
# Create fresh team
TeamCreate(team_name="<team-name>", description="<project goal>")

# Recreate tasks from scratch
TaskCreate(subject="...", description="...")
```

---

## What Gets Cleaned

| Item | Method | Impact |
|------|--------|--------|
| All tasks | `TeamDelete()` | Task definitions, status, evidence, ownership |
| Team state | `TeamDelete()` | Team metadata and configuration |
| Worker associations | `TeamDelete()` | Worker-to-team bindings |

**After cleanup**: The team no longer exists. You start with a blank slate.

---

## What's Preserved

| Item | Why |
|------|-----|
| Project files on disk | Code changes remain in the git repository |
| Git history | All commits from previous run are preserved |
| Project metadata files | Plugin-level `project.json` if used by `project-create.js` |

---

## Usage

### Command Invocation

```bash
/teamwork-clean
```

### Workflow: Clean and Restart

```bash
# 1. Check current status
/teamwork-status

# 2. Clean the project
/teamwork-clean

# 3. Start fresh
/teamwork "same goal or updated goal"
```

### Workflow: After Failed Project

```bash
# Project failed, want to retry with different approach
/teamwork-clean

# Orchestrator will plan from scratch
/teamwork "updated goal with more context"
```

---

## Agent Guidance

### Decision-Making Checklist

Before recommending `/teamwork-clean`, verify:

1. **Is the project stuck?**
   - Check task status for stalled tasks (in_progress for too long)
   - Check if workers are idle with no available tasks

2. **Are workers stopped?**
   - Cleaning while workers are active causes undefined behavior
   - Send shutdown messages first, then clean

3. **Is cleanup the right solution?**
   - Single stuck task -> Release the task (TaskUpdate with status="open", owner="")
   - Want to abandon project entirely -> TeamDelete is sufficient
   - Just checking status -> Use `/teamwork-status` only

### When to Recommend Clean

| Situation | Recommend Clean? | Alternative |
|-----------|------------------|-------------|
| First project attempt failed | Yes | Clean and retry |
| Multiple tasks stuck | Yes | Shutdown workers, clean, restart |
| Single task needs retry | No | Release the task |
| Want to change goal | Yes | Clean and start with new goal |
| Checking progress | No | Use `/teamwork-status` |

---

## Related Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/teamwork` | Start or resume project | After cleaning, to begin fresh execution |
| `/teamwork-status` | Check project progress | Before cleaning, to diagnose issues |
