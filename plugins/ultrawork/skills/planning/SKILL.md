---
name: planning
description: "This skill should be used when designing implementation plans, decomposing complex work into tasks, or making architectural decisions during ultrawork sessions. Used by orchestrator (interactive mode) and planner agent (auto mode)."
---

# Planning Protocol

## Overview

Define how to analyze context, make design decisions, and decompose work into tasks.

**Two modes:**
- **Interactive**: Orchestrator uses AskUserQuestion for decisions
- **Auto**: Planner agent makes decisions based on context alone

---

## Phase 1: Read Context

### Required Files

```
{SESSION_DIR}/
├── session.json        # Goal and metadata
├── context.json        # Summary/links from explorers
└── exploration/        # Detailed findings
    └── *.md
```

### Read Order

1. `session.json` - understand the goal
2. `context.json` - get summary, key files, patterns
3. `exploration/*.md` - read detailed markdown as needed

---

## Phase 2: Identify Decisions

Analyze the goal against context to find decision points.

| Category | Examples | Priority |
|----------|----------|----------|
| **Ambiguous Requirements** | "auth" → OAuth? Email? Both? | High |
| **Architecture Choices** | DB type, framework, patterns | High |
| **Library Selection** | Which packages to use | Medium |
| **Scope Boundaries** | What's in/out of scope | Medium |

---

## Phase 3: Make Decisions

### Interactive Mode

Use AskUserQuestion for each decision:

```python
AskUserQuestion(questions=[{
  "question": "Which authentication method should we implement?",
  "header": "Auth",
  "options": [
    {"label": "OAuth + Email (Recommended)", "description": "Most flexible"},
    {"label": "OAuth only", "description": "Simpler setup"},
    {"label": "Email only", "description": "Traditional approach"}
  ],
  "multiSelect": False
}])
```

**Rules:**
- One question at a time
- Max 4 options
- Add "(Recommended)" to suggested option
- Present 2-3 approaches before asking

See `references/brainstorm-protocol.md` for detailed question flow.

### Auto Mode

Make decisions automatically based on:
- Existing patterns in codebase
- Dependencies already present
- Common best practices

---

## Phase 4: Document Design

**IMPORTANT: Design documents go to PROJECT directory.**

```bash
WORKING_DIR=$($SCRIPTS/session-get.sh --session {SESSION_ID} --field working_dir)
DESIGN_PATH="$WORKING_DIR/docs/plans/$(date +%Y-%m-%d)-{goal-slug}-design.md"
```

Write comprehensive design.md with:
- Overview and approach selection
- Decisions with rationale
- Architecture and components
- Error handling strategy
- Testing strategy
- Scope (in/out)

See `references/design-template.md` for complete template.

---

## Phase 5: Decompose Tasks

### Task Granularity

| Rule | Guideline |
|------|-----------|
| One task = one deliverable | Single focused outcome |
| Max time | ~30 minutes of work |
| Testable | Has clear success criteria |

### Complexity Guidelines

| Complexity | Model | When |
|------------|-------|------|
| `standard` | sonnet | CRUD, simple features, tests |
| `complex` | opus | Architecture, security, 5+ files |

### Dependency Patterns

```
Independent      → blockedBy: []
Sequential       → blockedBy: ["1"]
Multi-dependency → blockedBy: ["1","2"]
Verify task      → blockedBy: [all]
```

### Create Tasks

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/scripts"

$SCRIPTS/task-create.sh --session {SESSION_ID} \
  --id "1" \
  --subject "Task title" \
  --description "Detailed description" \
  --complexity standard \
  --criteria "criterion1|criterion2"

# Always include verify task
$SCRIPTS/task-create.sh --session {SESSION_ID} \
  --id "verify" \
  --subject "[VERIFY] Integration verification" \
  --description "Verify all flows work end-to-end" \
  --blocked-by "1,2,3" \
  --complexity complex \
  --criteria "All tests pass|Manual verification works"
```

See `references/task-examples.md` for complete examples.

---

## Output Summary

Return planning summary:

```markdown
# Planning Complete

## Design Decisions
| Topic | Choice | User Asked |
|-------|--------|------------|
| Auth method | OAuth + Credentials | Yes |

## Task Graph
| ID | Subject | Blocked By | Complexity |
|----|---------|------------|------------|
| 1 | Setup auth | - | standard |
| 2 | User model | 1 | standard |
| verify | Verification | 1,2 | complex |

## Files Created
- {WORKING_DIR}/docs/plans/YYYY-MM-DD-design.md
- {SESSION_DIR}/tasks/*.json
```

---

## Additional Resources

### Reference Files

- **`references/brainstorm-protocol.md`** - Interactive question flow and approach exploration
- **`references/design-template.md`** - Complete design document template
- **`references/task-examples.md`** - Task decomposition examples with script commands
