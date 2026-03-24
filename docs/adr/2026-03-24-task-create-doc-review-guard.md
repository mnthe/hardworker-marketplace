# ADR: Add Doc-Review Guard to task-create.js

## Status

Accepted — 2026-03-24

## Context

During PLANNING phase in `--auto` mode, task creation (`task-create.js`) could proceed without verifying that Codex doc-review had passed. This bypassed the doc-review gate, allowing tasks to be created from a potentially unreviewed design document.

The doc-review gate existed in `gate-enforcement.js` (blocking `session-update --phase EXECUTION`) but did not cover the task creation pathway, creating a gap in verification flow.

## Decision

Add a `checkDocReviewGate()` function directly into `task-create.js` that blocks task creation during PLANNING phase unless Codex doc-review has completed with PASS or SKIP verdict.

### Rationale

1. **Script-level enforcement**: Placing the guard inside task-create ensures ALL task creation calls respect the gate, regardless of invocation path (direct CLI, subagent, hook).

2. **Graceful degradation**: Codex CLI is optional. When Codex is not installed or result file is corrupt/malformed, the gate gracefully allows task creation (consistent with existing `gate-enforcement.js` pattern).

3. **Minimal scope**: Guard logic is self-contained in task-create.js; no schema changes, no modifications to existing gate-enforcement.js or session state format.

## Outcome

**Verification**: PASS (Iteration 4)
**Ralph Loops**: 4 (3 doc-consistency fixes in design doc, 1 gate validation hardening in session-update.js)

### Files Changed

- `plugins/ultrawork/src/scripts/task-create.js` — Added `isCodexInstalled()` and `checkDocReviewGate()` functions (63 lines added)
- `tests/ultrawork/task-create.test.js` — Added 7 gate test cases covering PLANNING phase scenarios (114 lines added)
- `plugins/ultrawork/.claude-plugin/plugin.json` — Bumped version to 1.11.0
- `.claude-plugin/marketplace.json` — Bumped version to 1.11.0

### Test Results

- `bun test tests/ultrawork/task-create.test.js`: **27 pass, 0 fail, exit 0**
- All 7 gate test cases PASS:
  1. PLANNING + no result + Codex installed → exit 1 (PASS)
  2. PLANNING + PASS result → task created (PASS)
  3. PLANNING + SKIP result → task created (PASS)
  4. PLANNING + FAIL result → exit 1 (PASS)
  5. PLANNING + unknown verdict → exit 1 (PASS)
  6. PLANNING + corrupt result file → task created, graceful degradation (PASS)
  7. EXECUTION phase → gate skipped, task created (PASS)

### Implementation Details

#### Guard Logic

```javascript
function checkDocReviewGate(sessionId) {
  let session;
  try {
    session = readSession(sessionId);
  } catch {
    return; // Session not found - skip gate
  }

  if (session.phase !== 'PLANNING') {
    return; // Gate only applies during PLANNING phase
  }

  const resultPath = `/tmp/codex-doc-${sessionId}.json`;

  if (!fs.existsSync(resultPath)) {
    if (!isCodexInstalled()) {
      return; // Graceful degradation: Codex not installed
    }
    console.error('Error: Codex doc-review must pass before creating tasks during PLANNING phase.');
    process.exit(1);
  }

  try {
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
    if (result.verdict === 'PASS' || result.verdict === 'SKIP') {
      return; // Gate passed
    }
  } catch {
    return; // Corrupt file - graceful degradation
  }

  console.error('Error: Codex doc-review returned FAIL.');
  process.exit(1);
}
```

**Guard invoked at**: Line 208 in `createTask()` function, before any task creation logic

#### Codex Detection

Uses `which codex` CLI check (same pattern as existing `gate-enforcement.js`):
- If Codex installed and no result file → block
- If Codex not installed → allow (graceful degradation)
- Handles both macOS (homebrew, /opt/homebrew/bin/codex) and standard PATH

## Trade-offs

| Aspect | Decision | Trade-off |
|--------|----------|-----------|
| Guard location | Inside task-create.js | Duplicates `isCodexInstalled()` from gate-enforcement.js, but avoids fragile hook-based parsing |
| Degradation | Allow when Codex missing/corrupt | Accepts risk that --auto mode may skip doc-review if Codex crashes, mitigated by review gate in verification phase |
| Scope | PLANNING phase only | Does not guard EXECUTION phase task creation (allowed by design) |

## Verification Gates

- **Claude Gate 0**: 539 tests pass, no blocked patterns
- **Claude Gate**: PASS (0 issues)
- **Codex Code Review**: PASS (0 issues)
- **Codex Exec**: Doc-review result file confirmed PASS in final iteration

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1 | task-create.js doc-review guard implementation | resolved | checkDocReviewGate() function added, PLANNING phase check, graceful degradation for Codex absent |
| 2 | task-create.test.js test cases | resolved | 7 gate tests added, all PASS (scenarios: no result+Codex, PASS verdict, SKIP verdict, FAIL verdict, unknown verdict, corrupt file, EXECUTION phase) |
| 3 | Design doc fix: missing test scenarios and JSON handling | resolved | Testing Strategy expanded to 7 scenarios, pseudocode try-catch added, design-code consistency verified |
| 4 | Design doc fix: corrupt JSON path coverage | resolved | Solution section clarified graceful degradation, Data Flow shows parse error branch, Testing Strategy includes corrupt file scenario |
| 5 | Design doc fix: Codex doc-review consistency | resolved | Overview clarified blocking + exceptions, Modified Files reconciled counts with explanatory note |
| 6 | Fix: Codex exec criteria stale criterion | resolved | False positive: Codex doc-review PASS confirmed, criterion 5 stale (7 vs 8 scenarios due to untestable "no Codex" case in Codex-installed environment) |
| verify | Verification phase (gate 0 + gates + ralph loops) | resolved | 4 Ralph loops: 3 design doc fixes, 1 session-update gate validation hardening. Final verification: PASS |

## Delta from Plan

**Design document pre-implementation**: Identified 8 test scenarios but noted scenario 1 (no Codex) untestable in Codex-installed environment → 7 automated tests + code review for scenario 1.

**Session scope expansion**: Session also completed related work on phase transition security (session-update.js hardening), resulting in 7 commits total. Only commits f9b239c, 4d2a4a4, 9ce433a directly relate to task-create doc-review guard design.

**Ralph Loop causes**:
- Iteration 1-2: Codex doc-review found 2 consistency errors (corrupt JSON path missing from Solution/DataFlow sections, test count mismatch — 6 tests claimed vs 8 scenarios)
- Iteration 2-3: Added missing graceful degradation path and expanded Testing Strategy
- Iteration 3-4: Resolved false positive (criterion wording used "7 scenarios" but design doc lists 8 to account for untestable "no Codex" case)

All fixes were to the design document itself, not the implementation. Implementation remained correct throughout.
