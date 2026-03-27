# ADR: Rewrite Doc-Review Verification to Focus on Structural Accuracy

## Status

Accepted — 2026-03-27

## Context

The ultrawork plugin's Codex-based doc-review verification was enforcing "exact section name matching" (e.g., "Overview", "Approach/Decisions", "Architecture", "Testing Strategy", "Scope") during design document validation. This led to repeated FAIL verdicts on trivial formatting differences:

- Heading numbering mismatches (e.g., `## 2. Scope` vs `## Scope`)
- Scope section omission (when boundaries are documented elsewhere)
- Phase count mismatches (e.g., "5 phases planned but only Phase 1-4 defined")
- Bold formatting vs heading markup inconsistencies

These surface-level issues caused verification to loop 3+ times, wasting iteration budget and attention on noise rather than substantive problems:
- Invalid file references (code-level drift)
- Incorrect dependency graphs
- Unverifiable or contradictory success criteria
- Missing content that blocks implementation

The same exact-section-name rule was replicated across 4 files (`codex-verify.js`, `verifier/AGENT.md`, `05-validate.md`, `02-planning.md`), creating redundancy and making changes difficult.

## Decision

Rewrite `buildDocReviewPrompt()` criterion 1 from "Section Completeness" (heading-focused) to **Structural Accuracy** (content-focused). The new criterion explicitly ignores formatting details and checks for 6 mandatory **content areas**:

1. Problem/current-state/goal description
2. Chosen approach and key decisions (with rationale)
3. Affected files/components/consumers with impact description
4. Scope boundaries (explicit in/out distinction)
5. Executable verification criteria (commands, assertions)
6. Dependency/data-flow relationships

**Category wire value preserved**: Keep `category: "completeness"` in JSON output (no schema change).

**Explicit ignore list**: Added to prompt text to prevent LLM drift:
```
IGNORE: heading names/numbering/depth, bold-vs-heading, section order,
phase/task count differences — unless they hide missing content.
REPORT: invalid file references, impossible dependencies, missing
verification commands, contradictory decisions/scope, unverifiable criteria.
```

**Sync guide documents**: Updated 4 guide files (`planner/AGENT.md`, `verifier/AGENT.md`, `05-validate.md`, `02-planning.md`) to replace exact-name lists with content-area based checks.

**Export for testability**: Added `buildDocReviewPrompt` to module.exports so unit tests can verify the prompt directly (no LLM needed).

## Outcome

**Verification**: PASS
**Iterations**: 1 (all tasks resolved first attempt)

### Files Changed
- `plugins/ultrawork/src/scripts/codex-verify.js` (core prompt rewrite + export)
- `plugins/ultrawork/agents/planner/AGENT.md` (Common fix patterns rewrite)
- `plugins/ultrawork/agents/verifier/AGENT.md` (Section check rewrite)
- `plugins/ultrawork/commands/references/05-validate.md` (Section check rewrite)
- `plugins/ultrawork/commands/references/02-planning.md` (Required sections rewrite)
- `tests/ultrawork/codex-verify.test.js` (Unit tests for buildDocReviewPrompt)
- `plugins/ultrawork/.claude-plugin/plugin.json` (version bump: 1.12.0 → 1.13.0)
- `.claude-plugin/marketplace.json` (version sync: 1.12.0 → 1.13.0)

### Test Results
- `bun test tests/ultrawork/codex-verify.test.js`: PASS (exit 0)
- Grep verification criteria: All passing
  - "Section Completeness" not present (0 matches)
  - "Structural Accuracy" present (1+ matches)
  - IGNORE block present (1+ matches)
  - buildDocReviewPrompt exported

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1  | Rewrite buildDocReviewPrompt criterion 1 and add export | resolved | Updated prompt text from "Section Completeness" to "Structural Accuracy"; added IGNORE/REPORT guidance; exported function for testing |
| 2  | Sync guide documents: remove exact section-name checks | resolved | Updated planner, verifier, and command reference docs to use content-area based checks instead of exact heading names |
| 3  | Add unit tests for buildDocReviewPrompt | resolved | Added 76 lines of test code with 7 test cases covering prompt structure, keyword presence, and mandatory content areas |
| 4  | Fix: Missing version bump for ultrawork plugin | resolved | Bumped plugin.json to 1.13.0 and synced marketplace.json |
| verify | [VERIFY] Final verification | resolved | All criteria met; tests pass; grep validations pass |

## Delta from Plan

Implementation matched plan exactly. No deviations or scope creep observed.

All 4 main tasks (prompt rewrite, guide sync, test coverage, version bump) completed as designed with no design-to-implementation misalignment.

## Impact on Verification Behavior

### Before

```
Design Document → Exact section check → FAIL (heading format) → Planner fixes format → Re-review → FAIL again (different issue) → 3+ loops
```

### After

```
Design Document → Content area check → FAIL (missing dependency graph) → Planner adds content → Re-review → PASS
```

The new criterion reduces noise significantly by:
- Accepting multiple valid heading structures (as long as content exists)
- Ignoring cosmetic issues (numbering, bold vs heading)
- Focusing strictly on content needed for implementation/verification
- Flagging only materially missing content or impossible dependencies

## Technical Details

### Prompt Text Changes

**Old criterion 1:**
```
1. **Section Completeness**: Design document must include the following sections with exact names...
   [lists: Overview, Approach/Decisions, Architecture, Testing Strategy, Scope]
```

**New criterion 1:**
```
1. **Structural Accuracy**: Report an error ONLY when content needed to implement
or verify the change is missing or wrong. Mandatory content areas:
  (1) problem/current-state/goal
  (2) chosen approach and key decisions
  (3) affected files/components/consumers with impact
  (4) scope boundaries
  (5) executable verification criteria
  (6) dependency/data-flow relationships

   IGNORE: heading names/numbering/depth, bold-vs-heading, section order,
   phase/task count differences — unless they hide missing content.

   REPORT: invalid file references, impossible dependencies, missing
   verification commands, contradictory decisions/scope, unverifiable criteria.
```

### Common Fix Patterns Updates

**Planner agent** (AGENT.md, lines 234-237, 246-249):
- "Missing criterion details" → "Verification criteria lack executable commands"
- "Scope not clearly bounded" → "Scope boundaries unclear (no in/out distinction)"
- "Consumer impact unclear" and "No verification strategy" unchanged

**Verifier, validate, planning docs:**
- Removed exact section name lists
- Replaced with content-area language

### Unit Test Coverage

**File**: `tests/ultrawork/codex-verify.test.js`, new test block (7 tests):
```javascript
describe('buildDocReviewPrompt', () => {
  test('should include Structural Accuracy criterion', ...);
  test('should exclude Section Completeness text', ...);
  test('should include IGNORE block', ...);
  test('should include REPORT block', ...);
  test('should reference mandatory content areas', ...);
  test('should output valid JSON format', ...);
  test('should work with goal parameter', ...);
});
```

## Version Bump Rationale

- **From**: 1.12.0
- **To**: 1.13.0
- **Reason**: Behavior change (verification criterion redefined, doc-review messages changed). Qualifies as minor version bump under semantic versioning (backward compatible API, changed behavior).
