---
name: ultrawork-exec
description: "Execute ultrawork plan document"
argument-hint: "[plan-file] | --help"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/*)", "Task", "TaskOutput", "Read", "Edit"]
---

# Ultrawork Exec Command

Execute a plan document created by `/ultrawork-plan`.

---

## Delegation Rules (MANDATORY)

The orchestrator MUST delegate work to sub-agents. Direct execution is prohibited.

| Phase | Delegation | Direct Execution |
|-------|------------|------------------|
| Execution | ALWAYS via `Task(subagent_type="ultrawork:worker")` | NEVER |
| Verification | ALWAYS via `Task(subagent_type="ultrawork:verifier")` | NEVER |

**Exception**: User explicitly requests direct execution (e.g., "run this directly", "execute without agent").

---

## Interruptibility (Background + Polling)

To allow user interruption during execution, use **background execution with polling**.

```python
# Poll pattern for all Task waits
while True:
    # Check if session was cancelled
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_path} --field phase')
    if phase.output.strip() == "CANCELLED":
        return  # Exit cleanly

    # Non-blocking check
    result = TaskOutput(task_id=task_id, block=False, timeout=5000)
    if result.status in ["completed", "error"]:
        break
```

---

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

## Step 5: Execution Loop with Polling

Use background execution with polling to allow user interruption:

```python
active_workers = {}  # task_id -> agent_task_id

while True:
    # Cancel check at start of each loop
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_path} --field phase')
    if phase.output.strip() == "CANCELLED":
        print("Session cancelled. Stopping execution.")
        return

    # Find unblocked pending tasks
    tasks = json.loads(Bash(f'"task-list.sh" --session {session_path} --format json').output)
    unblocked = [t for t in tasks if t["status"] == "pending" and all_deps_complete(t, tasks)]
    all_done = all(t["status"] in ["resolved", "failed"] for t in tasks if t["id"] != "verify")

    if all_done:
        break  # Move to verification

    # Spawn workers for unblocked tasks (respect max_workers)
    for task in unblocked:
        if len(active_workers) >= max_workers and max_workers > 0:
            break

        model = "opus" if task["complexity"] == "complex" else "sonnet"
        agent_result = Task(
            subagent_type="ultrawork:worker:worker",
            model=model,
            run_in_background=True,
            prompt=f"""
ULTRAWORK_SESSION: {session_path}
TASK_ID: {task["id"]}

TASK: {task["title"]}
{task["description"]}

SUCCESS CRITERIA:
{task["criteria"]}
"""
        )
        active_workers[task["id"]] = agent_result.task_id

    # Poll active workers (non-blocking)
    for task_id, agent_task_id in list(active_workers.items()):
        result = TaskOutput(task_id=agent_task_id, block=False, timeout=1000)
        if result.status in ["completed", "error"]:
            del active_workers[task_id]
```

## Step 6: Progress Reporting

Between poll iterations, report progress:

```markdown
## Progress Update

✓ task-1: Setup schema (completed)
→ task-2: User model (in_progress)
⏳ task-3: Waiting for task-2
```

## Step 7: Verification Phase

When all non-verify tasks complete:

```python
# Cancel check before verification
phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_path} --field phase')
if phase.output.strip() == "CANCELLED":
    return

# Update phase
Bash(f'"session-update.sh" --session {session_path} --phase VERIFICATION')

# Spawn verifier with background + polling
verifier_result = Task(
    subagent_type="ultrawork:verifier:verifier",
    model="opus",
    run_in_background=True,
    prompt=f"""
ULTRAWORK_SESSION: {session_path}

Verify all success criteria are met with evidence.
Check for blocked patterns.
Run final tests.
"""
)

# Poll verifier with cancel check
while True:
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_path} --field phase')
    if phase.output.strip() == "CANCELLED":
        return

    result = TaskOutput(task_id=verifier_result.task_id, block=False, timeout=5000)
    if result.status in ["completed", "error"]:
        break
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
