---
name: ultrawork
description: "Start ultrawork session with strict verification mode"
argument-hint: "[--auto] [--max-workers N] [--max-iterations N] [--skip-verify] [--plan-only] <goal> | --help"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js:*)", "Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/*.js:*)", "Task", "TaskOutput", "Read", "Write", "Edit", "AskUserQuestion", "Glob", "Grep", "mcp__plugin_serena_serena__activate_project"]
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

| Phase                | Delegation                                            | Direct Execution                                           |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Overview Exploration | N/A                                                   | ALWAYS via `Skill(skill="ultrawork:overview-exploration")` |
| Targeted Exploration | ALWAYS via `Task(subagent_type="ultrawork:explorer")` | NEVER                                                      |
| Planning (non-auto)  | N/A                                                   | ALWAYS (by design)                                         |
| Planning (auto)      | ALWAYS via `Task(subagent_type="ultrawork:planner")`  | NEVER                                                      |
| Execution            | ALWAYS via `Task(subagent_type="ultrawork:worker")`   | NEVER                                                      |
| Verification         | ALWAYS via `Task(subagent_type="ultrawork:verifier")` | NEVER                                                      |

**Why**: Sub-agents are optimized for their specific tasks with proper tool access and context. Direct execution bypasses these optimizations and may produce incomplete results.

**Exception**: User explicitly requests direct execution (e.g., "run this directly", "execute without agent").

---

## Sub-agent Execution

Sub-agents can be run in **foreground** (default) or **background** mode. Choose based on the situation:

| Mode           | When to Use                                |
| -------------- | ------------------------------------------ |
| **Foreground** | Sequential tasks, need result immediately  |
| **Background** | Parallel execution with worker pool limits |

```python
# Foreground (default) - simple, blocking
result = Task(subagent_type="ultrawork:explorer", prompt="...")

# Background - for parallel execution with limits
task_id = Task(subagent_type="ultrawork:worker", run_in_background=True, prompt="...")
result = TaskOutput(task_id=task_id, block=True)
```

**Parallel execution**: Call multiple Tasks in a single message for automatic parallelization.

---

## Session ID Handling (CRITICAL)

**All scripts require `--session <id>` flag.**

### Where to get SESSION_ID

Look for this message in system-reminder (provided by SessionStart hook):
```
CLAUDE_SESSION_ID: 37b6a60f-8e3e-4631-8f62-8eaf3d235642
Use this when calling ultrawork scripts: --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642
```

**IMPORTANT: You MUST extract the actual UUID value and use it directly. DO NOT use placeholder strings like `{SESSION_ID}` or `$SESSION_ID`.**

### Correct usage example

If the hook says `CLAUDE_SESSION_ID: 37b6a60f-8e3e-4631-8f62-8eaf3d235642`, then:

```bash
# ✅ CORRECT - use the actual value
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642 "goal"

# ❌ WRONG - do not use placeholders
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session {SESSION_ID} "goal"
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session $SESSION_ID "goal"
```

### Session Directory

Get session directory via script:

```bash
SESSION_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir)
```

For example, if `SESSION_ID` is `37b6a60f-8e3e-4631-8f62-8eaf3d235642`:

```bash
SESSION_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642 --dir)
# Returns: ~/.claude/ultrawork/sessions/37b6a60f-8e3e-4631-8f62-8eaf3d235642
```

---

## Step 0: Serena Project Activation (Optional)

If the MCP tool `mcp__plugin_serena_serena__activate_project` is available, activate Serena for enhanced code navigation:

```python
# Check if Serena is available and activate
if "mcp__plugin_serena_serena__activate_project" in available_tools:
    try:
        mcp__plugin_serena_serena__activate_project(project=".")
        # Serena enabled - agents can use symbol-based tools
    except:
        pass  # Continue without Serena
```

**Benefits when Serena is active:**
- Explorer: `get_symbols_overview`, `find_symbol` for precise code structure analysis
- Planner: `find_referencing_symbols` for dependency tracking
- Worker: `replace_symbol_body`, `rename_symbol` for safe refactoring
- Verifier/Reviewer: Symbol-based impact analysis

**If Serena is not available, agents will use standard tools (Read, Edit, Grep).**

---

## Step 1: Initialize Session

**First, extract SESSION_ID from the system-reminder hook output, then execute:**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session <YOUR_SESSION_ID_HERE> $ARGUMENTS
```

Replace `<YOUR_SESSION_ID_HERE>` with the actual UUID from `CLAUDE_SESSION_ID` in system-reminder.

**After initialization, get session_dir via script:**

```bash
# SESSION_ID from hook output
SESSION_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642 --dir)
```

Parse the setup output to get:
- Goal
- Options (max_workers, skip_verify, plan_only, auto_mode)

---

## Step 1.5: Resume Check (CRITICAL for interrupted sessions)

**Before starting exploration, check session state to determine where to resume:**

```python
# SESSION_ID from hook output, session_dir derived from it
# Get session_dir via: Bash('"bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir')

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

| Stage         | Status                           | Action                                             |
| ------------- | -------------------------------- | -------------------------------------------------- |
| `not_started` | Fresh start                      | Begin from Stage 2a (Overview)                     |
| `overview`    | Overview running/done            | Check overview.md exists → proceed to 2b           |
| `analyzing`   | Hints generated, no targeted yet | Re-run hint analysis, set expected_explorers       |
| `targeted`    | Targeted explorers running       | Check expected vs actual, wait or re-spawn missing |
| `complete`    | Exploration done                 | Skip to Step 3 (Planning)                          |

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
3. Write `exploration/overview.md` (in session directory)
4. Initialize `context.json`

**Time budget**: ~30 seconds, max 5-7 file reads

This is synchronous - no polling needed. Proceed to Stage 2b after skill completes.

### Stage 2b: Analyze & Plan Targeted Exploration

**Update exploration_stage to "analyzing":**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session {SESSION_ID} --exploration-stage analyzing
```

Based on **Overview + Goal**, decide what areas need detailed exploration.

**Decision Matrix:**

| Goal Keywords     | Detected Stack | Explore Areas                              |
| ----------------- | -------------- | ------------------------------------------ |
| auth, login, user | Next.js        | middleware, api/auth, existing user model  |
| auth, login, user | Express        | routes, passport config, session           |
| api, endpoint     | Any            | existing routes, controllers, schemas      |
| database, model   | Prisma         | schema.prisma, migrations, existing models |
| database, model   | TypeORM        | entities, migrations                       |
| test, coverage    | Any            | existing tests, test config, mocks         |
| ui, component     | React/Next     | components/, design system, styles         |
| bug, fix, error   | Any            | related files from error context           |

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
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-init.js" --session {SESSION_ID} --expected "{expected_ids}"
```

This ensures:
1. `expected_explorers` is set before spawning
2. `exploration_complete` auto-updates when all explorers finish

### Stage 2c: Targeted Exploration

**Update exploration_stage to "targeted":**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session {SESSION_ID} --exploration-stage targeted
```

Spawn explorers for each identified area (parallel, in single message):

```python
# Get session_dir via: Bash('"bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir')

# Call multiple Tasks in single message = automatic parallel execution
for i, hint in enumerate(hints):
    Task(
      subagent_type="ultrawork:explorer:explorer",
      model="haiku",  # or sonnet for complex areas
      prompt=f"""
SESSION_ID: {SESSION_ID}
EXPLORER_ID: exp-{i+1}

SEARCH_HINT: {hint}

CONTEXT: {overview_summary}
"""
    )
# All explorers run in parallel and results are collected
```

**After all explorers complete, update exploration_stage to "complete":**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session {SESSION_ID} --exploration-stage complete
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
# Get session_dir via: Bash('"bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir')

# Foreground execution - waits for completion
Task(
  subagent_type="ultrawork:planner:planner",
  model="opus",
  prompt=f"""
SESSION_ID: {SESSION_ID}

Goal: {goal}

Options:
- require_success_criteria: true
- include_verify_task: true
- max_workers: {max_workers}
"""
)
```

Skip to Step 4.

---

### If `--auto` was NOT set → Interactive Mode

**Run planning skill directly in main agent (YOU).**

Reference: `skills/planning/SKILL.md`

#### 3a. Read Context

```python
# Get session_dir via: Bash('"bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir')

# Read lightweight summary
Read(f"{session_dir}/context.json")

# Read detailed exploration as needed
Read(f"{session_dir}/exploration/exp-1.md")
Read(f"{session_dir}/exploration/exp-2.md")
Read(f"{session_dir}/exploration/exp-3.md")
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
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-create.js" --session {SESSION_ID} \
  --id "1" \
  --subject "Setup NextAuth provider" \
  --description "Configure NextAuth with credentials" \
  --complexity standard \
  --criteria "Auth routes respond|Login flow works"
```

Always include verify task at end.

#### 3g. Update Session Phase

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session {SESSION_ID} --phase EXECUTION
```

---

## Step 4: Plan Review & Confirmation

**Read the plan:**

```python
# Get session_dir via: Bash('"bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir')

Bash(f"ls {session_dir}/tasks/")
Read(f"{session_dir}/design.md")
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
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session {SESSION_ID} --phase EXECUTION
```

### 5b. Execution Loop

```python
# Get session_dir via: Bash('"bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir')

while True:
    # Find unblocked pending tasks
    tasks_output = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session {SESSION_ID} --format json')
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
SESSION_ID: {SESSION_ID}
TASK_ID: {task["id"]}

TASK: {task["subject"]}
{task["description"]}

SUCCESS CRITERIA:
{task["criteria"]}
"""
        )
    # All workers in this batch complete before next iteration
```

### 5c. Verification Phase

When all tasks complete, spawn verifier:

```python
# Get session_dir via: Bash('"bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir')

# Update phase
Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session {SESSION_ID} --phase VERIFICATION')

# Spawn verifier (foreground - waits for completion)
Task(
    subagent_type="ultrawork:verifier:verifier",
    model="opus",
    prompt=f"""
SESSION_ID: {SESSION_ID}

Verify all success criteria are met with evidence.
Check for blocked patterns.
Run final tests.
"""
)
```

### 5d. Completion

Check verifier result and update session:

```bash
# If PASS
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session {SESSION_ID} --phase COMPLETE

# If FAIL and iterations remaining
current_iteration=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --field iteration)
next_iteration=$((current_iteration + 1))
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session {SESSION_ID} --phase EXECUTION --iteration $next_iteration
# Loop back to 5b
```

---

## Directory Structure

Get session directory: `bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --dir`

```
$SESSION_DIR/
├── session.json        # Session metadata (JSON)
├── context.json        # Explorer summaries (JSON)
├── design.md           # Design document (Markdown)
├── exploration/        # Detailed exploration (Markdown)
│   ├── overview.md
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

| Aspect         | Interactive (default)                    | Auto (--auto)             |
| -------------- | ---------------------------------------- | ------------------------- |
| Exploration    | Orchestrator spawns explorers            | Same                      |
| Planning       | Orchestrator runs planning skill         | Planner sub-agent         |
| User Questions | AskUserQuestion for decisions            | Auto-decide               |
| Confirmation   | User approves plan                       | No confirmation           |
| Best For       | Important features, unclear requirements | Well-defined tasks, CI/CD |

---

## Options Reference

| Option               | Description                                   |
| -------------------- | --------------------------------------------- |
| `--auto`             | Skip user interaction, auto-decide everything |
| `--max-workers N`    | Limit concurrent workers (0 = unlimited)      |
| `--max-iterations N` | Max execute→verify loops (default: 5)         |
| `--skip-verify`      | Skip verification phase                       |
| `--plan-only`        | Stop after planning, don't execute            |

---

## Zero Tolerance Rules

Before ANY completion claim:
- No blocked phrases ("should work", "basic implementation")
- Evidence exists for all criteria
- All tasks resolved
- Verifier passed (unless --skip-verify)
