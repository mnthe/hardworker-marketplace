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

## Step 2: Exploration Phase (Dynamic)

Exploration happens in two stages: Overview first, then targeted exploration.

### Stage 2a: Quick Overview

Spawn ONE overview explorer first:

```python
Task(
  subagent_type="ultrawork:explorer:explorer",
  model="haiku",
  prompt="""
ULTRAWORK_SESSION: {session_dir}
EXPLORER_ID: overview
EXPLORATION_MODE: overview

Perform quick project overview:
- Project type (Next.js, Express, CLI, library, etc.)
- Directory structure (src/, app/, lib/, etc.)
- Tech stack (from package.json, requirements.txt, etc.)
- Key entry points
- Existing patterns (auth, db, api, etc.)
"""
)
```

Wait for overview to complete. Read the result:
```bash
cat {session_dir}/exploration/overview.md
```

### Stage 2b: Analyze & Plan Targeted Exploration

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

### Stage 2c: Targeted Exploration

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

Wait for all targeted explorers using TaskOutput.

### Exploration Output

Explorers will create:
- `exploration/overview.md` - Project overview
- `exploration/exp-1.md`, `exp-2.md`, ... - Targeted findings
- `context.json` - Aggregated summary with links

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

Wait for planner to complete. Skip to Step 4.

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

[Rest of execution, verification, and completion logic remains the same...]

Read session directory to get tasks:

```bash
ls {session_dir}/tasks/
```

Find unblocked tasks and spawn workers...

(Refer to existing Step 4-7 from previous version)

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
