# Planning Phase Reference

**Used by**: `ultrawork.md`, `ultrawork-plan.md`

**Purpose**: Convert exploration context into executable design and task breakdown.

---

## Overview

Planning takes the exploration findings and turns them into:
1. **Design Document** - Architecture decisions, approach selection, error handling
2. **Task Graph** - Decomposed work with dependencies and success criteria

**Modes**:
- **Interactive** (default): Orchestrator runs planning skill, uses AskUserQuestion
- **Auto** (`--auto`): Planner agent makes decisions automatically

---

## Interactive Mode Workflow

### Phase 1: Context Analysis

Read exploration context to inform decisions:

```bash
# Get context summary (AI-friendly markdown) - NEVER cat JSON directly
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --summary

# Or get specific fields
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --field key_files
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --field patterns
```

```python
# Read detailed exploration files (Markdown files OK to Read directly)
Read(f"{session_dir}/exploration/overview.md")
Read(f"{session_dir}/exploration/exp-1.md")
# etc.
```

Extract key information:
- **Tech Stack**: Languages, frameworks, libraries already in use
- **Patterns**: Architecture patterns (MVC, Repository, Service Layer)
- **Constraints**: Existing conventions, file structure, naming patterns
- **Related Code**: Files that will be affected by changes

### Phase 2: Complexity Assessment

Determine planning depth based on goal complexity:

| Complexity | Indicators                           | Planning Depth       |
| ---------- | ------------------------------------ | -------------------- |
| Simple     | 1-2 files, no new patterns           | Skip interview       |
| Standard   | 3-5 files, follow existing patterns  | 1 interview round    |
| Complex    | 5+ files, new patterns, breaking API | 2-3 interview rounds |
| Massive    | Architecture change, refactor        | 3-4+ interview rounds |

### Phase 3: Deep Interview (if needed)

**For non-trivial tasks, conduct interview rounds:**

📖 **Detailed protocol**: See `skills/planning/references/`
- [brainstorm-protocol.md](../../skills/planning/references/brainstorm-protocol.md) - Interview flow
- [interview-rounds.md](../../skills/planning/references/interview-rounds.md) - Round templates
- [context-aware-options.md](../../skills/planning/references/context-aware-options.md) - Option generation

**Key principles**:
1. Batch related questions (max 4 per call)
2. Generate options from exploration context (not generic templates)
3. Recommend option that follows existing patterns
4. Record all decisions for design document

**Question priority order**:
1. Purpose/Goal - What problem does this solve?
2. Scope - MVP / Full / Prototype?
3. Constraints - Performance, security, compatibility?
4. Architecture - Follow existing patterns / New patterns?
5. Libraries - Which packages to use?

### Phase 4: Document Design

Create design document in project directory:

```bash
# Get working directory from session
WORKING_DIR=$(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js --session ${CLAUDE_SESSION_ID} --field working_dir)

# Design document path
# Format: {working_dir}/docs/plans/YYYY-MM-DD-{goal-slug}-design.md
DESIGN_PATH="$WORKING_DIR/docs/plans/$(date +%Y-%m-%d)-{goal-slug}-design.md"

# Create directory if needed
mkdir -p "$WORKING_DIR/docs/plans"
```

📖 **Template**: See [design-template.md](../../skills/planning/references/design-template.md)

**Required sections**:
- Overview - High-level description
- Approach Selection - Considered options, selected approach with rationale
- Decisions - All choices made (with "Asked User: Yes/No")
- Architecture - Components, data flow, dependencies
- Error Handling - Categories, response format, fallback strategies
- Testing Strategy - Test levels, key cases, mock strategy
- Scope - In scope, out of scope, assumptions

### Phase 5: Task Decomposition

Break design into executable tasks:

📖 **Examples**: See [task-examples.md](../../skills/planning/references/task-examples.md)

**Task breakdown rules**:
- One task = one deliverable
- Max 30 minutes of work per task
- Single worker can complete
- Has clear success criteria
- Dependencies explicitly declared

**Task complexity selection**:

| Complexity | Model  | When to Use                                      |
| ---------- | ------ | ------------------------------------------------ |
| `simple`   | haiku  | Small changes, single file edit                  |
| `standard` | sonnet | Most tasks, multi-file changes                   |
| `complex`  | opus   | Architecture changes, refactors, security, tests |

**Task structure**:

```bash
bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/task-create.js --session ${CLAUDE_SESSION_ID} \
  --id "1" \
  --subject "Brief task title" \
  --description "Detailed implementation steps" \
  --complexity standard \
  --criteria "Criterion 1|Criterion 2|Criterion 3" \
  --blocked-by "0" # Comma-separated task IDs (empty for no dependencies)
```

**Dependency patterns**:
- Independent tasks → `--blocked-by ""` (parallel execution)
- Sequential dependency → `--blocked-by "1"` (after task 1)
- Multi-dependency → `--blocked-by "1,2"` (after both)
- Verify task → `--blocked-by "1,2,3,4"` (after all implementation tasks)

**Wave pattern** (recommended):

```
Wave 1: Foundation tasks (parallel, no dependencies)
  ├─ Task 1: Setup/Config
  └─ Task 2: Data Model

Wave 2: Core implementation (depends on Wave 1)
  ├─ Task 3: Business logic
  └─ Task 4: API routes

Wave 3: Testing (depends on Wave 2)
  ├─ Task 5: Unit tests
  └─ Task 6: Integration tests

Wave 4: Verification (depends on all)
  └─ Task verify: [VERIFY] Complete integration
```

---

## Auto Mode Workflow

Planner agent handles all steps automatically:

```python
Task(
    subagent_type="ultrawork:planner:planner",
    model="inherit",
    prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}

Read exploration context and create:
1. Design document (docs/plans/)
2. Task breakdown (tasks/*.json)

Use existing patterns from exploration.
Make reasonable decisions, document rationale.
"""
)
```

**Auto decision heuristics**:
- If existing pattern exists → follow it
- If dependency present → use it
- If multiple valid options → choose most common/standard
- When unsure → prefer simpler, reversible choices

---

## Phase Transition

After planning completes:

```bash
# Update session phase
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase EXECUTION
```

---

## YAGNI Checklist

Before finalizing plan, verify:

- [ ] No features beyond stated goal
- [ ] No "future-proofing" abstractions
- [ ] No optional enhancements
- [ ] Minimum viable scope only
- [ ] All decisions documented with rationale
- [ ] Tasks have clear success criteria
- [ ] Dependencies form valid DAG (no cycles)
