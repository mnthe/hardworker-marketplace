---
name: ultrawork-exec
description: "Execute ultrawork plan with automatic retry loop"
argument-hint: "[--session <id>] [--max-iterations N] [--skip-verify] | --help"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/*.js:*)", "Task", "TaskOutput", "Read", "Edit", "mcp__plugin_serena_serena__activate_project"]
---

# Ultrawork Exec Command

Execute a plan created by `/ultrawork-plan`. Includes **automatic retry loop** for failed tasks and verification.

---

## Overview

```
/ultrawork-exec
    ↓
Load Session → Execute Tasks (waves) → Verify → Retry if failed
    ↓
Loop until: PASS or max_iterations reached
```

---

## Delegation Rules (MANDATORY)

The orchestrator MUST delegate work to sub-agents. Direct execution is prohibited.

| Phase        | Delegation                                            | Direct Execution |
| ------------ | ----------------------------------------------------- | ---------------- |
| Execution    | ALWAYS via `Task(subagent_type="ultrawork:worker")`   | NEVER            |
| Verification | ALWAYS via `Task(subagent_type="ultrawork:verifier")` | NEVER            |

**Exception**: User explicitly requests direct execution (e.g., "run this directly", "execute without agent").

---

## Sub-agent Execution

Sub-agents can be run in **foreground** (default) or **background** mode. Choose based on the situation:

| Mode           | When to Use                                |
| -------------- | ------------------------------------------ |
| **Foreground** | Sequential tasks, need result immediately  |
| **Background** | Parallel execution with worker pool limits |

**Parallel execution**: Call multiple Tasks in a single message for automatic parallelization.

---

## Session ID Handling

**All scripts require `--session <id>` flag.**

Claude Code v2.1.9+ automatically replaces `${CLAUDE_SESSION_ID}` with the actual session UUID.

```bash
# Use ${CLAUDE_SESSION_ID} directly - it gets auto-replaced
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field phase
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase EXECUTION
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID} --format json
```

---

## Step 1: Load Session

Find and load the existing session:

```bash
# Get SESSION_ID from hook output (see "Session ID Handling" section)
# Get session directory via variable
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}

# Verify session exists and has tasks
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID}
```

Read session state:

```bash
# SESSION_ID from hook output
# Get session data via script
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID}                    # Full JSON
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field phase      # Specific field
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field goal

# Get specific options
goal=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field goal)
phase=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field phase)
```

**Validate session is ready for execution:**

| Phase               | Action                                 |
| ------------------- | -------------------------------------- |
| `PLANNING_COMPLETE` | Ready to execute                       |
| `EXECUTION`         | Resume execution (check task states)   |
| `VERIFICATION`      | Resume verification                    |
| `COMPLETE`          | Already done, report success           |
| `FAILED`            | Max iterations reached, report failure |
| `CANCELLED`         | Exit cleanly                           |

---

## Step 2: Show Execution Plan

Display plan summary before starting:

```markdown
## Starting Execution

**Goal:** {goal}
**Session:** {session_id}
**Iteration:** {iteration}/{max_iterations}
**Tasks:** {count}

### Task Queue

| ID     | Task         | Status  | Complexity | Model  |
| ------ | ------------ | ------- | ---------- | ------ |
| 1      | Setup schema | pending | standard   | sonnet |
| 2      | Build API    | pending | complex    | opus   |
| verify | Verification | pending | complex    | opus   |

### Execution Order
1. [READY] 1 - no dependencies
2. [BLOCKED] 2 - depends on 1
3. [BLOCKED] verify - depends on all

Starting workers...
```

---

## Step 3: Execution Loop (Main Retry Loop)

**The execution loop runs until success or max_iterations reached.**

```python
while iteration <= max_iterations:
    # Update phase and iteration
    Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase EXECUTION --iteration {iteration}')

    print(f"## Iteration {iteration}/{max_iterations}")

    # Run execution phase
    execution_result = run_execution_phase(SESSION_ID, max_workers)

    if execution_result == "CANCELLED":
        return

    # Skip verify if requested
    if skip_verify:
        Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase COMPLETE')
        print("## Execution Complete (verification skipped)")
        return

    # Run verification phase
    verification_result = run_verification_phase(SESSION_ID)

    if verification_result == "CANCELLED":
        return
    elif verification_result == "PASS":
        Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase COMPLETE')
        print("## Execution Complete - All criteria verified")
        return
    else:
        # FAIL - retry if iterations remain
        if iteration < max_iterations:
            print(f"## Verification Failed - Retrying ({iteration + 1}/{max_iterations})")
            reset_failed_tasks(SESSION_ID)
            iteration += 1
        else:
            Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase FAILED')
            print("## Execution Failed - Max iterations reached")
            return
```

---

## Step 4: Execution Phase Implementation

📖 **Detailed guide**: See [Execute Phase Reference](references/04-execute.md)

```python
def run_execution_phase(SESSION_ID, max_workers):
    # SESSION_DIR is set via: SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}

    while True:
        # Get current task states
        tasks_output = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID} --format json')
        tasks = json.loads(tasks_output.output)

        # Categorize tasks (exclude verify task for now)
        non_verify_tasks = [t for t in tasks if t["id"] != "verify"]
        unblocked = [t for t in non_verify_tasks if t["status"] == "pending" and all_deps_complete(t, tasks)]
        all_done = all(t["status"] == "resolved" for t in non_verify_tasks)

        if all_done:
            return "DONE"  # Move to verification

        # Spawn workers for unblocked tasks
        # Call multiple Tasks in single message = automatic parallel execution
        batch = unblocked[:max_workers] if max_workers > 0 else unblocked
        for task in batch:
            # Mark task as in_progress
            Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --id {task["id"]} --status in_progress')

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
            print(f"→ Started: {task['id']} - {task['subject']}")
        # All workers in batch complete before next iteration
```

---

## Step 5: Verification Phase Implementation

📖 **Detailed guide**: See [Validate Phase Reference](references/05-validate.md)

```python
def run_verification_phase(SESSION_ID):
    # SESSION_DIR is set via: SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}

    # Update phase
    Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase VERIFICATION')

    print("## Running Verification...")

    # Spawn verifier (foreground - waits for completion)
    result = Task(
        subagent_type="ultrawork:verifier:verifier",
        model="opus",
        prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}

Verify all success criteria are met with evidence.
Check for blocked patterns.
Run final tests.

Return: PASS or FAIL with details
"""
    )

    # Parse verifier output
    if "PASS" in result.output:
        return "PASS"
    else:
        return "FAIL"
```

---

## Step 6: Reset Failed Tasks for Retry

```python
def reset_failed_tasks(SESSION_ID):
    """Reset failed tasks for retry iteration"""

    tasks_output = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID} --format json')
    tasks = json.loads(tasks_output.output)

    for task in tasks:
        if task["status"] == "failed":
            # Reset to pending
            Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --id {task["id"]} --status pending')

            # Increment retry count
            retry_count = task.get("retry_count", 0) + 1
            Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --id {task["id"]} --retry-count {retry_count}')

            print(f"↻ Reset for retry: {task['id']} (attempt {retry_count + 1})")

    # Also reset verify task
    Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --id verify --status pending')
```

---

## Step 7: Progress Reporting

Between poll iterations, report progress:

```markdown
## Progress Update

**Iteration:** 2/5
**Phase:** EXECUTION

| Task   | Status     | Model  |
| ------ | ---------- | ------ |
| 1      | ✓ resolved | sonnet |
| 2      | → running  | opus   |
| 3      | ⏳ blocked  | sonnet |
| verify | ⏳ pending  | opus   |

Active workers: 1
```

---

## Step 8: Completion

### On Success (PASS)

```markdown
## Execution Complete

**Goal:** {goal}
**Iterations:** {iteration}/{max_iterations}
**Result:** ✓ PASS

### Summary
- All {task_count} tasks completed
- All success criteria verified
- No blocked patterns detected

### Evidence
{summary from verifier}

Session ID: {session_id}
```

### On Failure (max iterations reached)

```markdown
## Execution Failed

**Goal:** {goal}
**Iterations:** {max_iterations}/{max_iterations} (max reached)
**Result:** ✗ FAIL

### Failed Tasks
| ID  | Task      | Reason        |
| --- | --------- | ------------- |
| 2   | Build API | Tests failing |

### Verification Issues
{details from last verifier run}

### Next Steps
1. Review failed task output: ~/.claude/ultrawork/sessions/{session_id}/tasks/2.json
2. Fix issues manually
3. Run `/ultrawork-exec` again (resets iteration counter)

Session ID: {session_id}
```

---

## Error Handling

### Worker Failures

- Mark task as `failed` in session.json
- Continue other independent tasks
- Retry on next iteration

### Retry Strategy

| Attempt | Model Escalation      | Notes                                   |
| ------- | --------------------- | --------------------------------------- |
| 1       | sonnet/opus (default) | Normal execution                        |
| 2       | Same model            | Retry with same model                   |
| 3+      | Consider opus         | Escalate if standard task keeps failing |

### Graceful Degradation

- If a non-critical task fails repeatedly, consider marking as skipped
- Critical tasks (verify) must pass

---

## Options Reference

| Option               | Description                                |
| -------------------- | ------------------------------------------ |
| `--session <id>`     | Session ID to execute                      |
| `--max-iterations N` | Override max retry iterations (default: 5) |
| `--skip-verify`      | Skip verification phase                    |

---

## Directory Structure

Get session directory: `~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}`

```
$SESSION_DIR/
├── session.json        # Session metadata with iteration state
├── context.json        # Explorer summaries
├── design.md           # Design document
├── exploration/        # Exploration files
└── tasks/              # Task files with status and retry_count
    ├── 1.json          # { status: "resolved", retry_count: 0 }
    ├── 2.json          # { status: "failed", retry_count: 2 }
    └── verify.json     # { status: "pending" }
```

---

## Zero Tolerance Rules

Before ANY completion claim:
- No blocked phrases ("should work", "basic implementation")
- Evidence exists for all criteria
- All tasks resolved
- Verifier passed (unless --skip-verify)
- Retry loop exhausted only after genuine attempts
