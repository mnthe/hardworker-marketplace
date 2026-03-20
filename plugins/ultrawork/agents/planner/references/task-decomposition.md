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

## Verification Strategy Criteria Extraction

Task criteria MUST be derived from the design document's Verification Strategy table, not invented ad-hoc.

### Process

1. Design doc defines a Verification Strategy table with rows like `V1`, `V2`, ..., `VN`
2. Each V-row specifies: ID, target deliverable, verification command, expected output
3. When decomposing into tasks, map V-rows to the task whose deliverable they verify
4. Worker receives criteria that already contain the command + expected output

### Example

Design doc Verification Strategy:

| ID  | Target             | Command                          | Expected        |
|-----|--------------------|----------------------------------|-----------------|
| V1  | auth middleware     | `test -f src/middleware/auth.ts`  | exit code 0     |
| V2  | auth middleware     | `bun test tests/auth.test.ts`    | 3/3 PASS        |
| V3  | app wiring         | `grep -c 'authMiddleware' src/app.ts` | >= 1       |

Task 1 (auth middleware) receives criteria:
```
- V1: test -f src/middleware/auth.ts exit code 0
- V2: bun test tests/auth.test.ts 3/3 PASS
```

Task 2 (app wiring) receives criteria:
```
- V3: grep -c 'authMiddleware' src/app.ts >= 1
```

### Why This Matters

- **Traceability**: Every criterion traces back to a V-row in the design doc
- **Determinism**: Workers know the exact command to run for verification
- **No ambiguity**: No subjective criteria like "works correctly"

## File Classification

Each task MUST categorize its files into three groups:

- **Create**: New files to be created (exact path)
- **Modify**: Existing files to be changed (exact path, optionally line range)
- **Test**: Test files associated with the task (exact path)

### Format

```
Files:
- Create: src/middleware/auth.ts
- Modify: src/app.ts:45-60
- Test: tests/auth.test.ts
```

### Rules

1. Every Create / Modify / Test path must be absolute relative to project root
2. Line ranges on Modify are optional but recommended for surgical changes
3. Test files should map 1:1 to the Create/Modify deliverable
4. Two tasks MUST NOT have overlapping Create or Modify paths (conflict prevention)

### Example Task with File Classification

```
Task 1: Create auth middleware
Files:
- Create: src/middleware/auth.ts
- Create: src/types/auth.ts
- Modify: src/app.ts:12-15
- Test: tests/middleware/auth.test.ts
```

## Worker Criteria Format Rules

Every success criterion given to a worker MUST match one of these verifiable patterns:

| Pattern | Verification Command |
|---------|---------------------|
| `파일 {path} 존재` | `test -f {path}` |
| `{command} 실행 시 exit code 0` | Run `{command}`, check exit code |
| `{pattern} grep 결과 {N}건` | `grep -c "{pattern}" {file}` |
| `{test suite} PASS, {N}/{N} assertions` | Run test suite, check output |

### Banned Criteria

The following vague criteria are **banned** and must never appear:

- "기능 동일" (functionality unchanged)
- "정상 동작" (works normally)
- "코드 정리" (code cleanup)

These are not verifiable by a machine command and will cause verification failure.

### Why Strict Format?

- Workers can mechanically verify each criterion with a single command
- Verifier can re-run the exact same command to confirm
- No interpretation needed: PASS or FAIL is unambiguous

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
