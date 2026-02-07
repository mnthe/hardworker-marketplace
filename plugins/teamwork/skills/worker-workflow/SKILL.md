---
name: worker-workflow
description: |
  8-phase task execution lifecycle for teamwork workers using native Claude Code APIs.
  Covers task discovery, claiming, structured description parsing, TDD workflow,
  implementation, verification, selective commit, and completion reporting.
---

# Task Execution Workflow

This skill provides the complete 8-phase lifecycle for executing teamwork tasks using native Claude Code APIs. Follow these phases in order.

---

## Structured Description Convention

The orchestrator creates tasks with structured markdown sections in the description. Workers MUST parse these sections to determine approach, criteria, and verification commands.

```markdown
## Description
What needs to be done

## Approach
standard | tdd

## Success Criteria
- Criterion 1
- Criterion 2

## Verification Commands
npm test -- path/to/test
npx tsc --noEmit src/file.ts
```

**Parsing rules:**

| Section | Required | Default |
|---------|----------|---------|
| `## Description` | Yes | N/A |
| `## Approach` | No | `standard` |
| `## Success Criteria` | No | Use general evidence collection |
| `## Verification Commands` | No | Skip automated verification |

Workers extract these sections from the task description after claiming. If `## Approach` is missing, default to `standard`. If `## Success Criteria` is missing, use general evidence collection.

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

## Phase 3: Parse Task

Extract the structured sections from the task description:

```python
# Get full task details
task = TaskGet(taskId="<TASK_ID>")
```

Parse the description to extract:

1. **Approach**: `standard` or `tdd` (default: `standard`)
2. **Success Criteria**: List of criteria to verify
3. **Verification Commands**: Commands to run during Phase 6

**Decision point after parsing:**

| Approach | Next Phase |
|----------|------------|
| `standard` | Skip to Phase 5 (Implement) |
| `tdd` | Proceed to Phase 4 (TDD RED) |

---

## Phase 4: TDD RED (approach=tdd only)

**Skip this phase if approach is `standard`.**

Write the test FIRST, before any implementation code.

### Steps

1. Create the test file based on success criteria
2. Run the test and verify it FAILS (exit code 1)
3. Record evidence with `TDD-RED:` prefix

```python
# Record test creation
TaskUpdate(
    taskId="<TASK_ID>",
    description="""
<original description>

## Evidence
- TDD-RED: Created test file tests/feature.test.ts
"""
)
```

```bash
# Run SCOPED test - MUST FAIL
npm test -- tests/feature.test.ts
```

```python
# Record failure (expected)
TaskUpdate(
    taskId="<TASK_ID>",
    description="""
<updated description>

## Evidence
- TDD-RED: Created test file tests/feature.test.ts
- TDD-RED: npm test -- tests/feature.test.ts (exit code 1)
"""
)
```

**Evidence required before proceeding:**
- Test file path created
- Scoped test execution showing failure
- Exit code 1 (expected)

**Do NOT write implementation files during this phase.** Only test files are allowed.

---

## Phase 5: Implement / TDD GREEN

### Standard Approach (approach=standard)

Execute the task using your specialization:

1. Read the task description and success criteria carefully
2. Use tools: Read, Write, Edit, Bash, Glob, Grep
3. Follow existing patterns in the codebase
4. Keep changes focused on the task scope

### TDD GREEN (approach=tdd)

Write **MINIMAL** code to make the test pass. Do NOT add extra functionality beyond what the test requires.

```bash
# Run SCOPED test - MUST PASS
npm test -- tests/feature.test.ts
```

```python
# Record implementation and passing test
TaskUpdate(
    taskId="<TASK_ID>",
    description="""
<updated description>

## Evidence
- TDD-RED: Created test file tests/feature.test.ts
- TDD-RED: npm test -- tests/feature.test.ts (exit code 1)
- TDD-GREEN: Implemented src/feature.ts
- TDD-GREEN: npm test -- tests/feature.test.ts (exit code 0)
"""
)
```

### TDD REFACTOR (optional, approach=tdd)

After GREEN, optionally improve code quality:

1. Rename variables, extract helpers, improve structure
2. Run scoped tests again to verify they still pass
3. Record with `TDD-REFACTOR:` prefix

```python
TaskUpdate(
    taskId="<TASK_ID>",
    description="""
<updated description>

## Evidence
...
- TDD-REFACTOR: Extracted helper function, npm test -- tests/feature.test.ts (exit code 0)
"""
)
```

---

## Phase 6: Verify

Before committing, run ALL verification commands and check ALL success criteria.

### Step 1: Run Verification Commands

Execute each command from `## Verification Commands` in the task description:

```bash
# Example: run scoped tests
npm test -- path/to/test.ts

# Example: scoped type check on modified files only
npx tsc --noEmit src/file1.ts src/file2.ts
```

### Step 2: Check Success Criteria

For each criterion from `## Success Criteria`, collect concrete evidence:

| Bad Evidence | Good Evidence |
|--------------|---------------|
| "Tests pass" | "npm test -- auth.test.ts: 15/15 passed, exit code 0" |
| "API works" | "curl /api/users: 200 OK, 5 users returned, exit code 0" |
| "File created" | "Created src/auth.ts (127 lines)" |

### Step 3: TypeScript Scoped Type Check

For TypeScript projects, type check ONLY the files you modified:

```bash
# SCOPED - Type check only changed files
npx tsc --noEmit src/file1.ts src/file2.ts

# FORBIDDEN - Full build is deferred to final-verifier
npm run build
npx tsc
```

### Step 4: Collect Exit Codes

Every verification command MUST have its exit code recorded.

### Step 5: Gate Decision

| All verifications pass | Proceed to Phase 7 (Commit) |
|------------------------|------------------------------|
| ANY verification fails | Do NOT commit, do NOT mark complete, report failure |

**On verification failure:**

```python
TaskUpdate(
    taskId="<TASK_ID>",
    description="""
<original description>

## Failure
- FAILED: npm test -- auth.test.ts exited with code 1
- Error: TypeError in auth.ts:42
- Root cause: Missing dependency injection for database client
""",
    status="open",
    owner=""
)

SendMessage(
    type="message",
    recipient="orchestrator",
    content="Task <TASK_ID> failed verification. Reason: <failure description>. Released for retry.",
    summary="Task <TASK_ID> failed - released"
)
```

Do NOT proceed to Phase 7 or Phase 8 if verification fails.

---

## Phase 7: Commit

**Only reach this phase if ALL verifications in Phase 6 passed.**

### Selective File Staging

```bash
# FORBIDDEN - NEVER use these:
git add -A        # Stages ALL files
git add .         # Stages ALL files
git add --all     # Stages ALL files
git add *         # Glob expansion - dangerous

# REQUIRED - Only add files YOU modified during this task:
git add path/to/file1.ts path/to/file2.ts
```

### Angular Commit Format

```bash
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

### Angular Commit Message Types

| Type | When to Use |
|------|-------------|
| feat | New feature or functionality |
| fix | Bug fix |
| refactor | Code refactoring without behavior change |
| test | Adding or modifying tests |
| docs | Documentation changes |
| style | Code style changes (formatting, etc.) |
| chore | Build, config, or maintenance tasks |

### Skip Commit If

- No files changed (`git status --porcelain` is empty)
- Task not completed (failed/released)
- Verification failed in Phase 6

**Why selective staging?**
- Other workers may have uncommitted changes in the repo
- Only YOUR task changes should be in this commit
- Enables clean rollback per task if needed

---

## Phase 8: Complete and Report

Mark the task as completed and notify the orchestrator:

```python
# Mark task complete
TaskUpdate(taskId="<TASK_ID>", status="completed")

# Notify orchestrator with summary
SendMessage(
    type="message",
    recipient="orchestrator",
    content="Task <TASK_ID> complete. <brief summary of what was done>. Commit: <short hash>.",
    summary="Task <TASK_ID> completed"
)
```

---

## TDD Evidence Chain

A complete TDD task MUST produce this evidence sequence:

```
1. TDD-RED:      Test file created
2. TDD-RED:      Scoped test execution failed (exit code 1)
3. TDD-GREEN:    Implementation created
4. TDD-GREEN:    Scoped test execution passed (exit code 0)
5. TDD-REFACTOR: (optional) Improvements made, scoped tests still pass
```

**Evidence format requirements:**
- Full test command with scope (e.g., `npm test -- tests/feature.test.ts`)
- Exit code in parentheses
- Phase prefix (`TDD-RED:`, `TDD-GREEN:`, `TDD-REFACTOR:`)

**Verification will FAIL if:**
- Implementation evidence appears before TDD-RED evidence
- Missing TDD-RED or TDD-GREEN evidence
- Test never failed (indicates code-first, not test-first)
- Evidence missing test scope or exit code

**Key differences from ultrawork TDD:**
- Uses native `TaskUpdate` for evidence (not session scripts)
- No gate hooks - enforcement is instruction-based only
- Evidence appended to task description as markdown
- Scoped test execution (specific test file, not full suite)

---

## Evidence Format

For each criterion, evidence must include:

- **Command executed**: Full command with arguments
- **Output**: Relevant output or summary
- **Exit code**: Numeric exit code (0 = success, 1 = failure)
- **Phase prefix for TDD**: `TDD-RED:`, `TDD-GREEN:`, `TDD-REFACTOR:`

```python
TaskUpdate(
    taskId="<TASK_ID>",
    description="""
<original task description>

## Evidence

### Criterion: Tests pass
- Command: npm test -- src/auth.test.ts
- Output: PASS src/auth.test.ts (15/15)
- Exit code: 0

### Criterion: Type check passes
- Command: npx tsc --noEmit src/auth.ts
- Exit code: 0
"""
)
```

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
- [ ] Phase 3: Parsed structured description (approach, criteria, verification commands)
- [ ] Phase 4: (TDD only) Wrote test first, verified failure (exit code 1)
- [ ] Phase 5: Implemented the solution (TDD: minimal code to pass test)
- [ ] Phase 6: Ran ALL verification commands, checked ALL criteria, collected exit codes
- [ ] Phase 7: Committed ONLY your modified files with Angular format (if verification passed)
- [ ] Phase 8: Called TaskUpdate with status="completed" AND sent message to orchestrator

**If you skip Phase 6, unverified code enters the codebase.**
**If you skip Phase 7, your changes may be lost or mixed with other workers' changes.**
**If you skip Phase 8, the task will remain stuck in `in_progress` status forever.**

---

## Blocked Phrases

Do NOT use these in your output or evidence:

- "should work"
- "probably works"
- "basic implementation"
- "you can extend this"
- "TODO" / "FIXME"

If work is incomplete, say so explicitly with a concrete reason.
