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

**All scripts require `--session <id>` flag. Extract the actual UUID from system-reminder, not placeholders.**

📖 **Detailed guide**: See [Session ID Handling Guide](references/session-id-guide.md)

**Quick reference:**
```bash
# Get SESSION_ID from system-reminder hook output
# Example: CLAUDE_SESSION_ID: 37b6a60f-8e3e-4631-8f62-8eaf3d235642

# Use actual UUID (NOT placeholders like ${CLAUDE_SESSION_ID})
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642 "goal"

# Get session directory
SESSION_DIR=~/.claude/ultrawork/sessions/37b6a60f-8e3e-4631-8f62-8eaf3d235642
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

```bash
# ${CLAUDE_SESSION_ID} is auto-replaced by Claude Code v2.1.9+
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session ${CLAUDE_SESSION_ID} $ARGUMENTS
```

**After initialization, get session_dir via variable:**

```bash
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}
```

Parse the setup output to get:
- Goal
- Options (max_workers, skip_verify, plan_only, auto_mode)

---

## Step 1.5: Resume Check (CRITICAL for interrupted sessions)

**Before starting exploration, check session state to determine where to resume.**

📖 **Detailed guide**: See [Explorer Phase - Resume Check](references/01-explorer.md#resume-check-for-interrupted-sessions)

**Quick reference:**
```python
# Read session state
exploration_stage = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field exploration_stage')

# Resume based on stage
# not_started → Begin overview
# overview → Check overview.md exists → proceed to targeted
# analyzing → Generate hints, set expected_explorers
# targeted → Check for missing explorers, re-spawn if needed
# complete → Skip to planning
```

---

## Step 2: Exploration Phase (Dynamic)

**Exploration happens in three stages: Overview → Analyze → Targeted.**

📖 **Detailed guide**: See [Explorer Phase Reference](references/01-explorer.md)

### Quick Workflow

**Stage 1: Overview (Direct via Skill)**
```python
Skill(skill="ultrawork:overview-exploration")
```
Produces: `exploration/overview.md`, `context.json`

**Stage 2: Analyze & Plan Targeted**
```bash
# Update stage
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --exploration-stage analyzing

# Analyze overview + goal → generate hints
# Set expected explorers BEFORE spawning
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-init.js" --session ${CLAUDE_SESSION_ID} --expected "overview,exp-1,exp-2"
```

**Stage 3: Targeted Exploration**
```bash
# Update stage
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --exploration-stage targeted

# Spawn explorers (parallel, in single message)
# Task(subagent_type="ultrawork:explorer:explorer", ...) for each hint

# After completion
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --exploration-stage complete
```

**Output**: `exploration/*.md`, `context.json` with exploration_complete=true

---

## Step 3: Planning Phase (MODE BRANCHING)

📖 **Detailed guides**:
- [Planning Phase Reference](references/02-planning.md) - Context analysis, task decomposition, YAGNI
- [Interview Phase Reference](references/03-interview.md) - Deep clarification (interactive mode only)

### If `--auto` was set → Auto Mode

Spawn Planner sub-agent:

```python
# SESSION_DIR is set via: SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}

# Foreground execution - waits for completion
Task(
  subagent_type="ultrawork:planner:planner",
  model="opus",
  prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}

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

```bash
# Get session directory
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}

# Get context summary (AI-friendly markdown) - NEVER use Read on JSON
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --summary

# Or get specific fields
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --field key_files
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --field patterns
```

```python
# Read detailed exploration files (Markdown OK)
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

**Ask related questions in batches (max 4 per AskUserQuestion call).** Reference `commands/references/03-interview.md` for full interview protocol.

For ambiguous or unclear aspects:

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

**IMPORTANT: Design documents go to PROJECT directory, not session directory.**

```bash
# Get working directory from session
WORKING_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field working_dir)

# Create docs/plans directory if needed
mkdir -p "$WORKING_DIR/docs/plans"

# Write design document to PROJECT directory
# Format: YYYY-MM-DD-{goal-slug}-design.md
```

See `skills/planning/SKILL.md` Phase 4 for template.

#### 3f. Task Decomposition

Decompose design into tasks. Write each task:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-create.js" --session ${CLAUDE_SESSION_ID} \
  --id "1" \
  --subject "Setup NextAuth provider" \
  --description "Configure NextAuth with credentials" \
  --complexity standard \
  --criteria "Auth routes respond|Login flow works"
```

Always include verify task at end.

#### 3g. Update Session Phase

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase EXECUTION
```

---

## Step 4: Plan Review & Confirmation

**Read the plan:**

```bash
# Get working directory (for design doc) and list tasks
WORKING_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field working_dir)

# List tasks via script (NEVER ls directly)
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID} --format table
```

```python
# Read design document from PROJECT directory (Markdown OK)
Read(f"{working_dir}/docs/plans/YYYY-MM-DD-{{goal-slug}}-design.md")
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
  "question": "Proceed with this plan?",
  "header": "Plan approval",
  "options": [
    {"label": "Approve", "description": "Execute according to this plan"},
    {"label": "Request changes", "description": "Modify the plan"},
    {"label": "Cancel", "description": "Cancel the work"}
  ],
  "multiSelect": False
}])
```

- "Approve" → proceed to Step 5
- "Request changes" → get feedback, re-run planning
- "Cancel" → end session

**If `--plan-only` was set:** Stop here, report plan summary.

---

## Step 5: Execution Phase

**Execute tasks → Verify → Complete (or Ralph Loop back to execution).**

📖 **Detailed guides**:
- [Execute Phase Reference](references/04-execute.md) - Worker spawning, parallel execution, TDD
- [Validate Phase Reference](references/05-validate.md) - Evidence audit, zero tolerance, PASS/FAIL

### Quick Workflow

**5a. Update Phase**
```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase EXECUTION
```

**5b. Execution Loop**
```python
# Find unblocked tasks
tasks = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID} --format json')

# Spawn workers (parallel in single message)
for task in unblocked_tasks:
    model = "opus" if task["complexity"] == "complex" else "sonnet"
    Task(subagent_type="ultrawork:worker:worker", model=model, prompt=f"SESSION_ID: ${CLAUDE_SESSION_ID}\nTASK_ID: {task['id']}...")
```

**5c. Verification**
```python
# Update phase
Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase VERIFICATION')

# Spawn verifier
Task(subagent_type="ultrawork:verifier:verifier", model="opus", prompt=f"SESSION_ID: ${CLAUDE_SESSION_ID}\nVerify all criteria...")
```

**5d. Completion or Ralph Loop**
```bash
# PASS → COMPLETE
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase COMPLETE

# FAIL → EXECUTION (next iteration)
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase EXECUTION --iteration $next_iteration
```

---

## Directory Structure

**Session Directory** (internal metadata):
`~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}`

```
$SESSION_DIR/
├── session.json        # Session metadata (JSON) - use session-get.js
├── context.json        # Explorer summaries (JSON) - use context-get.js
├── exploration/        # Detailed exploration (Markdown - OK to Read)
│   ├── overview.md
│   ├── exp-1.md
│   ├── exp-2.md
│   └── exp-3.md
└── tasks/              # Task files (JSON) - use task-*.js scripts
    ├── 1.json
    ├── 2.json
    └── verify.json
```

**Project Directory** (user deliverables):
`bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field working_dir`

```
$WORKING_DIR/
└── docs/
    └── plans/
        └── YYYY-MM-DD-{goal-slug}-design.md  # Design document (Markdown - OK to Read)
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

📖 **Complete rules**: See [Validate Phase - Zero Tolerance Rules](references/05-validate.md#zero-tolerance-rules)

Before ANY completion claim:
- No blocked phrases ("should work", "basic implementation", "TODO", etc.)
- Evidence exists for all criteria
- All tasks resolved
- Verifier passed (unless --skip-verify)
