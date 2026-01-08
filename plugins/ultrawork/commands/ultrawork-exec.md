---
name: ultrawork-exec
description: "Execute ultrawork plan document"
argument-hint: "[plan-file] | --help"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/*)", "Task", "TaskOutput", "Read", "Edit"]
---

# Ultrawork Exec Command

Execute a plan document created by `/ultrawork-plan`.

## Step 1: Find Plan Document

Look for plan file:
1. Argument provided: use that path
2. `docs/plans/ultrawork-plan.md`
3. `ULTRAWORK_PLAN.md`

```bash
if [ -f "docs/plans/ultrawork-plan.md" ]; then
  PLAN_FILE="docs/plans/ultrawork-plan.md"
elif [ -f "ULTRAWORK_PLAN.md" ]; then
  PLAN_FILE="ULTRAWORK_PLAN.md"
else
  echo "No plan found. Run /ultrawork-plan first"
  exit 1
fi
```

## Step 2: Parse Plan Document

Read the plan file and extract:
- Goal
- Tasks (id, title, complexity, depends_on, criteria)
- Execution order

```python
Read(file_path=PLAN_FILE)
# Parse markdown to extract task structure
```

## Step 3: Initialize Session

Create session.json from plan:

```bash
TEAM=$(basename "$(git rev-parse --show-toplevel)")
ULTRAWORK_SESSION="$HOME/.claude/ultrawork/$TEAM/session.json"
```

Write parsed tasks to session.json (v5.0):
```json
{
  "version": "5.0",
  "goal": "{from plan}",
  "phase": "EXECUTION",
  "iteration": 1,
  "plan_file": "{PLAN_FILE path}",
  "started_at": "2026-01-08T...",
  "options": {
    "max_iterations": 5,
    "max_workers": 0
  },
  "tasks": [
    {"id": "task-1", "title": "...", "complexity": "standard", "status": "pending", ...}
  ]
}
```

## Step 4: Show Execution Plan

```markdown
## Starting Execution

**Goal:** {goal}
**Plan:** {plan file path}
**Tasks:** {count}

### Task Queue

| Task   | Status  | Complexity | Model  |
| ------ | ------- | ---------- | ------ |
| task-1 | pending | standard   | sonnet |
| task-2 | pending | complex    | opus   |

### Execution Order
1. [READY] task-1 (no dependencies)
2. [BLOCKED] task-2 (depends on task-1)
3. [BLOCKED] verify (depends on all)

Starting workers...
```

## Step 5: Spawn Workers

For each unblocked task (status=pending, all depends_on completed):

```python
# Use complexity field to select model
model = "opus" if task["complexity"] == "complex" else "sonnet"

Task(
  subagent_type="ultrawork:worker:worker",
  model=model,
  prompt="""
    ULTRAWORK_SESSION: {session path}
    TASK_ID: {task.id}

    TASK: {task.title}
    {task.description}

    SUCCESS CRITERIA:
    {task.criteria}
  """,
  run_in_background=True
)
```

Respect `max_workers` limit from session options.

## Step 6: Monitor & Progress

Periodically check session.json:
- Workers update task status to `completed` or `failed`
- When task completes, check if it unblocks others
- Spawn new workers for unblocked tasks
- Report progress to user

```markdown
## Progress Update

✓ task-1: Setup schema (completed)
→ task-2: User model (in_progress)
⏳ task-3: Waiting for task-2
```

## Step 7: Verification Phase

When all non-verify tasks complete:

1. Update phase to `VERIFICATION`
2. Spawn verifier:

```python
Task(
  subagent_type="ultrawork:verifier:verifier",
  model="opus",
  prompt="""
    ULTRAWORK_SESSION: {session path}

    Verify all success criteria are met with evidence.
    Check for blocked patterns.
    Run final tests.
  """
)
```

## Step 8: Complete

**If verifier passes:**
- Update phase to `COMPLETE`
- Update plan file: mark tasks as done
- Report summary with all evidence

**If verifier fails (auto-retry loop):**

Check iteration count:
```python
iteration = session["iteration"]
max_iterations = session["options"]["max_iterations"]

if iteration < max_iterations:
    # Auto-retry
    session["iteration"] = iteration + 1
    session["phase"] = "EXECUTION"
    # Reset failed tasks
    for task in failed_tasks:
        task["status"] = "open"
        task["retry_count"] = 0
    # Save session.json
    # Output marker to trigger loop
    print("__ULTRAWORK_RETRY__")
else:
    # Max iterations reached
    session["phase"] = "FAILED"
    # Report to user, ask for manual intervention
```

## Error Handling

**Worker fails:**
- Mark task as `failed` in session.json
- Continue other independent tasks
- Report failure at end

**Retry:**
- Run `/ultrawork-exec` again
- Only pending/failed tasks will be re-executed
- Completed tasks are skipped
