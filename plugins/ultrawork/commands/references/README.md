# Ultrawork Command Reference Documentation

This directory contains phase-based reference documentation following progressive disclosure patterns. Each phase file is reused by multiple commands to eliminate duplication.

---

## Phase-Based Structure

| Reference File | Phase | Used By | Purpose |
|----------------|-------|---------|---------|
| **session-id-guide.md** | Common | All commands | SESSION_ID extraction and usage patterns |
| **01-explorer.md** | Explorer | ultrawork, ultrawork-plan | Codebase exploration (overview → targeted) |
| **02-planning.md** | Planning | ultrawork, ultrawork-plan | Design decisions and task decomposition |
| **03-interview.md** | Interview | ultrawork-plan (interactive) | Deep clarification through AskUserQuestion |
| **04-execute.md** | Execute | ultrawork, ultrawork-exec | Worker spawning, parallel execution, TDD |
| **05-validate.md** | Validate | ultrawork, ultrawork-exec | Evidence audit, zero tolerance, PASS/FAIL |

---

## Reuse Matrix

| Reference | ultrawork.md | ultrawork-plan.md | ultrawork-exec.md |
|-----------|--------------|-------------------|-------------------|
| session-id-guide | ✓ | ✓ | ✓ |
| 01-explorer | ✓ | ✓ | - |
| 02-planning | ✓ | ✓ | - |
| 03-interview | - | ✓ (interactive only) | - |
| 04-execute | ✓ | - | ✓ |
| 05-validate | ✓ | - | ✓ |

---

## File Descriptions

### session-id-guide.md (Common)

**Purpose**: Comprehensive guide for handling SESSION_ID parameter.

**Content**:
- How to extract SESSION_ID from system-reminder
- Correct vs incorrect usage examples (no placeholders!)
- Getting session directory path
- Reading session state

**Why shared**: All commands require SESSION_ID, usage pattern is identical.

---

### 01-explorer.md (Explorer Phase)

**Purpose**: Fast codebase understanding through overview → targeted exploration.

**Content**:
- Stage 1: Quick Overview (via overview-exploration skill)
- Stage 2: Analyze & Plan Targeted Exploration (decision matrix, hint generation)
- Stage 3: Targeted Exploration (parallel explorer agents)
- Resume check logic for interrupted sessions
- Exploration output structure

**Used by**:
- `ultrawork.md`: Full workflow includes exploration
- `ultrawork-plan.md`: Planning-only workflow starts with exploration

---

### 02-planning.md (Planning Phase)

**Purpose**: Convert exploration context into executable design and task breakdown.

**Content**:
- Interactive mode workflow (context analysis, complexity assessment, interview, design doc, task decomposition)
- Auto mode workflow (planner agent handles automatically)
- Task complexity selection (simple/standard/complex)
- Dependency patterns and wave structure
- YAGNI checklist

**Used by**:
- `ultrawork.md`: Full workflow includes planning
- `ultrawork-plan.md`: Planning-only workflow focuses on this phase

**Links to**: `skills/planning/references/` for detailed templates (design-template.md, task-examples.md)

---

### 03-interview.md (Interview Phase)

**Purpose**: Turn ambiguous ideas into clear designs through structured dialogue.

**Content**:
- Question rules (batch related questions max 4, multiple choice, recommended options)
- Question priority order
- Context-aware option generation (CRITICAL - no generic options!)
- Interview rounds (Intent & Scope, Technical Decisions, Edge Cases, Polish)
- Adaptive check (continue or finish)
- Recording decisions

**Used by**:
- `ultrawork-plan.md`: Interactive mode only (NOT auto mode)

**Links to**: `skills/planning/references/` for detailed protocols (brainstorm-protocol.md, interview-rounds.md, context-aware-options.md)

---

### 04-execute.md (Execute Phase)

**Purpose**: Execute tasks in parallel waves, spawning workers to implement the plan.

**Content**:
- Execution loop (find unblocked tasks, spawn workers, wait for completion)
- Worker selection (haiku/sonnet/opus by complexity)
- Worker pool management (--max-workers flag)
- Parallel execution strategies (foreground vs background+polling)
- Task status tracking and dependency checking
- TDD enforcement (gate hooks, TDD-RED → TDD-GREEN → TDD-REFACTOR)
- Evidence collection requirements
- Wave pattern examples

**Used by**:
- `ultrawork.md`: Full workflow includes execution
- `ultrawork-exec.md`: Execute-only workflow focuses on this phase

---

### 05-validate.md (Validate Phase)

**Purpose**: Verify all success criteria are met with concrete evidence before marking complete.

**Content**:
- Verification workflow (spawn verifier, audit evidence, scan for blocked patterns, run tests)
- Evidence audit requirements (every criterion has evidence, evidence is concrete)
- Zero tolerance rules (blocked patterns trigger instant FAIL)
- Final test execution and exit code verification
- PASS determination criteria
- FAIL determination and Ralph Loop (create fix tasks, increment iteration)
- Skip verification mode (--skip-verify)
- Reviewer agent (optional deep verification)
- Verification checklist

**Used by**:
- `ultrawork.md`: Full workflow includes verification
- `ultrawork-exec.md`: Execute-only workflow includes verification

---

## Benefits of Phase-Based Structure

### 1. Eliminated Duplication

**Before**: Exploration workflow was duplicated in ultrawork.md and ultrawork-plan.md
**After**: Single source in 01-explorer.md, both commands reference it

### 2. Progressive Disclosure

Commands show quick reference, link to detailed guides:

```markdown
## Exploration Phase

**Quick overview:**
- Stage 1: Overview via skill
- Stage 2: Analyze and plan
- Stage 3: Targeted exploration

📖 **Detailed guide**: See [Explorer Phase Reference](references/01-explorer.md)
```

### 3. Single Source of Truth

Updates only needed in one place. Example: If exploration logic changes, update 01-explorer.md, both commands automatically get the update.

### 4. Better Maintainability

Reference files can be updated independently without touching command files. Clear boundaries between "what to do" (command) and "how to do it" (reference).

### 5. Clearer Command Structure

Main command files focus on workflow and delegation, not implementation details.

---

## Usage Pattern in Commands

Commands follow this pattern:

```markdown
## Phase Name

**Brief description of what this phase does.**

📖 **Detailed guide**: See [Phase Reference](references/0N-phase.md)

**Quick reference:**
```bash
# Brief example
command --flag value
```
```

This provides:
- Immediate context for quick tasks
- Link to detailed documentation for complex scenarios
- Runnable examples for common cases

---

## When to Update

### Update Reference Files When:
- Exploration/planning/execution logic changes
- New patterns or best practices discovered
- Gate enforcement rules change
- Evidence requirements change
- TDD workflow updates

### Update Command Files When:
- Overall workflow changes (add/remove phases)
- Command arguments change
- Delegation rules change
- High-level orchestration logic changes

---

## File Maintenance

### Keep Files Under 200 Lines

Each phase file should be concise and focused. If a file grows too large, consider:
- Moving detailed examples to `skills/planning/references/`
- Creating sub-sections within the phase
- Splitting into smaller, more focused topics

### Include "Used by" Section

Every reference file starts with:

```markdown
# Phase Name Reference

**Used by**: `command1.md`, `command2.md`

**Purpose**: One-line description of what this phase does.
```

This makes it clear which commands depend on the reference.

### Link to Related References

When a reference depends on another, use relative links:

```markdown
📖 **Detailed guide**: See [Related Reference](../../skills/planning/references/file.md)
```

This creates a documentation graph that's easy to navigate.

---

## Verification Checklist

When creating or updating reference files:

- [ ] File name follows `0N-phase.md` pattern
- [ ] "Used by" section lists all dependent commands
- [ ] Purpose statement is clear and concise
- [ ] Content is self-contained but links to related docs
- [ ] Examples use actual script paths and commands
- [ ] File is under 200 lines (or has justification for being longer)
- [ ] Markdown headings use consistent structure
- [ ] Code blocks specify language (bash, python, json)
- [ ] All script paths use `${CLAUDE_PLUGIN_ROOT}` variable
