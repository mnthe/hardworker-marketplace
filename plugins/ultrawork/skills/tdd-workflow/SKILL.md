---
name: tdd-workflow
description: |
  Test-Driven Development (TDD) workflow for ultrawork tasks with approach: "tdd".
  Enforces RED-GREEN-REFACTOR cycle with gate hooks and evidence requirements.
  Required knowledge for worker agents implementing TDD tasks.
---

# TDD Workflow

Test-Driven Development (TDD) workflow for tasks marked with `approach: "tdd"`.

**CRITICAL: TDD tasks MUST follow this exact sequence. Gate hooks will block out-of-order operations.**

---

## TDD Phase 1: RED - Write Failing Test

1. **Create test file FIRST** (before any implementation code)
2. Write test for expected behavior
3. Run test and **VERIFY IT FAILS**

```bash
# Record test creation
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --id {TASK_ID} \
  --add-evidence "TDD-RED: Created test file tests/validateUser.test.ts"

# Run test - MUST FAIL
npm test -- tests/validateUser.test.ts

# Record failure (expected)
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --id {TASK_ID} \
  --add-evidence "TDD-RED: Test fails as expected (exit code 1)"
```

**Evidence Required:**
- Test file path created
- Test execution output showing failure
- Exit code 1 (expected)

---

## TDD Phase 2: GREEN - Minimal Implementation

1. Write **MINIMAL** code to make the test pass
2. Do NOT add extra functionality beyond what test requires
3. Run test and **VERIFY IT PASSES**

```bash
# Record implementation
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --id {TASK_ID} \
  --add-evidence "TDD-GREEN: Implemented src/validateUser.ts"

# Run test - MUST PASS
npm test -- tests/validateUser.test.ts

# Record success
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --id {TASK_ID} \
  --add-evidence "TDD-GREEN: Test passes (exit code 0)"
```

**Evidence Required:**
- Implementation file path
- Test execution output showing pass
- Exit code 0

---

## TDD Phase 3: REFACTOR (Optional)

1. Improve code quality (naming, structure, performance)
2. Run tests again to ensure they still pass
3. Record any refactoring done

```bash
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --id {TASK_ID} \
  --add-evidence "TDD-REFACTOR: Renamed variables for clarity, tests still pass"
```

---

## TDD Evidence Chain

A complete TDD task MUST have this evidence sequence:

```
1. TDD-RED: Test file created
2. TDD-RED: Test execution failed (exit code 1)
3. TDD-GREEN: Implementation created
4. TDD-GREEN: Test execution passed (exit code 0)
5. (Optional) TDD-REFACTOR: Improvements made, tests still pass
```

**Verification will FAIL if:**
- Implementation evidence appears before TDD-RED evidence
- Missing TDD-RED or TDD-GREEN evidence
- Test never failed (suggests code-first, not test-first)

---

## Gate Enforcement

The `gate-enforcement.js` hook blocks out-of-order TDD operations:

**During EXECUTION phase (TDD tasks only):**
- ✅ Allow: Test files first (`*.test.*`, `*.spec.*`, `__tests__/*`)
- ❌ Block: Implementation files before TDD-RED evidence

**Detection Logic:**
1. Hook reads task file to check `approach: "tdd"`
2. Searches evidence array for "TDD-RED" prefix
3. If TDD task + no RED evidence → blocks Write/Edit on non-test files

**Error Message:**
```
TDD gate: Cannot write implementation before RED phase
Required evidence: "TDD-RED: Test fails as expected (exit code 1)"
Current file: src/validateUser.ts (non-test file)
```

---

## TDD Task Completion

After all phases complete:

```bash
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --id {TASK_ID} \
  --status resolved \
  --add-evidence "TDD complete: RED→GREEN→REFACTOR cycle finished"
```

---

## Quick Reference

| Phase | Action | Evidence Prefix | Exit Code |
|-------|--------|----------------|-----------|
| RED | Write test, verify failure | `TDD-RED: ...` | 1 (fail) |
| GREEN | Write minimal impl, verify pass | `TDD-GREEN: ...` | 0 (pass) |
| REFACTOR | Improve code, tests still pass | `TDD-REFACTOR: ...` | 0 (pass) |

---

## Example Evidence Sequence

```json
{
  "evidence": [
    "TDD-RED: Created test file tests/auth.test.ts",
    "TDD-RED: Test fails as expected (exit code 1)",
    "TDD-GREEN: Implemented src/auth.ts",
    "TDD-GREEN: Test passes (exit code 0)",
    "TDD-REFACTOR: Extracted helper function, tests still pass"
  ]
}
```
