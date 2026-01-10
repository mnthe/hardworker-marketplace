# Task Decomposition Guide

## Decomposition Principles

### 1. Single Responsibility
Each task does ONE thing well.

```
❌ BAD: "Implement auth system"
✅ GOOD:
  - "Create user model with password hashing"
  - "Implement JWT token generation"
  - "Create login endpoint"
  - "Create signup endpoint"
  - "Add auth middleware"
```

### 2. Testable Boundaries
Each task has clear success criteria.

```
❌ BAD: "Make it work better"
✅ GOOD: "Response time < 200ms for /api/users endpoint"
```

### 3. Minimal Dependencies
Maximize what can run in parallel.

```
❌ BAD: A → B → C → D → E (serial)
✅ GOOD:
    A ──┬── C ──┬── E
        │       │
    B ──┘   D ──┘
```

## Task Sizing

| Size | Scope | Example |
|------|-------|---------|
| Small | 1-2 files, < 50 lines | Add validation to form |
| Medium | 2-5 files, 50-200 lines | New API endpoint |
| Large | 5+ files, 200+ lines | **Split into smaller** |

**Rule:** If a task feels "large", it probably needs decomposition.

## Common Decomposition Patterns

### Feature Implementation
```
1. [Setup] Create file structure / boilerplate
2. [Core] Implement main logic
3. [API] Create endpoints/interfaces
4. [Test] Write tests
5. [Integration] Wire everything together
```

### Bug Fix
```
1. [Reproduce] Create failing test
2. [Fix] Implement fix
3. [Verify] Ensure test passes
4. [Regression] Check related functionality
```

### Refactoring
```
1. [Test] Ensure existing tests cover behavior
2. [Refactor] Make structural changes
3. [Verify] All tests still pass
4. [Cleanup] Remove dead code
```

## Success Criteria Examples

| Task Type | Good Criteria |
|-----------|---------------|
| API endpoint | Returns 200 with expected schema |
| Database | Migration runs, queries work |
| UI component | Renders without errors, handles states |
| Performance | Benchmark shows X improvement |
| Security | Passes security scan, no vulnerabilities |

## Anti-Patterns

### Too Vague
```
❌ "Improve performance"
✅ "Reduce /api/search response time from 2s to <500ms"
```

### Too Coupled
```
❌ "Implement feature X and also handle edge case Y"
✅ Task 1: "Implement feature X"
   Task 2: "Handle edge case Y" (blocked by Task 1)
```

### Hidden Dependencies
```
❌ Task A and B both modify same file (conflict risk)
✅ Task A modifies file, Task B blocked by A
```
