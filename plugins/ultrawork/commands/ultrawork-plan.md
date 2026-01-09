---
name: ultrawork-plan
description: "Interactive planning phase - explore, clarify, design, then produce task breakdown"
argument-hint: "[--auto] <goal> | --help"
allowed-tools: ["Task", "TaskOutput", "Read", "Write", "Edit", "AskUserQuestion", "Glob", "Grep", "Bash(${CLAUDE_PLUGIN_ROOT}/scripts/*.sh:*)"]
---

# Ultrawork Plan Command

**Standalone interactive planning** - use when you want to plan before committing to execution.

This command follows the **planning skill protocol** (`skills/planning/SKILL.md`).

---

## Overview

```
/ultrawork-plan "goal"
    ↓
Initialize → Exploration → Clarification → Design → Task Breakdown
    ↓
Output: design.md + tasks/ (ready for /ultrawork-exec)
```

---

## Delegation Rules (MANDATORY)

The orchestrator MUST delegate exploration to sub-agents. Direct execution is prohibited except for Overview.

| Phase | Delegation | Direct Execution |
|-------|------------|------------------|
| Overview Exploration | N/A | ALWAYS via `Skill(skill="ultrawork:overview-exploration")` |
| Targeted Exploration | ALWAYS via `Task(subagent_type="ultrawork:explorer")` | NEVER |
| Planning (non-auto) | N/A | ALWAYS (interactive by design) |
| Planning (auto) | ALWAYS via `Task(subagent_type="ultrawork:planner")` | NEVER |

**Exception**: User explicitly requests direct execution (e.g., "run this directly", "execute without agent").

---

## Interruptibility (Background + Polling)

To allow user interruption during exploration, use **background execution with polling**.

```python
# Poll pattern for all Task waits
while True:
    # Check if session was cancelled
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
    if phase.output.strip() == "CANCELLED":
        return  # Exit cleanly

    # Non-blocking check
    result = TaskOutput(task_id=task_id, block=False, timeout=5000)
    if result.status in ["completed", "error"]:
        break
```

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
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ultrawork.sh" --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642 --plan-only "goal"

# ❌ WRONG - do not use placeholders
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ultrawork.sh" --session {SESSION_ID} --plan-only "goal"
```

### Variables used in this document

| Variable | Source | Example Value |
|----------|--------|---------------|
| `SESSION_ID` | Hook output `CLAUDE_SESSION_ID` | `37b6a60f-8e3e-4631-8f62-8eaf3d235642` |
| `session_dir` | Setup script output | `~/.claude/ultrawork/sessions/37b6a60f-8e3e-4631-8f62-8eaf3d235642/` |

**Note:** In code examples below, `{session_dir}` represents a Python f-string variable or the actual session directory path. Always substitute with real values when executing.

---

## Step 1: Initialize Session

**First, extract SESSION_ID from the system-reminder hook output, then execute:**

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ultrawork.sh" --session <YOUR_SESSION_ID_HERE> --plan-only $ARGUMENTS
```

Replace `<YOUR_SESSION_ID_HERE>` with the actual UUID from `CLAUDE_SESSION_ID` in system-reminder.

This creates session at: `~/.claude/ultrawork/sessions/{session_id}/`

Parse the output to get:
- Session ID
- Session directory path
- Goal
- Options (auto_mode)

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

Exploration happens in two stages: Overview first, then targeted based on analysis.

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
pending_tasks = [task_id_1, task_id_2, ...]

while pending_tasks:
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
    if phase.output.strip() == "CANCELLED":
        return

    for task_id in pending_tasks[:]:
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

Skip to Step 4 (Plan Review).

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

```python
Write(
  file_path=f"{session_dir}/design.md",
  content=design_content
)
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
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" --session {session_dir} --phase PLANNING_COMPLETE
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
  "question": "Ready to proceed with this plan?",
  "header": "Plan approval",
  "options": [
    {"label": "Approve", "description": "Execute this plan"},
    {"label": "Request changes", "description": "Modify the plan"},
    {"label": "Cancel", "description": "Cancel the session"}
  ],
  "multiSelect": False
}])
```

- "Approve" → report plan summary, ready for `/ultrawork-exec`
- "Request changes" → get feedback, re-run planning
- "Cancel" → end session

---

## Output

Planning creates:
- `{session_dir}/design.md` - comprehensive design document
- `{session_dir}/tasks/*.json` - task files
- `{session_dir}/context.json` - exploration summaries
- `{session_dir}/exploration/*.md` - detailed exploration

Run `/ultrawork-exec` to execute the plan.

---

## Directory Structure

```
~/.claude/ultrawork/sessions/{session_id}/
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

| Aspect | Interactive (default) | Auto (--auto) |
|--------|----------------------|---------------|
| Exploration | Orchestrator spawns explorers | Same |
| Planning | Orchestrator runs planning skill | Planner sub-agent |
| User Questions | AskUserQuestion for decisions | Auto-decide |
| Confirmation | User approves plan | No confirmation |
| Best For | Important features, unclear requirements | Well-defined tasks, CI/CD |
