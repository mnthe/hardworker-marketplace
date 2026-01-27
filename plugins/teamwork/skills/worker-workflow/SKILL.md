---
name: worker-workflow
description: Core task execution workflow for teamwork workers (Phase 1-5). Ensures workers properly claim, execute, and update task status.
---

# Task Execution Workflow

This skill provides the complete workflow for executing teamwork tasks. Follow these phases in order.

## Input Format

Your prompt includes:

```
TEAMWORK_DIR: {path to teamwork directory}
PROJECT: {project name}
SUB_TEAM: {sub-team name}
SCRIPTS_PATH: {path to scripts directory}

Options:
- role_filter: {role} (optional)
- strict_mode: true|false
```

---

<WARNING>
**SCRIPTS_PATH is NOT a shell environment variable.**

The value `SCRIPTS_PATH: /path/to/scripts` in your prompt is text. When writing bash commands:

**WRONG** (will fail):
```bash
bun "$SCRIPTS_PATH/task-list.js"  # Shell cannot expand $SCRIPTS_PATH
```

**CORRECT** (substitute the actual value):
```bash
bun "/path/to/scripts/task-list.js"  # Use the value from your prompt directly
```

Always extract the path from your prompt and use it literally in commands.
</WARNING>

---

## Phase 1: Find Task

List available tasks (open, unblocked, unclaimed):

```bash
bun "$SCRIPTS_PATH/task-list.js" --project {PROJECT} --team {SUB_TEAM} --available --format json
```

Or filter by your role:

```bash
bun "$SCRIPTS_PATH/task-list.js" --project {PROJECT} --team {SUB_TEAM} --available --role {role_filter}
```

**If no task found:** Report "No available tasks" and exit.

## Phase 2: Claim Task

Atomically claim the task before starting work:

```bash
bun "$SCRIPTS_PATH/task-claim.js" --project {PROJECT} --team {SUB_TEAM} --id {TASK_ID} --owner ${CLAUDE_SESSION_ID}
```

**If claim fails (conflict):** Another worker took it. Find a different task.

## Phase 3: Implement

Execute the task using your specialization:

1. Read the task description carefully
2. Use tools (Read, Write, Edit, Bash)
3. Follow existing patterns in the codebase
4. Keep changes focused on the task scope

## Phase 4: Verify & Collect Evidence

For each deliverable, collect **concrete evidence**:

| Bad Evidence | Good Evidence |
|--------------|---------------|
| "Tests pass" | "npm test: 15/15 passed, exit code 0" |
| "API works" | "curl /api/users: 200 OK, 5 users returned, exit 0" |
| "File created" | "Created src/auth.ts (127 lines)" |

**Exit code requirement**: All command evidence MUST include exit code.

## Phase 5: Update Task Status (CRITICAL)

**This phase is MANDATORY. Never skip it.**

### On Success

Mark task as resolved with evidence:

```bash
bun "$SCRIPTS_PATH/task-update.js" --project {PROJECT} --team {SUB_TEAM} --id {TASK_ID} \
  --status resolved \
  --add-evidence "Created src/models/User.ts (85 lines)" \
  --add-evidence "npm test: 12/12 passed, exit code 0" \
  --owner ${CLAUDE_SESSION_ID}
```

### On Failure

Add failure evidence and release the task for another worker:

```bash
# Add evidence of what went wrong
bun "$SCRIPTS_PATH/task-update.js" --project {PROJECT} --team {SUB_TEAM} --id {TASK_ID} \
  --add-evidence "FAILED: npm test exited with code 1 - TypeError in auth.ts:42" \
  --owner ${CLAUDE_SESSION_ID}

# Release task for retry by another worker
bun "$SCRIPTS_PATH/task-update.js" --project {PROJECT} --team {SUB_TEAM} --id {TASK_ID} \
  --release --owner ${CLAUDE_SESSION_ID}
```

Do NOT mark as resolved if failed - release for retry.

---

## Mailbox Integration (Task Completion Notification)

When a worker completes a task, it should notify the orchestrator so that the orchestrator can assign the next available task. Teamwork supports this through the mailbox system.

### Automatic Notification (Recommended)

When updating task status to `resolved` with the `--worker-id` parameter, task-update.js automatically sends an `idle_notification` to the orchestrator:

```bash
bun "$SCRIPTS_PATH/task-update.js" \
  --project {PROJECT} \
  --team {SUB_TEAM} \
  --id {TASK_ID} \
  --status resolved \
  --worker-id {WORKER_ID} \
  --add-evidence "Implementation complete"
```

**When to use:**
- Working in swarm mode (automatic worker spawning)
- Worker was spawned by orchestrator with assigned worker ID
- Standard workflow for coordinated teams

### Manual Notification (Advanced)

For custom notification workflows or when automatic notification isn't available, send notifications directly using mailbox-send.js:

```bash
bun "$SCRIPTS_PATH/mailbox-send.js" \
  --project {PROJECT} \
  --team {SUB_TEAM} \
  --from {WORKER_ID} \
  --to orchestrator \
  --type idle_notification \
  --payload '{"worker_id":"{WORKER_ID}","completed_task_id":"{TASK_ID}","completed_status":"resolved"}'
```

**When to use:**
- Custom orchestration logic
- Non-standard notification payloads
- Troubleshooting coordination issues

### Orchestrator Receiving Pattern

The orchestrator polls for notifications using mailbox-poll.js:

```bash
# Poll for idle notifications with 30 second timeout
bun "$SCRIPTS_PATH/mailbox-poll.js" \
  --project {PROJECT} \
  --team {SUB_TEAM} \
  --inbox orchestrator \
  --timeout 30000 \
  --type idle_notification
```

**Returns:**
- Empty array `[]` if timeout expires with no messages
- Array of message objects if notifications received:
  ```json
  [
    {
      "from": "w1",
      "to": "orchestrator",
      "type": "idle_notification",
      "payload": {
        "worker_id": "w1",
        "completed_task_id": "3",
        "completed_status": "resolved"
      },
      "timestamp": "2026-01-27T10:30:00Z",
      "read": false
    }
  ]
  ```

### Notification Workflow

```
Worker completes task
    │
    ├─→ task-update.js --status resolved --worker-id w1
    │       │
    │       └─→ Sends idle_notification to orchestrator inbox
    │
    └─→ Worker waits for next task assignment
            │
            └─→ Orchestrator polls inbox
                    │
                    ├─→ Receives idle_notification
                    └─→ Assigns next task to idle worker
```

**Benefits:**
- Reduces polling overhead (orchestrator-driven task assignment)
- Enables dynamic load balancing
- Improves coordination in multi-worker swarms

---

## Phase 6: Commit Changes

**After task is marked resolved, commit ONLY the files you modified:**

⚠️ **CRITICAL: Selective File Staging**

```bash
# ❌ FORBIDDEN - NEVER use these:
git add -A        # Stages ALL files
git add .         # Stages ALL files
git add --all     # Stages ALL files
git add *         # Glob expansion - dangerous

# ✅ REQUIRED - Only add files YOU modified during this task:
git add path/to/file1.ts path/to/file2.ts && git commit -m "$(cat <<'EOF'
<type>(<scope>): <short description>

[teamwork] Project: {PROJECT} | Team: {SUB_TEAM} | Task: {TASK_ID}

{TASK_TITLE}

Evidence:
- {evidence 1}
- {evidence 2}

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
- Task not resolved (failed/released)

---

## Summary Checklist

Before ending your work, verify:

- [ ] Phase 1: Found an available task
- [ ] Phase 2: Successfully claimed it
- [ ] Phase 3: Implemented the solution
- [ ] Phase 4: Collected concrete evidence with exit codes
- [ ] Phase 5: Called task-update.js with --status resolved OR --release
- [ ] **Phase 6: Committed ONLY your modified files (if task resolved)**

**If you skip Phase 5, the task will remain stuck in `in_progress` status forever.**
**If you skip Phase 6, your changes may be lost or mixed with other workers' changes.**
