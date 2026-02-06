---
name: worker-workflow
description: |
  Core task execution workflow for teamwork workers using native Claude Code APIs.
  Covers task discovery, claiming, implementation, evidence collection, and completion.
---

# Task Execution Workflow

This skill provides the complete workflow for executing teamwork tasks using native Claude Code APIs. Follow these phases in order.

---

## Phase 1: Find Task

List available tasks using native TaskList:

```python
# List all tasks in the team
tasks = TaskList()
```

Filter for tasks that are:
- **Unblocked**: No pending dependencies (all `blockedBy` tasks are completed)
- **Unowned**: No `owner` assigned yet
- **Open**: Status is not `completed` or `in_progress`

If your agent has a role specialization, prioritize tasks matching your role.

**If no task found:** Send a message to the orchestrator and wait for assignment.

```python
SendMessage(
    type="message",
    recipient="orchestrator",
    content="No available tasks matching my role. Waiting for assignment.",
    summary="Worker idle - no tasks available"
)
```

---

## Phase 2: Claim Task

Claim the task by setting yourself as the owner and updating the status:

```python
TaskUpdate(
    taskId="<TASK_ID>",
    owner="<your-agent-name>",
    status="in_progress",
    activeForm="Working on: <task subject>"
)
```

**If claim fails (conflict):** Another worker took it. Return to Phase 1 and find a different task.

---

## Phase 3: Implement

Execute the task using your specialization:

1. Read the task description carefully (use `TaskGet` if needed)
2. Use tools: Read, Write, Edit, Bash, Glob, Grep
3. Follow existing patterns in the codebase
4. Keep changes focused on the task scope

```python
# Get full task details if needed
task = TaskGet(taskId="<TASK_ID>")
```

---

## Phase 4: Verify and Collect Evidence

For each deliverable, collect **concrete evidence**:

| Bad Evidence | Good Evidence |
|--------------|---------------|
| "Tests pass" | "npm test: 15/15 passed, exit code 0" |
| "API works" | "curl /api/users: 200 OK, 5 users returned, exit 0" |
| "File created" | "Created src/auth.ts (127 lines)" |

**Exit code requirement**: All command evidence MUST include exit code.

Append evidence to the task description as markdown:

```python
TaskUpdate(
    taskId="<TASK_ID>",
    description="""
<original task description>

## Evidence
- Created src/models/User.ts (85 lines)
- npm run db:migrate: exit code 0
- npm test -- schema.test.ts: 8/8 passed, exit code 0
"""
)
```

---

## Phase 5: Complete Task

### On Success

Mark the task as completed and notify the orchestrator:

```python
# Mark task complete
TaskUpdate(taskId="<TASK_ID>", status="completed")

# Notify orchestrator
SendMessage(
    type="message",
    recipient="orchestrator",
    content="Task <TASK_ID> complete. <brief summary of what was done>.",
    summary="Task <TASK_ID> completed"
)
```

### On Failure

Add failure evidence to the description and release the task for another worker:

```python
# Add failure evidence
TaskUpdate(
    taskId="<TASK_ID>",
    description="""
<original description>

## Failure
- FAILED: npm test exited with code 1 - TypeError in auth.ts:42
- Root cause: Missing dependency injection for database client
""",
    status="open",
    owner=""
)

# Notify orchestrator of failure
SendMessage(
    type="message",
    recipient="orchestrator",
    content="Task <TASK_ID> failed. Reason: <failure description>. Released for retry.",
    summary="Task <TASK_ID> failed - released"
)
```

Do NOT mark as completed if failed - release for retry by another worker.

---

## Phase 6: Commit Changes

**After task is marked completed, commit ONLY the files you modified.**

**CRITICAL: Selective File Staging**

```bash
# FORBIDDEN - NEVER use these:
git add -A        # Stages ALL files
git add .         # Stages ALL files

# REQUIRED - Only add files YOU modified during this task:
git add path/to/file1.ts path/to/file2.ts && git commit -m "$(cat <<'EOF'
<type>(<scope>): <short description>

[teamwork] Task: <TASK_ID>

<TASK_SUBJECT>

Evidence:
- <evidence 1>
- <evidence 2>

Files changed:
- path/to/file1.ts
- path/to/file2.ts
EOF
)"
```

**Why selective staging?**
- Other workers may have uncommitted changes in the repo
- Only YOUR task changes should be in this commit
- Enables clean rollback per task if needed

**Angular Commit Message Types:**

| Type | When to Use |
|------|-------------|
| feat | New feature or functionality |
| fix | Bug fix |
| refactor | Code refactoring without behavior change |
| test | Adding or modifying tests |
| docs | Documentation changes |
| style | Code style changes (formatting, etc.) |
| chore | Build, config, or maintenance tasks |

**Skip commit if:**
- No files changed (`git status --porcelain` is empty)
- Task not completed (failed/released)

---

## Native API Quick Reference

| Action | API Call |
|--------|---------|
| List tasks | `TaskList()` |
| Get task details | `TaskGet(taskId="<id>")` |
| Claim task | `TaskUpdate(taskId="<id>", owner="<name>", status="in_progress")` |
| Update description | `TaskUpdate(taskId="<id>", description="...")` |
| Complete task | `TaskUpdate(taskId="<id>", status="completed")` |
| Release task | `TaskUpdate(taskId="<id>", status="open", owner="")` |
| Message orchestrator | `SendMessage(type="message", recipient="orchestrator", content="...")` |

---

## Summary Checklist

Before ending your work, verify:

- [ ] Phase 1: Found an available task
- [ ] Phase 2: Successfully claimed it (owner set, status in_progress)
- [ ] Phase 3: Implemented the solution
- [ ] Phase 4: Collected concrete evidence with exit codes
- [ ] Phase 5: Called TaskUpdate with status="completed" OR released with status="open"
- [ ] Phase 6: Committed ONLY your modified files (if task completed)

**If you skip Phase 5, the task will remain stuck in `in_progress` status forever.**
**If you skip Phase 6, your changes may be lost or mixed with other workers' changes.**
