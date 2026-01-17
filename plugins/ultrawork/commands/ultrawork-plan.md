---
name: ultrawork-plan
description: "Interactive planning phase - explore, clarify, design, then produce task breakdown"
argument-hint: "[--auto] <goal> | --help"
allowed-tools: ["Task", "TaskOutput", "Read", "Write", "Edit", "AskUserQuestion", "Glob", "Grep", "Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/*.js:*)", "mcp__plugin_serena_serena__activate_project"]
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

| Phase                | Delegation                                            | Direct Execution                                           |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Overview Exploration | N/A                                                   | ALWAYS via `Skill(skill="ultrawork:overview-exploration")` |
| Targeted Exploration | ALWAYS via `Task(subagent_type="ultrawork:explorer")` | NEVER                                                      |
| Planning (non-auto)  | N/A                                                   | ALWAYS (interactive by design)                             |
| Planning (auto)      | ALWAYS via `Task(subagent_type="ultrawork:planner")`  | NEVER                                                      |

**Exception**: User explicitly requests direct execution (e.g., "run this directly", "execute without agent").

---

## Interruptibility (Background + Polling)

To allow user interruption during exploration, use **background execution with polling**.

```python
# Poll pattern for all Task waits
while True:
    # Check if session was cancelled
    phase = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field phase')
    if phase.output.strip() == "CANCELLED":
        return  # Exit cleanly

    # Non-blocking check
    result = TaskOutput(task_id=task_id, block=False, timeout=5000)
    if result.status in ["completed", "error"]:
        break
```

---

## Session ID Handling (CRITICAL)

**All scripts require `--session <id>` flag. Extract the actual UUID from system-reminder, not placeholders.**

📖 **Detailed guide**: See [Session ID Handling Guide](references/session-id-guide.md)

**Quick reference:**
```bash
# Get SESSION_ID from system-reminder hook output
# Example: CLAUDE_SESSION_ID: 37b6a60f-8e3e-4631-8f62-8eaf3d235642

# Use actual UUID (NOT placeholders like ${CLAUDE_SESSION_ID})
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642 --plan-only "goal"

# Get session directory
SESSION_DIR=~/.claude/ultrawork/sessions/37b6a60f-8e3e-4631-8f62-8eaf3d235642
```

---

## Step 1: Initialize Session

```bash
# ${CLAUDE_SESSION_ID} is auto-replaced by Claude Code v2.1.9+
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session ${CLAUDE_SESSION_ID} --plan-only $ARGUMENTS
```

**After initialization, get session_dir via variable:**

```bash
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}
```

Parse the setup output to get:
- Goal
- Options (auto_mode)

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

**Stage 1b: Scope Analysis (Parallel with Overview)**

Spawn scope analyzer to detect cross-layer dependencies:

```python
# After overview exploration completes, spawn scope analyzer
Task(
  subagent_type="ultrawork:scope-analyzer:scope-analyzer",
  model="haiku",
  prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}

REQUEST: {goal}

CONTEXT: (Read from exploration/overview.md after it exists)
"""
)
```

The scope analyzer runs in parallel with targeted exploration. It writes results to `context.json` via `scopeExpansion` field.

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

Task(
  subagent_type="ultrawork:planner:planner",
  model="opus",
  prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}

Goal: {goal}

Options:
- require_success_criteria: true
- include_verify_task: true
"""
)
# Foreground execution - waits for completion
```

Skip to Step 4 (Plan Review).

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

# Read detailed exploration files (Markdown OK)
Read("$SESSION_DIR/exploration/exp-1.md")
Read("$SESSION_DIR/exploration/exp-2.md")
Read("$SESSION_DIR/exploration/exp-3.md")
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

#### 3b-1. Display Scope Expansion Analysis (Interactive Mode Only)

If scope expansion was detected, display it and ask user preference:

```python
# Get scopeExpansion via script (NEVER Read JSON directly)
# Bash: bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --field scopeExpansion
scopeExpansion = parse_json(scope_output)

if scopeExpansion and scopeExpansion.get('dependencies'):
    # Display analysis
    print(f"""
## 📊 Scope Expansion Analysis

**Original Request**: {scopeExpansion['originalRequest']}
**Detected Layers**: {', '.join(scopeExpansion['detectedLayers'])}
**Confidence**: {scopeExpansion['confidence']}

### Dependencies Detected

| From | To | Type | Reason |
|------|----|------|--------|
{format_dependency_table(scopeExpansion['dependencies'])}

### Suggested Additional Tasks
{format_suggested_tasks(scopeExpansion['suggestedTasks'])}

### Blocking Constraints
{format_constraints(scopeExpansion['blockingConstraints'])}
""")

    # Ask user preference (Interactive mode only)
    AskUserQuestion(questions=[{
      "question": "Include scope expansion tasks?",
      "header": "Scope",
      "options": [
        {"label": "Include all (Recommended)", "description": "Add all blocking + recommended dependencies"},
        {"label": "Blocking only", "description": "Only add tasks for blocking dependencies"},
        {"label": "Skip", "description": "Proceed with original request only"}
      ],
      "multiSelect": False
    }])
```

Store user's choice for planner to use when creating tasks.

#### 3c. Clarify Requirements (Brainstorm Protocol)

**Ask related questions in batches (max 4 per AskUserQuestion call).** Reference `skills/planning/SKILL.md` Phase 2-3 and `commands/references/03-interview.md`.

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

**IMPORTANT: Design documents go to PROJECT directory, not session directory.**

```bash
# Get working directory from session
WORKING_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field working_dir)

# Create docs/plans directory if needed
mkdir -p "$WORKING_DIR/docs/plans"

# Generate filename with date and goal slug
# Format: YYYY-MM-DD-{goal-slug}-design.md
DESIGN_PATH="$WORKING_DIR/docs/plans/$(date +%Y-%m-%d)-{goal-slug}-design.md"

# Write design document to PROJECT directory
Write(
  file_path=DESIGN_PATH,
  content=design_content
)
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
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase PLANNING_COMPLETE
```

---

## Step 4: Plan Review & Confirmation

**Read the plan:**

```bash
# Get working directory and session directory
WORKING_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field working_dir)
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}

# List tasks
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${CLAUDE_SESSION_ID}

# Read design (from PROJECT directory)
Read("$WORKING_DIR/docs/plans/YYYY-MM-DD-{goal-slug}-design.md")
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

**Project Directory** (`$WORKING_DIR`):
- `docs/plans/YYYY-MM-DD-{goal-slug}-design.md` - comprehensive design document

**Session Directory** (`$SESSION_DIR`):
- `tasks/*.json` - task files (internal metadata)
- `context.json` - exploration summaries
- `exploration/*.md` - detailed exploration

Run `/ultrawork-exec` to execute the plan.

---

## Directory Structure

**Session Directory** (internal metadata):
`~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}`

```
$SESSION_DIR/
├── session.json        # Session metadata (JSON)
├── context.json        # Explorer summaries (JSON)
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

**Project Directory** (user deliverables):
`bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field working_dir`

```
$WORKING_DIR/
└── docs/
    └── plans/
        └── YYYY-MM-DD-{goal-slug}-design.md  # Design document
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
