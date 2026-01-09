---
name: ultrawork-plan
description: "Interactive planning phase - explore, clarify, design, then produce task breakdown"
argument-hint: "<goal> | --help"
allowed-tools: ["Task", "TaskOutput", "Read", "Write", "Edit", "AskUserQuestion", "Glob", "Grep", "Bash(${CLAUDE_PLUGIN_ROOT}/scripts/*.sh:*)"]
---

# Ultrawork Plan Command

**Standalone interactive planning** - use when you want to plan before committing to execution.

This command follows the **planning skill protocol** (`skills/planning/SKILL.md`).

---

## Delegation Rules (MANDATORY)

The orchestrator MUST delegate exploration to sub-agents. Direct execution is prohibited.

| Phase | Delegation | Direct Execution |
|-------|------------|------------------|
| Exploration | ALWAYS via `Task(subagent_type="ultrawork:explorer")` | NEVER |
| Planning | N/A | ALWAYS (interactive by design) |

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

## Overview

```
/ultrawork-plan "goal"
    ↓
Exploration → Clarification → Design → Task Breakdown
    ↓
Output: design.md + tasks/ (ready for /ultrawork-exec)
```

---

## Step 1: Initialize Session

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ultrawork.sh" --plan-only $ARGUMENTS
```

This creates session directory without starting execution.

---

## Step 2: Exploration Phase (Dynamic)

Exploration happens in two stages: Overview first, then targeted based on analysis.

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

**Wait using polling pattern (see Interruptibility section):**

```python
while True:
    phase = Bash(f'"{CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {session_dir} --field phase')
    if phase.output.strip() == "CANCELLED":
        return

    result = TaskOutput(task_id=overview_task_id, block=False, timeout=5000)
    if result.status in ["completed", "error"]:
        break
```

Read the result:
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

### Exploration Output

Explorers will create:
- `exploration/overview.md` - Project overview
- `exploration/exp-1.md`, `exp-2.md`, ... - Targeted findings
- `context.json` - Aggregated summary with links

---

## Step 3: Present Findings

Read and summarize exploration results:

```bash
# Read lightweight summary
cat {session_dir}/context.json

# Read overview first
cat {session_dir}/exploration/overview.md

# Read targeted explorations
cat {session_dir}/exploration/exp-1.md
cat {session_dir}/exploration/exp-2.md
# ... (as many as were created)
```

Present to user:

```markdown
## What I Found

**Project Type**: {detected type}
**Key Files**: {from context.json}

**Relevant Patterns**:
- {pattern 1 with evidence}
- {pattern 2 with evidence}

**Constraints Detected**:
- {constraint 1}
- {constraint 2}
```

---

## Step 4: Clarify Requirements (Brainstorm Protocol)

**Reference: `skills/planning/SKILL.md` Phase 2-3**

### Key Rules
1. **One question at a time** - never batch multiple questions
2. **Multiple choice preferred** - easier to answer
3. **Include recommendation** - add "(Recommended)" to suggested option
4. **Max 4 options** - keep choices manageable

### Question Flow

For each unclear aspect, ask in order:

**1. Scope Clarification** (if ambiguous)
```python
AskUserQuestion(questions=[{
  "question": "이 기능의 범위가 어디까지인가요?",
  "header": "Scope",
  "options": [
    {"label": "MVP만 (Recommended)", "description": "핵심 기능만 구현"},
    {"label": "전체 구현", "description": "모든 세부 기능 포함"},
    {"label": "프로토타입", "description": "동작 확인용 최소 구현"}
  ],
  "multiSelect": False
}])
```

**2. Architecture Choice** (if multiple approaches)
```python
AskUserQuestion(questions=[{
  "question": "어떤 아키텍처 패턴을 사용할까요?",
  "header": "Architecture",
  "options": [
    {"label": "기존 패턴 따름 (Recommended)", "description": "프로젝트 일관성 유지"},
    {"label": "새 패턴 도입", "description": "더 나은 구조로 변경"},
    {"label": "하이브리드", "description": "점진적 마이그레이션"}
  ],
  "multiSelect": False
}])
```

**3. Library Selection** (if choices exist)
```python
AskUserQuestion(questions=[{
  "question": "어떤 라이브러리를 사용할까요?",
  "header": "Library",
  "options": [
    {"label": "next-auth (Recommended)", "description": "Next.js 표준, OAuth 지원"},
    {"label": "passport.js", "description": "유연한 전략 패턴"},
    {"label": "직접 구현", "description": "의존성 최소화"}
  ],
  "multiSelect": False
}])
```

**4. Priority/Order** (if multiple features)
```python
AskUserQuestion(questions=[{
  "question": "어떤 기능을 먼저 구현할까요?",
  "header": "Priority",
  "options": [
    {"label": "인증 먼저", "description": "다른 기능의 기반"},
    {"label": "UI 먼저", "description": "빠른 피드백"},
    {"label": "API 먼저", "description": "프론트/백엔드 병렬 작업"}
  ],
  "multiSelect": False
}])
```

Continue until all decisions are made. Record each decision.

---

## Step 5: Present Design Incrementally

**Reference: `skills/planning/SKILL.md` Phase 4**

Present design in sections (200-300 words each):

### Section 1: Overview
```markdown
## Design Overview

**Goal**: {goal}

**Approach**: {chosen approach based on decisions}

**Key Components**:
1. {component 1}
2. {component 2}
3. {component 3}
```

Ask for confirmation:
```python
AskUserQuestion(questions=[{
  "question": "Overview가 맞나요?",
  "header": "Confirm",
  "options": [
    {"label": "네, 계속", "description": "다음 섹션으로"},
    {"label": "수정 필요", "description": "피드백 있음"}
  ],
  "multiSelect": False
}])
```

### Section 2: Architecture Details
```markdown
## Architecture

### Data Flow
{diagram or description}

### Component Interactions
{how components work together}
```

Ask for confirmation...

### Section 3: Scope Definition
```markdown
## Scope

### In Scope
- {feature 1}
- {feature 2}

### Out of Scope
- {excluded 1}
- {excluded 2}

### Assumptions
- {assumption 1}
- {assumption 2}
```

Ask for confirmation...

---

## Step 6: Write Design Document

Write comprehensive `design.md`:

```python
Write(
  file_path="{session_dir}/design.md",
  content="""
# Design: {goal}

## Overview
...

## Decisions
...

## Architecture
...

## Scope
...
"""
)
```

---

## Step 7: Task Decomposition

Based on design, create tasks:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/task-create.sh" --session {session_dir} \
  --id "1" \
  --subject "Setup database schema" \
  --description "Create migration for user table" \
  --complexity standard \
  --criteria "Migration runs|Schema matches design"

"${CLAUDE_PLUGIN_ROOT}/scripts/task-create.sh" --session {session_dir} \
  --id "2" \
  --subject "Implement user model" \
  --description "Add User model with CRUD operations" \
  --blocked-by "1" \
  --complexity standard \
  --criteria "CRUD works|Tests pass"

# Always include verify task
"${CLAUDE_PLUGIN_ROOT}/scripts/task-create.sh" --session {session_dir} \
  --id "verify" \
  --subject "[VERIFY] Integration verification" \
  --description "Verify all success criteria met" \
  --blocked-by "1,2" \
  --complexity complex \
  --criteria "All tests pass|No blocked patterns"
```

---

## Step 8: Final Summary

Present task breakdown for approval:

```markdown
## Task Breakdown

| ID | Task | Complexity | Blocked By | Criteria |
|----|------|------------|------------|----------|
| 1 | Setup schema | standard | - | Migration runs |
| 2 | User model | standard | 1 | CRUD works |
| verify | Verification | complex | 1,2 | Tests pass |

## Parallel Waves
1. **Wave 1**: [1]
2. **Wave 2**: [2]
3. **Wave 3**: [verify]

## Files Created
- {session_dir}/design.md
- {session_dir}/tasks/1.json
- {session_dir}/tasks/2.json
- {session_dir}/tasks/verify.json
```

```python
AskUserQuestion(questions=[{
  "question": "계획이 완성되었습니다. 어떻게 할까요?",
  "header": "Next",
  "options": [
    {"label": "저장만", "description": "나중에 /ultrawork-exec로 실행"},
    {"label": "바로 실행", "description": "지금 실행 시작"},
    {"label": "수정", "description": "태스크 수정"}
  ],
  "multiSelect": False
}])
```

---

## Output

Planning creates:
- `{session_dir}/design.md` - comprehensive design document
- `{session_dir}/tasks/*.json` - task files
- `{session_dir}/context.json` - exploration summaries
- `{session_dir}/exploration/*.md` - detailed exploration

Run `/ultrawork-exec` to execute the plan.
