---
name: ultrawork-plan
description: "Plan ultrawork session interactively - creates plan document"
argument-hint: "<goal> | --help"
allowed-tools: ["TaskCreate", "TaskUpdate", "TaskGet", "TaskList", "AskUserQuestion"]
---

# Ultrawork Plan Command

Interactive planning phase that produces a plan document.

**Output:** `docs/plans/ultrawork-plan.md` (or `ULTRAWORK_PLAN.md` in project root)

## Step 1: Understand Goal

Parse the goal from arguments. Ask clarifying questions if needed:

```python
AskUserQuestion(questions=[{
  "question": "What's the scope of this work?",
  "header": "Scope",
  "options": [
    {"label": "Single feature", "description": "One focused deliverable"},
    {"label": "Multiple features", "description": "Several related changes"},
    {"label": "Refactoring", "description": "Improve existing code"},
    {"label": "Bug fix", "description": "Fix specific issue"}
  ],
  "multiSelect": False
}])
```

## Step 2: Explore Codebase

Spawn explorers to gather context:

```python
# Parallel exploration
Task(subagent_type="ultrawork:explorer:explorer", model="haiku", ...)
Task(subagent_type="ultrawork:explorer:explorer", model="sonnet", ...)
```

## Step 3: Present Findings & Discuss

Share what was found. Ask for user input:

```markdown
## What I Found

**Relevant Files:**
- src/auth/... - Authentication module
- src/models/... - Data models

**Patterns:**
- Uses JWT for auth
- Repository pattern for data access

**Questions:**
1. Should we follow the existing JWT pattern?
2. Any constraints I should know about?
```

Iterate with user until understanding is clear.

## Step 4: Draft Task Breakdown

Present proposed tasks:

```markdown
## Proposed Tasks

### Task 1: Setup database schema
- **Complexity:** standard (sonnet)
- **Depends on:** -
- **Criteria:** Migration runs without error
- **Files:** src/db/migrations/

### Task 2: Implement user model
- **Complexity:** standard (sonnet)
- **Depends on:** Task 1
- **Criteria:** User CRUD operations work
- **Files:** src/models/user.ts

### Task 3: Auth middleware
- **Complexity:** complex (opus)
- **Depends on:** Task 2
- **Criteria:** JWT validation works
- **Files:** src/middleware/auth.ts
```

Ask for feedback:
```python
AskUserQuestion(questions=[{
  "question": "How does this breakdown look?",
  "header": "Review",
  "options": [
    {"label": "Looks good", "description": "Proceed to finalize"},
    {"label": "Needs changes", "description": "I have modifications"},
    {"label": "Missing tasks", "description": "Add more tasks"}
  ],
  "multiSelect": False
}])
```

## Step 5: Write Plan Document

Once approved, write the plan file:

```markdown
# Ultrawork Plan: {goal}

Generated: {timestamp}
Status: READY

## Goal
{goal description}

## Context
{summary of findings}

## Tasks

### task-1: Setup database schema
- **Complexity:** standard
- **Model:** sonnet
- **Depends on:** none
- **Success Criteria:**
  - [ ] Migration runs without error
  - [ ] Schema matches requirements
- **Files:** src/db/migrations/

### task-2: Implement user model
- **Complexity:** standard
- **Model:** sonnet
- **Depends on:** task-1
- **Success Criteria:**
  - [ ] User CRUD operations work
  - [ ] Tests pass
- **Files:** src/models/user.ts

### task-3: Auth middleware
- **Complexity:** complex
- **Model:** opus
- **Depends on:** task-2
- **Success Criteria:**
  - [ ] JWT validation works
  - [ ] Middleware protects routes
- **Files:** src/middleware/auth.ts

## Execution Order
1. task-1 (parallel ready)
2. task-2 (after task-1)
3. task-3 (after task-2)
4. verify (after all)

## Notes
{any user notes or constraints}

---
Run `/ultrawork-exec` to execute this plan.
```

Ensure directory exists and write:
```bash
mkdir -p docs/plans
```

Write to: `docs/plans/ultrawork-plan.md` or `ULTRAWORK_PLAN.md`

## Step 6: Confirm

```markdown
Plan saved to: docs/plans/ultrawork-plan.md

You can:
- Review and edit the plan file
- Run `/ultrawork-exec` to execute
- Run `/ultrawork-plan` again to restart planning
```
