---
name: ultrawork
description: "Start ultrawork session with strict verification mode"
argument-hint: "[--auto] [--max-workers N] [--max-iterations N] [--skip-verify] [--plan-only] <goal> | --help"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-ultrawork.sh:*)", "Bash(${CLAUDE_PLUGIN_ROOT}/scripts/*.sh:*)", "Task", "TaskOutput", "Read", "Write", "Edit", "AskUserQuestion", "Glob", "Grep"]
---

# Ultrawork Command

## Overview

Ultrawork uses **session directory** for all task management.

**Two Modes:**
- **Interactive (default)**: Orchestrator runs planning skill directly, uses AskUserQuestion
- **Auto (--auto)**: Planner sub-agent handles planning automatically

---

## Delegation Rules (MANDATORY)

The orchestrator MUST delegate work to sub-agents. Direct execution is prohibited except where explicitly noted.

| Phase | Delegation | Direct Execution |
|-------|------------|------------------|
| Overview Exploration | N/A | ALWAYS via `Skill(skill="ultrawork:overview-exploration")` |
| Targeted Exploration | ALWAYS via `Task(subagent_type="ultrawork:explorer")` | NEVER |
| Planning (non-auto) | N/A | ALWAYS (by design) |
| Planning (auto) | ALWAYS via `Task(subagent_type="ultrawork:planner")` | NEVER |
| Execution | ALWAYS via `Task(subagent_type="ultrawork:worker")` | NEVER |
| Verification | ALWAYS via `Task(subagent_type="ultrawork:verifier")` | NEVER |

**Why**: Sub-agents are optimized for their specific tasks with proper tool access and context. Direct execution bypasses these optimizations and may produce incomplete results.

**Exception**: User explicitly requests direct execution (e.g., "run this directly", "execute without agent").

---

## Interruptibility (Background + Polling)

To allow user interruption during long-running operations, use **background execution with polling**.

### Pattern: Non-blocking Wait with Cancel Check

```python
# 1. Spawn agent in background
task_result = Task(
  subagent_type="ultrawork:explorer:explorer",
  run_in_background=True,
  prompt="..."
)
task_id = task_result.task_id

# 2. Poll with cancel check loop
while True:
    # Check if session was cancelled
    session_check = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
    if session_check.output.strip() == "CANCELLED":
        print("Session cancelled by user. Stopping.")
        break

    # Non-blocking check for task completion
    output = TaskOutput(task_id=task_id, block=False, timeout=5000)

    if output.status == "completed":
        # Process result
        break
    elif output.status == "error":
        # Handle error
        break

    # Still running - continue polling
    # (This yields control, allowing user to send /ultrawork-cancel)
```

### When to Apply This Pattern

| Phase | Apply Pattern | Notes |
|-------|---------------|-------|
| Overview exploration | ✓ Yes | Single agent, wait with polling |
| Targeted exploration | ✓ Yes | Multiple agents, poll each |
| Auto planning | ✓ Yes | Planner agent, poll until done |
| Worker execution | ✓ Yes | Multiple workers, poll each |
| Verification | ✓ Yes | Verifier agent, poll until done |

### Cancel Check Script

The session-get.sh script returns the current phase. When user runs `/ultrawork-cancel`:
1. Session phase changes to `CANCELLED`
2. Next poll iteration detects this
3. Orchestrator stops spawning new work and exits cleanly

---

## Step 1: Initialize Session

Execute the setup script:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ultrawork.sh" $ARGUMENTS
```

This creates session at: `~/.claude/ultrawork/{team}/sessions/{session_id}/`

Parse the output to get:
- Session ID
- Session directory path
- Goal
- Options (max_workers, skip_verify, plan_only, auto_mode)

---

## Step 1.5: Resume Check (CRITICAL for interrupted sessions)

**Before starting exploration, check session state to determine where to resume:**

```python
# Read session.json
session = Bash(f'cat {session_dir}/session.json')
exploration_stage = session.get("exploration_stage", "not_started")

# Read context.json
context = Read(f"{session_dir}/context.json")
exploration_complete = context.get("exploration_complete", False) if context else False
expected_explorers = context.get("expected_explorers", []) if context else []
actual_explorers = [e["id"] for e in context.get("explorers", [])] if context else []
```

**Resume logic by exploration_stage:**

| Stage | Status | Action |
|-------|--------|--------|
| `not_started` | Fresh start | Begin from Stage 2a (Overview) |
| `overview` | Overview running/done | Check overview.md exists → proceed to 2b |
| `analyzing` | Hints generated, no targeted yet | Re-run hint analysis, set expected_explorers |
| `targeted` | Targeted explorers running | Check expected vs actual, wait or re-spawn missing |
| `complete` | Exploration done | Skip to Step 3 (Planning) |

```python
if exploration_stage == "not_started":
    # Fresh start - go to Stage 2a
    pass

elif exploration_stage == "overview":
    # Check if overview actually completed
    if Path(f"{session_dir}/exploration/overview.md").exists():
        # Proceed to Stage 2b (analyze & plan targeted)
        pass
    else:
        # Re-spawn overview explorer
        pass

elif exploration_stage == "analyzing":
    # Overview done, need to generate hints and set expected_explorers
    # Go to Stage 2b
    pass

elif exploration_stage == "targeted":
    if expected_explorers and not exploration_complete:
        missing = set(expected_explorers) - set(actual_explorers)
        if missing:
            print(f"Exploration incomplete. Missing: {missing}")
            # Re-spawn missing explorers
            pass

elif exploration_stage == "complete":
    # Skip to planning
    pass
```

**Key checks:**
1. `exploration_stage` in session.json determines resume point
2. `expected_explorers` vs `explorers[].id` identifies missing work
3. `exploration_complete` confirms all expected explorers finished

---

## Step 2: Exploration Phase (Dynamic)

Exploration happens in two stages: Overview first, then targeted exploration.

### Stage 2a: Quick Overview (Direct via Skill)

**Invoke the overview-exploration skill directly (no agent spawn):**

```python
Skill(skill="ultrawork:overview-exploration")
```

The skill will:
1. Update exploration_stage to "overview"
2. Directly explore project structure using Glob, Read, Grep
3. Write `{session_dir}/exploration/overview.md`
4. Initialize `context.json`

**Time budget**: ~30 seconds, max 5-7 file reads

This is synchronous - no polling needed. Proceed to Stage 2b after skill completes.

### Stage 2b: Analyze & Plan Targeted Exploration

**Update exploration_stage to "analyzing":**

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir}/session.json --exploration-stage analyzing
```

Based on **Overview + Goal**, decide what areas need detailed exploration.

**Decision Matrix:**

| Goal Keywords | Detected Stack | Explore Areas |
|---------------|----------------|---------------|
| auth, login, user | Next.js | middleware, api/auth, existing user model |
| auth, login, user | Express | routes, passport config, session |
| api, endpoint | Any | existing routes, controllers, schemas |
| database, model | Prisma | schema.prisma, migrations, existing models |
| database, model | TypeORM | entities, migrations |
| test, coverage | Any | existing tests, test config, mocks |
| ui, component | React/Next | components/, design system, styles |
| bug, fix, error | Any | related files from error context |

**Generate exploration hints dynamically:**

```python
# Analyze overview + goal
hints = analyze_exploration_needs(overview, goal)

# Example outputs:
# Goal: "Add user authentication"
# Overview: Next.js with Prisma, no existing auth
# → hints = [
#     "Authentication patterns: middleware, session, JWT",
#     "Database: user model patterns in existing Prisma schema",
#     "API routes: existing route patterns in app/api/"
# ]
```

**Set expected explorers BEFORE spawning (CRITICAL):**

```bash
# Generate expected explorer IDs
expected_ids="overview"
for i, hint in enumerate(hints):
    expected_ids += f",exp-{i+1}"

# Initialize context.json with expected explorers
"${CLAUDE_PLUGIN_ROOT}/scripts/context-init.sh" --session {session_dir} --expected "{expected_ids}"
```

This ensures:
1. `expected_explorers` is set before any background tasks start
2. If interrupted, resume check knows what's missing
3. `exploration_complete` auto-updates when all explorers finish

### Stage 2c: Targeted Exploration

**Update exploration_stage to "targeted":**

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir}/session.json --exploration-stage targeted
```

Spawn explorers for each identified area (parallel):

```python
for i, hint in enumerate(hints):
    Task(
      subagent_type="ultrawork:explorer:explorer",
      model="haiku",  # or sonnet for complex areas
      run_in_background=True,
      prompt=f"""
ULTRAWORK_SESSION: {session_dir}
EXPLORER_ID: exp-{i+1}

SEARCH_HINT: {hint}

CONTEXT: {overview_summary}
"""
    )
```

**Wait for all explorers using polling pattern:**

```python
pending_tasks = [task_id_1, task_id_2, ...]  # From Task() calls above

while pending_tasks:
    # Cancel check
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
    if phase.output.strip() == "CANCELLED":
        return  # Exit cleanly

    # Check each pending task
    for task_id in pending_tasks[:]:  # Copy to allow modification
        result = TaskOutput(task_id=task_id, block=False, timeout=1000)
        if result.status in ["completed", "error"]:
            pending_tasks.remove(task_id)
```

**After all explorers complete, update exploration_stage to "complete":**

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir}/session.json --exploration-stage complete
```

### Exploration Output

Explorers will create:
- `exploration/overview.md` - Project overview
- `exploration/exp-1.md`, `exp-2.md`, ... - Targeted findings
- `context.json` - Aggregated summary with links (exploration_complete=true when all done)

---

## Step 3: Planning Phase (MODE BRANCHING)

### If `--auto` was set → Auto Mode

Spawn Planner sub-agent:

```python
Task(
  subagent_type="ultrawork:planner:planner",
  model="opus",
  prompt="""
ULTRAWORK_SESSION: {session_dir}

Goal: {goal}

Options:
- require_success_criteria: true
- include_verify_task: true
- max_workers: {from session options}
"""
)
```

**Wait for planner using polling pattern:**

```python
while True:
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
    if phase.output.strip() == "CANCELLED":
        return  # Exit cleanly

    result = TaskOutput(task_id=planner_task_id, block=False, timeout=5000)
    if result.status in ["completed", "error"]:
        break
```

Skip to Step 4.

---

### If `--auto` was NOT set → Interactive Mode

**Run planning skill directly in main agent (YOU).**

Reference: `skills/planning/SKILL.md`

#### 3a. Read Context

```bash
# Read lightweight summary
cat {session_dir}/context.json

# Read detailed exploration as needed
cat {session_dir}/exploration/exp-1.md
cat {session_dir}/exploration/exp-2.md
cat {session_dir}/exploration/exp-3.md
```

#### 3b. Present Findings to User

```markdown
## Exploration Results

**Project Type**: {from exploration}
**Key Files**: {from context.json}
**Patterns Found**: {from exploration}

Based on the goal "{goal}", I found:
{summary of relevant findings}
```

#### 3c. Clarify Requirements (Brainstorm Protocol)

**Ask ONE question at a time.** Reference `skills/planning/SKILL.md` Phase 2-3.

For each ambiguous or unclear aspect:

```python
AskUserQuestion(questions=[{
  "question": "Which authentication method should we implement?",
  "header": "Auth method",
  "options": [
    {"label": "OAuth + Email/Password (Recommended)", "description": "Most flexible, supports both"},
    {"label": "OAuth only", "description": "Simpler, relies on social providers"},
    {"label": "Email/Password only", "description": "Traditional, no third-party deps"}
  ],
  "multiSelect": False
}])
```

**Question Types:**
- Ambiguous requirements → clarify scope
- Architecture choices → select approach
- Library selection → pick dependencies
- Scope boundaries → define in/out

**Continue until all decisions are made.**

#### 3d. Present Design Incrementally

Present design in sections (~200-300 words each). After each section:

```python
AskUserQuestion(questions=[{
  "question": "Does this section look correct?",
  "header": "Review",
  "options": [
    {"label": "Yes, continue", "description": "Move to next section"},
    {"label": "Needs adjustment", "description": "I have feedback"}
  ],
  "multiSelect": False
}])
```

#### 3e. Write Design Document

Write comprehensive design to `design.md`:

```bash
# Use Write tool to create design.md
```

See `skills/planning/SKILL.md` Phase 4 for template.

#### 3f. Task Decomposition

Decompose design into tasks. Write each task:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/task-create.sh" --session {session_dir} \
  --id "1" \
  --subject "Setup NextAuth provider" \
  --description "Configure NextAuth with credentials" \
  --complexity standard \
  --criteria "Auth routes respond|Login flow works"
```

Always include verify task at end.

#### 3g. Update Session Phase

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir} --phase EXECUTION
```

---

## Step 4: Plan Review & Confirmation

**Read the plan:**

```bash
ls {session_dir}/tasks/
cat {session_dir}/design.md
```

Display plan summary:

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

**If Interactive mode (not --auto):**

```python
AskUserQuestion(questions=[{
  "question": "이 계획으로 진행할까요?",
  "header": "Plan approval",
  "options": [
    {"label": "승인", "description": "이 계획대로 실행합니다"},
    {"label": "수정 요청", "description": "계획을 수정합니다"},
    {"label": "취소", "description": "작업을 취소합니다"}
  ],
  "multiSelect": False
}])
```

- "승인" → proceed to Step 5
- "수정 요청" → get feedback, re-run planning
- "취소" → end session

**If `--plan-only` was set:** Stop here, report plan summary.

---

## Step 5: Execution Phase

### 5a. Update Session Phase

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir} --phase EXECUTION
```

### 5b. Execution Loop with Polling

```python
active_workers = {}  # task_id -> agent_task_id

while True:
    # Cancel check at start of each loop
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
    if phase.output.strip() == "CANCELLED":
        print("Session cancelled. Stopping execution.")
        return

    # Find unblocked pending tasks
    tasks_output = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/task-list.sh" --session {session_dir} --format json')
    tasks = json.loads(tasks_output.output)

    unblocked = [t for t in tasks if t["status"] == "pending" and all_deps_complete(t, tasks)]
    in_progress = [t for t in tasks if t["status"] == "in_progress"]
    all_done = all(t["status"] == "resolved" for t in tasks)

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
ULTRAWORK_SESSION: {session_dir}
TASK_ID: {task["id"]}

TASK: {task["subject"]}
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
            # Task file is updated by worker agent
```

### 5c. Verification Phase

When all tasks complete, spawn verifier:

```python
# Cancel check before verification
phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
if phase.output.strip() == "CANCELLED":
    return

# Update phase
Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir} --phase VERIFICATION')

# Spawn verifier
verifier_result = Task(
    subagent_type="ultrawork:verifier:verifier",
    model="opus",
    run_in_background=True,
    prompt=f"""
ULTRAWORK_SESSION: {session_dir}

Verify all success criteria are met with evidence.
Check for blocked patterns.
Run final tests.
"""
)

# Poll verifier with cancel check
while True:
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
    if phase.output.strip() == "CANCELLED":
        return

    result = TaskOutput(task_id=verifier_result.task_id, block=False, timeout=5000)
    if result.status in ["completed", "error"]:
        break
```

### 5d. Completion

Check verifier result and update session:

```bash
# If PASS
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir} --phase COMPLETE

# If FAIL and iterations remaining
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir} --phase EXECUTION --increment-iteration
# Loop back to 5b
```

---

## Directory Structure

```
~/.claude/ultrawork/{team}/sessions/{session_id}/
├── session.json        # Session metadata (JSON)
├── context.json        # Explorer summaries (JSON)
├── design.md           # Design document (Markdown)
├── exploration/        # Detailed exploration (Markdown)
│   ├── exp-1.md
│   ├── exp-2.md
│   └── exp-3.md
└── tasks/              # Task files (JSON)
    ├── 1.json
    ├── 2.json
    └── verify.json
```

---

## Mode Comparison

| Aspect | Interactive (default) | Auto (--auto) |
|--------|----------------------|---------------|
| Exploration | Orchestrator spawns explorers | Same |
| Planning | Orchestrator runs planning skill | Planner sub-agent |
| User Questions | AskUserQuestion for decisions | Auto-decide |
| Confirmation | User approves plan | No confirmation |
| Best For | Important features, unclear requirements | Well-defined tasks, CI/CD |

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--auto` | Skip user interaction, auto-decide everything |
| `--max-workers N` | Limit concurrent workers (0 = unlimited) |
| `--max-iterations N` | Max execute→verify loops (default: 5) |
| `--skip-verify` | Skip verification phase |
| `--plan-only` | Stop after planning, don't execute |

---

## Zero Tolerance Rules

Before ANY completion claim:
- No blocked phrases ("should work", "basic implementation")
- Evidence exists for all criteria
- All tasks resolved
- Verifier passed (unless --skip-verify)
