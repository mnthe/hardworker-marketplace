# ADR: Doc-Review Convergence Control + Prompt Redesign

## Status

Accepted — 2026-03-28

## Context

Ultrawork's LLM-based design document review (Codex gate) produces non-deterministic failures that prevent task creation:

**Case 1**: pubg-stream-launcher — 8+ review iterations, error count oscillated (7→4→7→4→7), eventually user manually skipped. Cost: $21+, time: 11 hours.

**Case 2**: ai-reviewer codebase — 22 iterations to first PASS. Re-run on same document produced 2 new errors (LLM non-determinism). Task creation blocked by stale FAIL verdict.

Root causes:

1. **No convergence mechanism**: Auto mode tracks per-attempt issues but does not detect oscillating/diverging error counts. Interactive mode has infinite retry loop with no limit.

2. **Review scope creep**: The "Structural Accuracy" criterion asks Codex to verify "invalid file references, impossible dependencies, missing verification commands" — implementation-level details that force the LLM to check tool permissions, JSON field names, test file internals. This expands review surface and triggers new issues on each fix (Hydra effect).

## Decision

Two-pronged fix:

### 1. Prompt Redesign (Root Cause Fix)

Rewrote `buildDocReviewPrompt()` in `codex-verify.js` with three alignment-based criteria:

- **Context Sufficiency**: Can an AI worker implement each task using ONLY this document + referenced source files? Report missing context that forces undocumented decisions. IGNORE tool permissions, JSON field names, test internals.

- **Goal-Result Alignment**: Does the document define a clear path from Goal → concrete Results? Check: problem statement connects to approach, approach connects to changed files, changed files connect to verification criteria.

- **Blocked Patterns**: Find TODO, TBD, FIXME, placeholder, empty sections, vague statements ("should work", "probably", "maybe").

Removed "Structural Accuracy" (scope creep), "Internal Consistency" (subsumed by alignment), "Quality" (vague catch-all).

### 2. Convergence Control (Safety Net)

Added retry budget, convergence detection, and auto-pass fallback:

- **Retry Budget**: 5 retries for interactive mode, 3 for auto mode
- **Convergence Detection**: Track error counts across attempts. Detect converging (trend toward 0), oscillating (no progress), or diverging (increasing errors).
- **Auto-Pass Fallback**: After max retries without convergence, downgrade remaining errors to warnings and set verdict to PASS. The gate allows, and remaining issues are appended to the design document for worker visibility.

### 3. Auto-Pass Script

Created `codex-autopass.js` that:
- Reads the existing FAIL result from `/tmp/codex-doc-{sessionId}.json`
- Changes `verdict` from `FAIL` to `PASS`
- Downgrades error-severity issues to warnings with `[auto-pass]` prefix
- Writes back to same file

The existing gate enforcement (`gate-enforcement.js`) already checks `verdict === 'FAIL'`; with verdict now PASS, the gate allows the transition.

### 4. Documentation Updates

Updated all doc-review callers with in-context convergence tracking:

- **planner/AGENT.md**: Phase 3.5 doc-review retry loop now tracks error counts and implements convergence detection
- **ultrawork.md**: Step 3f (interactive planning) has 5-retry limit with auto-pass fallback
- **ultrawork-plan.md**: Step 3f doc-review loop updated to convergence-aware handling
- **planning/SKILL.md**: Phase 4.5 describes convergence detection logic

Convergence state is tracked in agent conversation context (no disk persistence needed for 3-5 attempts).

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed

- `plugins/ultrawork/src/scripts/codex-verify.js` (rewrite prompt criteria)
- `plugins/ultrawork/src/scripts/codex-autopass.js` (created)
- `plugins/ultrawork/agents/planner/AGENT.md` (Phase 3.5 convergence logic)
- `plugins/ultrawork/commands/ultrawork.md` (Step 3f retry budget + auto-pass)
- `plugins/ultrawork/commands/ultrawork-plan.md` (Step 3f convergence handling)
- `plugins/ultrawork/skills/planning/SKILL.md` (Phase 4.5 convergence protocol)
- `plugins/ultrawork/agents/verifier/AGENT.md` (Minor phase clarification)
- `plugins/ultrawork/.claude-plugin/plugin.json` (Version bump to 1.14.0)
- `.claude-plugin/marketplace.json` (Version sync to 1.14.0)
- `tests/ultrawork/codex-autopass.test.js` (created)
- `tests/ultrawork/codex-verify.test.js` (updated)

### Test Results

All tests pass. Verification criteria:

- V1: `buildDocReviewPrompt()` uses alignment-based criteria ✓
- V2: Old "Structural Accuracy" criterion removed ✓
- V3: planner/AGENT.md contains convergence detection logic ✓
- V4: planner/AGENT.md contains auto-pass protocol ✓
- V5: ultrawork.md Step 3f has retry budget ✓
- V6: ultrawork.md Step 3f has auto-pass fallback ✓
- V7: ultrawork-plan.md has convergence handling ✓
- V8: planning/SKILL.md Phase 4.5 has convergence handling ✓
- V9: codex-autopass.js exists and runs ✓
- V10: codex-autopass.js correctly transforms FAIL→PASS ✓
- V11: Existing tests pass (no regression) ✓
- V12: Plugin version bumped ✓
- V13: Marketplace version synced ✓

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1  | Rewrite `buildDocReviewPrompt()` with alignment-based criteria | resolved | New criteria implemented: Context Sufficiency, Goal-Result Alignment, Blocked Patterns. Old criteria (Structural Accuracy, Internal Consistency, Quality) removed. |
| 2  | Create `codex-autopass.js` script | resolved | Script reads FAIL result, downgrades errors to warnings, sets verdict to PASS. Matches existing schema contract. Handles missing/corrupted files gracefully. |
| 3  | Update planner/AGENT.md with convergence detection | resolved | Phase 3.5 doc-review section includes error count tracking and convergence detection logic. Calls codex-autopass.js when max retries reached. |
| 4  | Update ultrawork.md Step 3f with retry budget and auto-pass | resolved | Retry limit set to 5. Auto-pass protocol triggered after max retries. Remaining issues appended to design doc for worker visibility. |
| 5  | Update ultrawork-plan.md with convergence handling | resolved | Step 3f doc-review loop updated to track error counts and detect convergence. Calls auto-pass when budget exhausted. |
| 6  | Update planning/SKILL.md Phase 4.5 | resolved | Phase 4.5 includes convergence detection pseudocode and auto-pass protocol procedures. |
| 7  | Version bump and marketplace sync | resolved | plugin.json: 1.13.0 → 1.14.0. marketplace.json: synced to 1.14.0. |
| 8  | Fix pseudocode field name inconsistencies | resolved | Aligned field naming in ultrawork.md and ultrawork-plan.md for consistency with planner/AGENT.md. |
| verify | Final verification | resolved | All 13 verification criteria passed. Codex-autopass.js tested in isolation and with mock data. Prompt redesign verified via grep of new criteria. No test regressions. |

## Delta from Plan

Implementation matched the design document plan. All Wave 1-4 tasks completed as specified:

- Wave 1: Prompt rewrite and autopass script completed in parallel
- Wave 2: All caller docs (planner, ultrawork, ultrawork-plan, planning) updated with convergence logic
- Wave 3: Version bump completed after all code changes
- Wave 4: Verification completed with full criteria coverage

The design document's "Known Doc-Review Issues (Auto-Passed)" section noted four implementation-level concerns (tool permissions, JSON field paths, test internals, dual Phase 3.5 workflows) as resolvable during execution. All were resolved during implementation:

1. **Planner tool permissions**: Planner's Bash restriction to `task-*`, `session-*`, `context-*` scripts is explicit design (not a blocker). Orchestrator handles auto-pass writes via Bash.

2. **Auto-mode handoff**: Clarified in planner/AGENT.md Phase 3.5 that planner returns max-retries-reached message to orchestrator, which then triggers auto-pass.

3. **Verification plan**: Added executable tests for codex-autopass.js transform logic (V10). Grep checks verify prompt redesign (V1-V2).

4. **Dual Phase 3.5 workflows**: Consolidated into single coherent Phase 3.5 in planner/AGENT.md with clear decision tree (max retries → orchestrator → auto-pass).

## Impact on Permanent Documentation

The prompt redesign and convergence control are implementation details that improve the reliability of the existing design document review gate. No updates were required to permanent architecture documentation:

- `ARCHITECTURE.md`: Gate descriptions already correctly state that doc-review is optional (graceful degradation if Codex unavailable). No updates needed.
- `CLAUDE.md` (plugin level): Gate descriptions in Phase Transition Rules section are accurate. No drift detected.

Convergence logic is documented in agent/command/skill markdown (ultrawork.md, ultrawork-plan.md, planner/AGENT.md, planning/SKILL.md), which are not permanent architecture docs — they are command/agent runbooks that agents follow at runtime.

## Rationale for Design

**Why alignment-based criteria?** The original "Structural Accuracy" criterion asked Codex to verify implementation-level details (file references, JSON field names, tool permissions). These belong in code review during VERIFICATION phase, not in design review. Moving to alignment-based criteria (Can the worker understand what to do? Is the goal-result chain clear? Are there placeholders?) keeps doc-review focused on design quality and prevents scope creep.

**Why auto-pass instead of deterministic pre-checks?** Codex's doc-review finds genuinely useful issues (auth flow gaps, missing edge cases, circular dependencies). The problem is non-determinism (same doc passes one run, fails the next). Fully deterministic checks (Gate 0 for doc-review) would eliminate these issues but lose the semantic insights LLM provides. Auto-pass preserves LLM quality while bounding cost via retry budget.

**Why in-context convergence tracking?** Agents naturally have retry state in their conversation context. Adding persistence to disk (/tmp files) would require planner to have unrestricted Bash (currently restricted to task-*/session-*/context-* scripts). In-context tracking is simpler and sufficient for 3-5 attempts.

**Why verdict=PASS with warning-severity issues?** The existing gate checks `verdict === 'FAIL'`. Changing to PASS (not a new enum value) means no schema changes. Existing gate logic automatically allows the transition. Remaining issues are visible in the design doc's "Known Issues" section appended by the orchestrator, visible to workers.
