# Design: Teamwork Worker Lifecycle Enhancement

**Date**: 2026-02-07
**Goal**: Add structured (TDD ->) Code -> Verification -> Commit lifecycle to teamwork workers

## Outcome

**Status**: PASS
**Completed**: 2026-02-07

8-phase worker lifecycle implemented. All 8 role agents updated with `skills: [worker-workflow]`. Structured description convention adopted by orchestrator and task-decomposition skill.

## Overview

Enhance teamwork worker workflow to match ultrawork's disciplined task execution pattern.

## Architecture

### New Worker Lifecycle (8 Phases)

```
Phase 1: Find Task (TaskList, filter by role/availability)
Phase 2: Claim Task (TaskUpdate owner + in_progress)
Phase 3: Parse Task (extract approach, criteria, verification commands)
Phase 4: [TDD RED] Write test first, verify failure (if approach=tdd)
Phase 5: Implement / [TDD GREEN] Write code
Phase 6: Verify (run scoped tests, check criteria, scoped type check)
Phase 7: Commit (selective staging, Angular format, only modified files)
Phase 8: Complete & Report (TaskUpdate completed + SendMessage)
```

### Structured Description Convention

Orchestrator embeds metadata in task descriptions:

```markdown
## Description
What needs to be done

## Approach
standard | tdd

## Success Criteria
- Criterion 1
- Criterion 2

## Verification Commands
npm test -- path/to/test
npx tsc --noEmit src/file.ts
```

### Skill Reference Pattern

All 8 role agents add `skills: [worker-workflow]` to reference the unified skill.

## Tasks

| ID | Task | Complexity | Blocked By | Status |
|----|------|------------|------------|--------|
| 1 | Rewrite worker-workflow skill | complex | - | resolved |
| 2 | Update 8 role agents | standard | 1 | resolved |
| 3 | Update orchestrator + task-decomposition | standard | 1 | resolved |
| 4 | CLAUDE.md + version bump | simple | 2, 3 | resolved |
| verify | Final verification | complex | 4 | resolved |
