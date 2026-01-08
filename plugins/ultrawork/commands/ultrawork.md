---
name: ultrawork
description: "Start ultrawork session with strict verification mode"
argument-hint: "[--auto] [--max-workers N] [--max-iterations N] [--skip-verify] [--plan-only] <goal> | --help"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-ultrawork.sh:*)", "Task", "TaskOutput", "Read", "Edit", "AskUserQuestion"]
---

# Ultrawork Command

## Overview

Ultrawork uses **session.json** for all task management. No Team Mode Task* tools required.

**Key Changes from v1:**
- Tasks stored in session.json (not Team Mode)
- Planner spawns explorers internally
- Plan review step with user confirmation (unless --auto)
- Automatic session isolation

---

## Step 1: Initialize Session

Execute the setup script:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ultrawork.sh" $ARGUMENTS
```

This creates session at: `~/.claude/ultrawork/{team}/sessions/{session_id}/session.json`

Parse the output to get:
- Session ID
- Goal
- Session file path
- Options (max_workers, skip_verify, plan_only, auto_mode)

## Step 2: Spawn Planner

<CRITICAL>
**SPAWN THE PLANNER AGENT NOW.**

The planner will:
1. Spawn explorers internally
2. Gather context
3. Create task plan
4. Write tasks to session.json
</CRITICAL>

**ACTION REQUIRED - Call Task tool with:**
- subagent_type: "ultrawork:planner:planner"
- model: "opus"
- prompt:
  ```
  ULTRAWORK_SESSION: {session_path}

  Goal: {goal}

  Options:
  - require_success_criteria: true
  - include_verify_task: true
  - max_workers: {from session options}
  ```

Wait for planner to complete using TaskOutput.

## Step 3: Plan Review

**Read the plan from session.json:**

```bash
cat {session_path}
```

Display the plan to user:

```markdown
## Ultrawork Plan

**Goal**: {goal}

| ID     | Task         | Complexity | Blocked By |
| ------ | ------------ | ---------- | ---------- |
| 1      | Setup schema | standard   | -          |
| 2      | Build API    | complex    | 1          |
| verify | Verification | complex    | 1, 2       |

**Waves:**
- Wave 1: [1] - can start immediately
- Wave 2: [2] - after Wave 1
- Wave 3: [verify] - after all
```

**If `--auto` was NOT set:**

Use AskUserQuestion tool:
```
question: "이 계획으로 진행할까요?"
options:
  - label: "승인"
    description: "이 계획대로 실행합니다"
  - label: "수정 요청"
    description: "계획을 수정합니다"
  - label: "취소"
    description: "작업을 취소합니다"
```

- If "승인" → proceed to Step 4
- If "수정 요청" → get feedback, re-spawn planner with modified goal
- If "취소" → end session

**If `--auto` was set:** Skip confirmation, proceed directly.

**If `--plan-only` was set:** Stop here, report plan summary.

## Step 4: Execution Phase

**Read session.json to get tasks:**

```bash
cat {session_path}
```

Parse `tasks[]` array. Find unblocked tasks:
- `status: "open"`
- `blockedBy: []` (empty)
- NOT `[VERIFY]` task

**For EACH unblocked task, spawn worker:**

Call Task tool with:
- subagent_type: "ultrawork:worker:worker"
- model: "sonnet" (or "opus" if complexity is "complex")
- run_in_background: true
- prompt:
  ```
  ULTRAWORK_SESSION: {session_path}
  TASK_ID: {task.id}

  TASK: {task.subject}
  {task.description}

  SUCCESS CRITERIA:
  {task.criteria joined with newlines}
  ```

## Step 5: Worker Orchestration Loop

**CRITICAL: Run this loop until ALL non-verify tasks complete.**

```
LOOP:
  1. Read session.json
  2. Check: All non-verify tasks resolved? → Go to Step 6
  3. Find: Open tasks with empty blockedBy
  4. Spawn: Worker for each unblocked task (skip [VERIFY])
  5. Wait: TaskOutput for any running worker
  6. Check retry: If task failed and retry_count < max_retry, re-spawn
  7. Repeat
```

**Retry Logic:**

When a worker completes, read session.json to check task status:
- If `status: "resolved"` → task done
- If `status: "open"` and `retry_count < max_retry` → re-spawn worker
- If `status: "open"` and `retry_count >= max_retry` → report failure, ask user

## Step 6: Verification Phase

<CRITICAL>
When all non-verify tasks are resolved, spawn the verifier.
</CRITICAL>

**If `--skip-verify` was set:** Skip to Step 7.

**ACTION REQUIRED - Spawn verifier:**

Call Task tool with:
- subagent_type: "ultrawork:verifier:verifier"
- model: "opus"
- prompt:
  ```
  ULTRAWORK_SESSION: {session_path}

  Verify all success criteria are met with evidence.
  Check for blocked patterns.
  Run final tests.
  ```

Wait using TaskOutput.

**Check result:**

Read session.json, check verify task:
- If `status: "resolved"` → PASS
- If `status: "open"` → FAIL, identify issues

**On FAIL (automatic retry - ralph-loop style):**

Check iteration count from session.json:
- `iteration < max_iterations` → Continue to retry loop
- `iteration >= max_iterations` → Report failure, ask user

**Retry Loop:**

```
RETRY_LOOP:
  1. Increment iteration in session.json
  2. Reset failed tasks: status="open", retry_count=0
  3. Update phase to EXECUTION
  4. Output marker: __ULTRAWORK_RETRY__
  5. Stop hook will re-trigger execution
```

The stop-hook detects `__ULTRAWORK_RETRY__` and feeds back execution prompt.

## Step 7: Complete

Read final session.json and report:

```markdown
# Ultrawork Complete

## Summary
- Goal: {goal}
- Status: PASS / FAIL
- Tasks: {resolved}/{total}

## Evidence
{List key evidence from each task}

## Files Changed
{List files modified across all tasks}

## Session
- Path: {session_path}
- Phase: COMPLETE
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--auto` | Skip plan confirmation, run automatically |
| `--max-workers N` | Limit concurrent workers (0 = unlimited) |
| `--max-iterations N` | Max execute→verify loops (default: 5) |
| `--skip-verify` | Skip verification phase |
| `--plan-only` | Stop after planning, don't execute |

## Zero Tolerance Rules

Before ANY completion claim:
- No blocked phrases ("should work", "basic implementation")
- Evidence exists for all criteria
- All tasks resolved (verified via session.json)
- Verifier passed (unless --skip-verify)

## Directory Structure

```
~/.claude/ultrawork/{team}/sessions/{session_id}/
├── session.json      # Session metadata
├── context.json      # Explorer findings
└── tasks/
    ├── 1.json
    ├── 2.json
    └── verify.json
```

## Session Schema (v5.0)

**session.json** (metadata only):
```json
{
  "version": "5.0",
  "session_id": "...",
  "goal": "...",
  "started_at": "...",
  "phase": "PLANNING|EXECUTION|VERIFICATION|COMPLETE",
  "iteration": 1,
  "options": {
    "max_workers": 0,
    "max_iterations": 5,
    "skip_verify": false,
    "plan_only": false,
    "auto_mode": false
  },
  "plan": {
    "version": 1,
    "created_at": "...",
    "approved_at": "..."
  }
}
```

**context.json** (explorer findings):
```json
{
  "explorers": [
    {
      "id": "exp-1",
      "hint": "project structure",
      "findings": {...},
      "completed_at": "..."
    }
  ]
}
```

**tasks/{id}.json** (per-task file):
```json
{
  "id": "1",
  "subject": "...",
  "description": "...",
  "status": "open|resolved",
  "blockedBy": [],
  "complexity": "standard|complex",
  "criteria": [],
  "evidence": [],
  "retry_count": 0,
  "max_retry": 2
}
```
