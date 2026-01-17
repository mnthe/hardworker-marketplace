# Execute Phase Reference

**Used by**: `ultrawork.md`, `ultrawork-exec.md`

**Purpose**: Execute tasks in parallel waves, spawning workers to implement the plan.

---

## Phase Transition

Update session phase before starting execution:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase EXECUTION
```

---

## Execution Loop

```python
# Get session_dir via: Bash('"bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --dir')

while True:
    # Find unblocked pending tasks
    tasks_output = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID} --format json')
    tasks = json.loads(tasks_output.output)

    unblocked = [t for t in tasks if t["status"] == "pending" and all_deps_complete(t, tasks)]
    all_done = all(t["status"] == "resolved" for t in tasks)

    if all_done:
        break  # Move to verification

    # Spawn workers for unblocked tasks
    # Option A: Parallel in single message (automatic parallelization)
    for task in unblocked[:max_workers] if max_workers > 0 else unblocked:
        model = "opus" if task["complexity"] == "complex" else "sonnet"
        Task(
            subagent_type="ultrawork:worker:worker",
            model=model,
            prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}
TASK_ID: {task["id"]}

TASK: {task["subject"]}
{task["description"]}

SUCCESS CRITERIA:
{task["criteria"]}
"""
        )
    # All workers in this batch complete before next iteration
```

---

## Worker Selection

| Complexity | Model  | When to Use                     |
| ---------- | ------ | ------------------------------- |
| simple     | haiku  | Small changes, single file edit |
| standard   | sonnet | Most tasks, multi-file changes  |
| complex    | opus   | Architecture changes, refactors |

---

## Worker Pool Management

**Max Workers (`--max-workers N`):**
- **0 (default)**: Unlimited - spawn workers for ALL unblocked tasks in parallel
- **N > 0**: Limit - spawn at most N workers per wave

**Why limit workers?**
- Cost control - fewer parallel API calls
- Resource management - prevent overwhelming system
- Debugging - easier to track issues with fewer concurrent agents

**Trade-offs:**

| Setting | Pros | Cons |
|---------|------|------|
| `--max-workers 0` | Fastest execution, maximum parallelism | Higher cost, harder to debug |
| `--max-workers 1` | Sequential, easy debugging | Slowest, no parallelism |
| `--max-workers 2-4` | Balanced speed and control | Middle ground |

---

## Parallel Execution Strategies

### Strategy 1: Foreground Parallel (Simple)

Call multiple Tasks in a single message for automatic parallelization:

```python
# All workers spawn at once and complete before continuing
for task in unblocked_tasks:
    Task(subagent_type="ultrawork:worker", prompt=f"...")
```

**Best for**: When you want ALL unblocked tasks to run in parallel.

### Strategy 2: Background + Polling (Advanced)

For fine-grained control with worker pool limits:

```python
# Spawn N workers in background
task_ids = []
for task in unblocked_tasks[:max_workers]:
    task_id = Task(subagent_type="ultrawork:worker", run_in_background=True, prompt=f"...")
    task_ids.append(task_id)

# Poll for completion
while task_ids:
    for task_id in task_ids[:]:
        result = TaskOutput(task_id=task_id, block=False, timeout=5000)
        if result.status in ["completed", "error"]:
            task_ids.remove(task_id)

    time.sleep(1)  # Wait before next poll
```

**Best for**: When `--max-workers N` is set and you need precise worker pool management.

---

## Task Status Tracking

**Task statuses**:
- `pending` - Not started, waiting for dependencies or worker
- `in_progress` - Worker assigned and executing
- `resolved` - Completed with evidence
- `blocked` - Waiting for dependencies

**Dependency check**:

```python
def all_deps_complete(task, all_tasks):
    if not task["blocked_by"]:
        return True

    for dep_id in task["blocked_by"]:
        dep_task = next(t for t in all_tasks if t["id"] == dep_id)
        if dep_task["status"] != "resolved":
            return False

    return True
```

---

## TDD Enforcement

For tasks with `"approach": "tdd"`:

**Gate enforcement hook blocks implementation before TDD-RED evidence.**

**Required TDD workflow:**

1. **TDD-RED**: Worker creates test file first, runs it, confirms failure (exit code 1)
   ```bash
   bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id "1" \
     --add-evidence "TDD-RED: Created tests/feature.test.ts" \
     --add-evidence "TDD-RED: npm test -- feature.test.ts (exit 1, test fails as expected)"
   ```

2. **TDD-GREEN**: Worker implements feature, runs test, confirms pass (exit code 0)
   ```bash
   bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id "1" \
     --add-evidence "TDD-GREEN: Implemented src/feature.ts" \
     --add-evidence "TDD-GREEN: npm test -- feature.test.ts (exit 0, all tests pass)"
   ```

3. **TDD-REFACTOR** (optional): Worker improves implementation, tests still pass
   ```bash
   bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id "1" \
     --add-evidence "TDD-REFACTOR: Refactored for readability" \
     --add-evidence "TDD-REFACTOR: npm test -- feature.test.ts (exit 0, still passing)"
   ```

**Gate checks**:
- Before TDD-RED evidence → Allow test files only (`*.test.*`, `*.spec.*`, `__tests__/*`)
- After TDD-RED evidence → Allow implementation files
- Before TDD-GREEN evidence → Block task resolution

---

## Evidence Collection

Evidence is automatically collected by hooks:
- **post-tool-use-evidence.js**: Records tool usage (Bash, Write, Edit)
- **gate-enforcement.js**: Enforces phase restrictions (PLANNING vs EXECUTION)
- **agent-lifecycle-tracking.js**: Tracks which agents are active

Workers must update task evidence explicitly:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id "1" \
  --status resolved \
  --add-evidence "npm test: 5/5 passed, exit 0"
```

**Evidence requirements**:
- Every success criterion must have corresponding evidence
- Test execution must include exit codes
- File operations should list created/modified files
- Command output should show actual results, not assumptions

---

## Auto-Commit Workflow

**Workers automatically commit changes after task resolution using Angular Commit Message Conventions.**

### Commit Sequence

```bash
# 1. Stage all changes and commit atomically to minimize race condition
git add -A && git commit -m "<type>(<scope>): <short description>

[ultrawork] Session: ${CLAUDE_SESSION_ID} | Task: {TASK_ID}

{TASK_SUBJECT}

Criteria met:
- {criterion 1}
- {criterion 2}

Files changed:
- src/feature.ts
- src/feature.test.ts"

# 2. Record commit hash in evidence
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id "{TASK_ID}" \
  --add-evidence "Committed: $(git rev-parse --short HEAD)"
```

### Angular Commit Types

| Type | When to Use |
|------|-------------|
| feat | New feature or functionality |
| fix | Bug fix |
| refactor | Code refactoring without behavior change |
| test | Adding or modifying tests |
| docs | Documentation changes |
| style | Code style changes (formatting, etc.) |
| chore | Build, config, or maintenance tasks |

### Auto-Commit Rules

| Condition | Action |
|-----------|--------|
| Task resolved + files changed | Commit changes |
| Task resolved + no changes | Skip commit (nothing to commit) |
| Task failed/partial | **DO NOT commit** - leave for retry |
| No git repo | Skip commit (warn in evidence) |

### Benefits

- **Traceability**: Each task = one atomic commit
- **Rollback**: Easy to revert specific task if verification fails
- **Audit trail**: Commit history shows ultrawork session progress
- **Bisect-friendly**: Can `git bisect` to find which task introduced issues
- **Conventional**: Standard format works with changelog generators

### Commit Message Format

```
<type>(<scope>): <short description>

[ultrawork] Session: ${CLAUDE_SESSION_ID} | Task: {TASK_ID}

{TASK_SUBJECT}

Criteria met:
- {criterion 1}
- {criterion 2}

Files changed:
- {file 1}
- {file 2}
```

**Filter ultrawork commits:**
```bash
git log --oneline --grep='\[ultrawork\]'
```

---

## Wave Pattern Example

```
Wave 1 (3 unblocked tasks, spawn all in parallel):
├─ Task 1: Setup config
├─ Task 2: Create schema
└─ Task 3: Add types

Wave 2 (2 tasks now unblocked after Wave 1):
├─ Task 4: Implement API (depends on 1, 2, 3)
└─ Task 5: Add middleware (depends on 1, 3)

Wave 3 (1 task unblocked after Wave 2):
└─ Task 6: Integration tests (depends on 4, 5)
```

**How it works**:
1. Orchestrator finds tasks 1-3 unblocked → spawns 3 workers in parallel
2. After all Wave 1 workers complete, checks again → finds tasks 4-5 unblocked
3. Spawns workers for tasks 4-5 in parallel
4. Continues until all tasks resolved

---

## Completion Check

```python
# Check if all tasks are resolved
tasks = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID} --format json')
all_resolved = all(t["status"] == "resolved" for t in json.loads(tasks.output))

if all_resolved:
    # Move to verification phase
    Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase VERIFICATION')
```

---

## Error Handling

**Worker failures**:
- Worker exits with error → task remains `in_progress`
- Orchestrator detects stuck task → can retry or create fix task
- Evidence log shows where worker failed

**Recovery strategies**:
1. **Retry**: Re-spawn worker for same task
2. **Fix task**: Create new task to fix issue, block original task on fix
3. **Ralph loop**: Let verifier fail, create fix tasks in next iteration

**When to retry vs fix**:
- Transient errors (network, timeout) → Retry
- Missing context → Fix task to gather more info
- Code errors → Let worker complete with partial evidence, fix in verification
