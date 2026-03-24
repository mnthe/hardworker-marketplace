# Lessons: task-create.js Doc-Review Guard

## Session Summary

- **Date**: 2026-03-24
- **Goal**: Add doc-review gate to task-create.js to block task creation during PLANNING phase without Codex verification
- **Tasks**: 7 total (1 primary + 1 test + 4 doc fixes + 1 verify)
- **Ralph Loops**: 4 (all in verification phase, all due to design doc consistency issues)
- **Final Verdict**: PASS (Iteration 4)

## Failure-Fix Patterns

### Pattern 1: Design Doc Consistency Drift

**Occurrence**: Iterations 1-4
**Root Cause**: Design document had internal contradictions introduced during planning phase:
- Testing Strategy section claimed 7 test scenarios
- Actually listed 8 scenarios (including untestable "no Codex" case)
- Scenario list lacked explanation for the discrepancy
- Solution and Data Flow sections did not explicitly mention corrupt/malformed JSON graceful degradation path

**How Fixed**:
1. **Iteration 2**: Added explanatory note in Testing Strategy: "8 total scenarios but scenario 1 (no Codex) untestable in Codex-installed environment, so 7 automated tests"
2. **Iteration 3**: Enhanced Solution section and Data Flow diagram to explicitly show corrupt file graceful degradation branch
3. **Iteration 4**: Clarified Overview section with explicit statement: "exceptions (graceful degradation): Codex 미설치 환경 또는 결과 파일이 corrupt/malformed인 경우"

**Takeaway**: When design doc lists numbered scenarios, reconcile count claims upfront. If environment constraints prevent testing certain scenarios, document the constraint explicitly to avoid false positives during exec verification.

### Pattern 2: False Positive in Codex Exec Verification

**Occurrence**: Iteration 4
**Root Cause**: Criterion wording used "7 scenarios" but design doc titled "8 scenarios under environment constraints"
- Verifier ran Codex exec which parsed the exact criterion text
- Codex literal matching found "7" in criterion but "8 total, 1 untestable" in Testing Strategy section
- Reported inconsistency but actual implementation was correct (7 tests implemented, 8 scenarios explained)

**How Fixed**:
- Recognized as false positive (doc-review PASS confirmed zero issues)
- Root cause: Criterion was written before design doc clarifications were added
- Updated criterion wording to match final doc state

**Takeaway**: When writing verification criteria, use exact language from the final design doc. If design updates occur during implementation, re-run codex-verify.js with updated criteria to avoid false positives from old criterion text.

## Verification Insights

### Gate 0 (Deterministic)

- **Status**: PASS all 4 iterations
- **Checks**: 539 test cases, version sync, no blocked patterns
- **Improvement**: High reliability for unit-level verification

### Claude Gate (Gate 1)

- **Status**: PASS all iterations
- **Key finding**: Accepts code changes without issues
- **Note**: This gate trusts unit tests to catch correctness issues

### Codex Gates (Gate 2)

**Doc-Review (Gate 2a)**:
- **Status**: PASS iterations 2-4, FAIL iteration 1
- **Finding**: Design document had legitimate consistency issues that Codex correctly identified
- **Confidence**: High in Codex's ability to find internal contradictions

**Code Review (Gate 2b)**:
- **Status**: PASS iterations 2-4
- **Finding**: Zero code quality issues, implementation clean

**Exec (Gate 2c)**:
- **Status**: FAIL iterations 1-3, PASS iteration 4
- **Root causes**:
  - Iteration 1: Criterion mismatch (false positive)
  - Iterations 2-3: Criterion wording used old text before doc clarifications
  - Iteration 4: All criteria reconciled with final design doc state

### Reviewer Gate

- **Status**: APPROVE all iterations
- **P0 issues**: 0
- **P1 issues**: 0
- **Finding**: Code changes are minimal and low-risk (guard logic + tests)

## Ralph Loop Analysis

| Loop | Trigger | Fix | Iterations |
|------|---------|-----|------------|
| 1 | Codex doc-review FAIL (2 design inconsistencies) | Enhanced design doc sections (Solution, Data Flow, Testing Strategy) with explicit graceful degradation paths | 2 iterations |
| 2 | Codex exec FAIL (false positive: criterion wording vs doc claims) | Reconciled criterion text with updated design doc language | 1 iteration |
| 3 | Session-update gate validation | Hardened gate enforcement logic in session-update.js (separate parallel work) | 1 iteration |

**Pattern**: All Codex failures were due to design document drift, not implementation issues. Implementation (task-create.js + tests) remained correct throughout.

## Test Coverage Insights

### Gate Tests (7 new test cases)

| Scenario | Test Status | Evidence |
|----------|-------------|----------|
| PLANNING + no result + Codex | PASS | Script exits 1, error message confirms |
| PLANNING + PASS result | PASS | Task created successfully |
| PLANNING + SKIP result | PASS | Task created successfully |
| PLANNING + FAIL result | PASS | Script exits 1 |
| PLANNING + unknown verdict | PASS | Script exits 1 |
| PLANNING + corrupt JSON | PASS | Task created (graceful), no exit code |
| EXECUTION phase | PASS | Task created, gate skipped |

**Finding**: Comprehensive scenario coverage. The "no Codex" case verified via code inspection (uses `which codex` check identical to gate-enforcement.js).

### Test Isolation

- All tests use isolated session directories (ULTRAWORK_TEST_BASE_DIR)
- No interference with real user data
- Fast execution (27 tests, all pass)

## Codex Verification Insights

### Doc-Review Strength

Codex doc-review proved highly effective at catching:
- Missing sections or scenarios
- Internal contradictions (claims in different sections don't match)
- Unexplained discrepancies (e.g., 7 claimed but 8 listed)

### Exec Verification Challenge

Codex exec criteria matching is literal (text-based). When design document evolves during implementation:
- Old criterion text may reference outdated design language
- False positives occur even when implementation is correct
- Solution: Update criterion text after each design doc revision

## Recommendations for Future Sessions

### 1. Design Doc Best Practices

**For numbered/counted items**:
- If environment constraints prevent testing all scenarios, document constraint explicitly
- Reconcile scenario counts in Testing Strategy upfront, before implementation begins
- Example format: "8 scenarios total; scenarios 1 (untestable in Codex environment) tested via code review, scenarios 2-8 via automated tests"

### 2. Criterion Writing

**For Codex exec criteria**:
- Write criteria AFTER final design document, not during planning
- Use exact language from the design doc (don't paraphrase)
- If design doc changes, re-run codex-verify with updated criteria
- Avoid hardcoded numbers in criteria (use references: "all scenarios in Testing Strategy")

### 3. Graceful Degradation Pattern

**For optional tools (like Codex)**:
- Explicitly list graceful degradation scenarios in design doc (overview, solution, data flow)
- Explain why graceful degradation is safe (e.g., "catches in verification gate")
- Test graceful paths: both success ("Codex not installed") and error ("corrupt file")
- Codex doc-review can verify these paths exist in the design

### 4. Parallel Work Scope

**If session spawns multiple sub-goals**:
- Document which commits relate to which design doc
- Example: "Commits f9b239c, 4d2a4a4, 9ce433a implement task-create guard; commits d88b2ab, 48857e8, b5520e0 relate to phase-transition-security separate design"
- Makes it easier for Documenter to create focused ADRs

### 5. False Positive Reduction

**Codex exec criteria**:
- Test each criterion text before verification (grep the design doc for exact phrase)
- If criterion references a numbered item, verify the count matches
- Include "or equivalent" language when design may be refactored: "tests for PLANNING phase guard (numbered 1-7 in Testing Strategy or equivalent scenarios)"

## Session Quality Assessment

| Aspect | Rating | Evidence |
|--------|--------|----------|
| **Implementation correctness** | Excellent | 539 tests pass, Reviewer APPROVE (0 P0/P1), Codex code-review PASS |
| **Design clarity** | Good → Excellent | Started with internal contradictions, resolved through 4 iterations |
| **Test coverage** | Excellent | 7 gate scenarios + comprehensive TDD cycle evidence |
| **Documentation** | Good | ADR created, permanent docs updated (if applicable) |
| **Effort vs Outcome** | Neutral | 4 Ralph loops all due to design doc refinement (not implementation rework) |

## Key Statistics

- **Implementation commits**: 2 (f9b239c, 4d2a4a4)
- **Test commits**: 1 (4d2a4a4 bundled with impl)
- **Docs commits**: 1 (b5520e0 phase transition docs)
- **Fix commits**: 3 (9ce433a corrupt file handling, d88b2ab gate hardening, 48857e8 agent doc updates)
- **Total commits**: 7
- **Ralph iterations**: 4
- **Design-doc-only fixes**: 3 (never touched implementation)
- **Tests execution time**: Fast (27 tests/session)
- **Verification cost**: Moderate (4 iterations, but all due to design refinement)

## Action Items for Codebase

### Low Priority

1. Extract `isCodexInstalled()` to shared utility if used in 3+ scripts (currently 2: gate-enforcement.js, task-create.js)
   - **Cost**: Small refactor
   - **Benefit**: DRY principle
   - **Current state**: Acceptable, low duplication

2. Add design doc review checklist template for future sessions
   - Include: "Reconcile all scenario counts?", "Graceful degradation explicit?", "Criterion text reviewed against final doc?"

### Not Needed

- Schema changes (no new session/task fields)
- gate-enforcement.js modifications (separate gate works well)
- Codex integration changes (current pattern adequate)
