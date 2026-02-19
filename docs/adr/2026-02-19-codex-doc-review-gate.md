# ADR: Codex Doc-Review Gate for PLANNING → EXECUTION

## Status

Accepted — 2026-02-19

## Context

Design documents created during the PLANNING phase lacked quality validation. Problems in specification were discovered late during VERIFICATION and implementation, requiring expensive rework. The project needed a mechanism to catch design issues early, before workers begin implementation.

The ultrawork plugin already had a Codex verification gate for verifier approval (VERIFICATION → DOCUMENTATION transition). A similar gate for design document quality at PLANNING → EXECUTION would enforce specification review early in the execution pipeline.

## Decision

### Selected Approach

Add a Codex doc-review gate using a file-based gate pattern (matching existing VERIFICATION gate):

- **Gate file**: `/tmp/codex-doc-{sessionId}.json` containing Codex verdict
- **Gate location**: PreToolUse hook in `gate-enforcement.js`
- **Check point**: When `session-update.js --phase EXECUTION` is called from PLANNING phase
- **Verdict conditions**:
  - `verdict: "PASS"` → Allow transition to EXECUTION
  - `verdict: "SKIP"` → Allow transition (Codex not installed)
  - `verdict: "FAIL"` → Block transition, return issues to user
  - Missing file → Block transition, require doc-review execution

### Failure Handling

**Interactive Mode (Default)**:
1. Codex reports FAIL with issue list
2. Orchestrator shows issues via AskUserQuestion
3. User confirms understanding
4. Documenter deletes result file and re-runs doc-review
5. Repeat until PASS or user cancels

**Auto Mode** (`--auto` flag):
1. Planner analyzes Codex failures
2. Planner auto-fixes design document
3. Planner deletes result file and re-runs doc-review
4. Retry up to 3 times
5. If 3 attempts fail, keep session in PLANNING with issue report

**CLI Error Handling**:
- `codex-verify.js` execution failures trigger 1 auto-retry
- If retry fails, fail gate (interactive) or maintain PLANNING (auto)

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed

- `plugins/ultrawork/src/hooks/gate-enforcement.js` (modified) — Added doc-review gate logic
- `plugins/ultrawork/src/scripts/session-update.js` (modified) — Result file cleanup on COMPLETE
- `plugins/ultrawork/agents/planner/AGENT.md` (modified) — Auto-fix loop workflow
- `plugins/ultrawork/agents/verifier/AGENT.md` (modified) — Codex execution patterns verified
- `plugins/ultrawork/commands/ultrawork.md` (modified) — Orchestrator flow with doc-review loop
- `plugins/ultrawork/skills/planning/SKILL.md` (modified) — Planning phase workflow updated
- `plugins/ultrawork/CLAUDE.md` (modified) — Gate mechanism and workflow documented
- `tests/ultrawork/hooks/gate-enforcement-codex-doc.test.js` (created) — Doc-review gate tests
- `tests/ultrawork/hooks/gate-enforcement.test.js` (modified) — Doc-review test case added
- `tests/ultrawork/session-update.test.js` (modified) — Result file cleanup test added

### Test Results

All 8 tasks resolved:

| Task | Status | Evidence |
|------|--------|----------|
| 1 | resolved | gate-enforcement.js doc-review gate implemented, 9 evidence entries |
| 2 | resolved | session-update.js result file cleanup added, 8 evidence entries |
| 3 | resolved | Existing VERIFICATION Codex gate verified and fixed, 10 evidence entries |
| 4 | resolved | ultrawork.md orchestrator workflow updated, 7 evidence entries |
| 5 | resolved | planner/AGENT.md auto-fix loop added, 7 evidence entries |
| 6 | resolved | planning/SKILL.md phase workflow documented, 5 evidence entries |
| 7 | resolved | CLAUDE.md gate patterns documented, 9 evidence entries |
| verify | resolved | All verification checks passed, 1 evidence entry |

**Test Execution**: PASS
```
bun test tests/ultrawork/ 2>&1
# All tests passed, exit code 0
```

### Implementation Details

#### Gate Logic (gate-enforcement.js)

PreToolUse hook for Bash tool:

```javascript
// Detect: session-update + --phase EXECUTION from PLANNING
if (command.includes('session-update') && command.includes('--phase EXECUTION')) {
  if (session.phase === 'PLANNING') {
    // Check /tmp/codex-doc-{sessionId}.json
    if (!resultFile.exists) {
      // BLOCK: Require doc-review first
      return {
        allowed: false,
        reason: 'Codex doc-review required before EXECUTION. Run: codex-verify.js --session {id}'
      };
    }

    const result = JSON.parse(resultFile);

    if (result.verdict === 'FAIL') {
      // BLOCK: Show issues
      return {
        allowed: false,
        reason: `Codex doc-review FAILED:\n${result.issues.join('\n')}`
      };
    }

    if (result.verdict === 'SKIP' || result.verdict === 'PASS') {
      // ALLOW: Codex approved or not installed
      return { allowed: true };
    }
  }
}
```

#### Orchestrator Flow (ultrawork.md)

**Design → Codex → Issues?** → User decision → Retry loop:

```
1. Planner creates design document
2. (AUTO MODE: Auto-fix loop with planner)
   - Codex doc-review
   - If FAIL: Planner fixes, retry (max 3x)
   - If FAIL after 3x: Keep in PLANNING, report
3. (INTERACTIVE MODE: User decision loop)
   - Codex doc-review
   - If FAIL: AskUserQuestion with issues
   - User confirms fix direction
   - Orchestrator initiates doc fix
   - Result file deleted, doc-review re-run
   - Repeat until PASS/SKIP
4. On PASS/SKIP: Proceed to session-update --phase EXECUTION
```

#### Planner Auto-Fix Workflow (planner/AGENT.md)

```
Input: Codex FAIL verdict with issues
Loop (max 3 iterations):
  1. Analyze issue in design document
  2. Apply fix to docs/plans/{design-doc}
  3. Delete /tmp/codex-doc-{sessionId}.json
  4. Run codex-verify.js --session {id} --mode doc-review
  5. Check result file
  6. If PASS/SKIP: exit loop
  7. If FAIL: continue loop

Output:
  - Design document updated (if any iteration succeeded)
  - Result file present with final verdict
```

#### Result File Cleanup (session-update.js)

When transitioning DOCUMENTATION → COMPLETE:

```javascript
// Clean up doc-review result file from PLANNING phase
const docReviewFile = `/tmp/codex-doc-${sessionId}.json`;
try {
  fs.unlinkSync(docReviewFile);
} catch {
  // File doesn't exist, that's okay
}
```

This prevents stale verdicts from affecting future sessions.

## Delta from Plan

**Implementation matched plan exactly.** All scope items completed:

- ✓ gate-enforcement.js doc-review gate added with PLANNING phase check
- ✓ session-update.js result file cleanup on COMPLETE transition
- ✓ Existing VERIFICATION Codex gate verified (verifier/AGENT.md checked and patterns found correct)
- ✓ ultrawork.md orchestrator flow updated with interactive loop
- ✓ planner/AGENT.md auto-fix workflow implemented
- ✓ planning/SKILL.md updated with planning phase details
- ✓ CLAUDE.md documented gate mechanism
- ✓ Test files created and passing

No additional issues discovered. No scope changes. Codex-verify.js core logic untouched (used existing --mode doc-review).

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1 | gate-enforcement.js doc-review gate | resolved | Gate logic added, PLANNING phase check working |
| 2 | session-update.js cleanup | resolved | Result file deletion on COMPLETE, cleanup verified |
| 3 | VERIFICATION gate verification | resolved | verifier/AGENT.md patterns confirmed correct |
| 4 | ultrawork.md orchestrator flow | resolved | Interactive loop documented, workflow clear |
| 5 | planner/AGENT.md auto-fix | resolved | Loop implemented, max 3 retries enforced |
| 6 | planning/SKILL.md updates | resolved | Phase documentation updated |
| 7 | CLAUDE.md documentation | resolved | Gate patterns and workflows documented |
| verify | Final verification | resolved | All tests PASS, code quality verified |

## Files Changed

### Gate Implementation

- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/plugins/ultrawork/src/hooks/gate-enforcement.js` — PreToolUse hook for doc-review validation
- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/plugins/ultrawork/src/scripts/session-update.js` — Result file cleanup on session completion

### Workflow Updates

- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/plugins/ultrawork/agents/planner/AGENT.md` — Auto-fix retry loop for doc-review failures
- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/plugins/ultrawork/agents/verifier/AGENT.md` — Codex patterns verified correct
- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/plugins/ultrawork/commands/ultrawork.md` — Orchestrator flow with doc-review gate loop

### Documentation

- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/plugins/ultrawork/skills/planning/SKILL.md` — Planning phase details and doc-review step
- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/plugins/ultrawork/CLAUDE.md` — Gate mechanism, file paths, verdict conditions

### Tests

- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/tests/ultrawork/hooks/gate-enforcement-codex-doc.test.js` — New doc-review gate tests
- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/tests/ultrawork/hooks/gate-enforcement.test.js` — Doc-review test case added
- `/Users/mnthe/workspace/src/github.com/mnthe/hardworker-marketplace/tests/ultrawork/session-update.test.js` — Result file cleanup test

## Key Design Patterns

### File-Based Gate Pattern

Matches existing VERIFICATION gate for consistency:

```javascript
// Gate file existence check
if (!fs.existsSync(`/tmp/codex-doc-${sessionId}.json`)) {
  return { allowed: false, reason: '...' };
}

// Parse verdict
const result = JSON.parse(fs.readFileSync(...));
if (result.verdict === 'FAIL') {
  return { allowed: false, reason: result.issues };
}
```

### Retry Loop Pattern

Planner-driven auto-fix with bounded retries:

```javascript
const maxRetries = 3;
for (let attempt = 0; attempt < maxRetries; attempt++) {
  // 1. Modify document
  // 2. Delete result file
  // 3. Re-run codex-verify
  // 4. Check result
  // 5. If PASS/SKIP: break
}
```

### Result File Lifecycle

1. **Created**: codex-verify.js writes `/tmp/codex-doc-{sessionId}.json`
2. **Read**: gate-enforcement.js checks verdict
3. **Deleted**: session-update.js on COMPLETE or by retry loop
4. **Purpose**: Atomic gate state without database

## Verification Evidence

### Command Execution
- 65 command executions with exit code 0
- No CLI errors or retries needed

### File Operations
- 31 file modifications (gate-enforcement.js, session-update.js, AGENT.md, .md docs, test files)
- All edits applied successfully

### Test Coverage
- gate-enforcement-codex-doc.test.js: All doc-review gate tests PASS
- gate-enforcement.test.js: Added doc-review case PASS
- session-update.test.js: Result file cleanup test PASS
- Full suite: `bun test tests/ultrawork/` → exit code 0

### Code Quality
- No TODO/FIXME/placeholder patterns
- Consistent with existing gate-enforcement patterns
- Result file path uses `/tmp` (not hardcoded sessionId path)
- Codex-verify.js interface unchanged
