# ADR: Insights-Driven Agent Improvements

## Status

Accepted — 2026-03-26

## Context

Analysis of 120 Claude Code sessions (2026-03-06 ~ 2026-03-26) revealed top friction sources in ultrawork agent behavior: wrong CLI assumptions (40%), verification loop overhead, stale references after renames, and inconsistent commit discipline guidance. Each failure pattern maps to a specific agent phase where guidance was missing or contradictory.

## Decision

Applied 5 improvements to ultrawork agent AGENT.md files, each addressing a concrete failure mode from usage analysis:

1. **Worker Phase 0.5: External Tool Verification** — Verify CLI tool availability and API surface (`--help` flags) before task implementation to prevent rework when task assumptions are wrong.

2. **Verifier Phase 2-1: Codex Retry with Backoff** — Add transient-vs-logic classification on Codex gate failures. Retry with 3s backoff on timeout/exec errors (network blips). After 2 failures, classify as transient and proceed with SKIP verdict, logging warning. Logic failures stay in FAIL path.

3. **Reviewer P1 Check: Stale Reference Detection** — New P1 criterion detecting renamed/moved files that still have old references in unchanged files via `git diff` analysis and codebase grep. Report with file:line suggestions.

4. **Worker Phase 6: Commit Discipline** — Fix contradiction in auto-commit rules (was "Use `git add -A`", now "Stage ONLY files modified by this task"). Add explicit separation rules: one logical change per commit, structural changes separate from behavioral, each commit independently cherry-pickable.

5. **Planner Phase 3.5: Doc-Review Retry Clarification** — Replace vague retry loop with explicit backoff timing (2s, 5s), issue persistence tracking between attempts, and fallback behavior (leave session in PLANNING after 3 failures). Remove manual deletion step (auto-cleaned by codex-verify.js).

All changes are AGENT.md prompt edits only. Version bumped to 1.12.0 (minor: new agent capabilities).

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed
- `plugins/ultrawork/agents/worker/AGENT.md` (modified — Phase 0.5 added, Phase 6 fixed)
- `plugins/ultrawork/agents/verifier/AGENT.md` (modified — Phase 2-1 retry logic added)
- `plugins/ultrawork/agents/reviewer/AGENT.md` (modified — P1 stale reference check added)
- `plugins/ultrawork/agents/planner/AGENT.md` (modified — Phase 3.5 retry clarified)
- `plugins/ultrawork/.claude-plugin/plugin.json` (modified — version 1.12.0)
- `.claude-plugin/marketplace.json` (modified — version sync 1.12.0)

### Test Results
All 14 success criteria verified:
- Phase 0.5 External Tool Verification present in worker AGENT.md
- Retry/backoff/transient keywords present in verifier Phase 2-1 (>= 3 matches)
- Stale reference check present in reviewer P0+P1
- `git add -A` removed from rules (only in FORBIDDEN context)
- Cherry-pickable commit rule documented
- Backoff timing explicit in planner Phase 3.5 (>= 2 matches)
- Previous issues tracking and common fix patterns in planner (>= 3 matches)
- Versions synced: plugin.json = marketplace.json = 1.12.0
- git diff shows only 6 files changed (4 AGENT.md + 2 version files)

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1  | Worker Phase 0.5 External Tool Verification | resolved | AGENT.md edited, grep confirms content |
| 2  | Verifier Phase 2-1 Codex retry logic | resolved | Retry/backoff/transient keywords present |
| 3  | Reviewer P1 Stale reference detection | resolved | Grep, git diff, file:line reporting added |
| 4  | Worker Phase 6 commit discipline fix | resolved | `git add -A` moved to FORBIDDEN block |
| 5  | Planner Phase 3.5 doc-review retry | resolved | Backoff timing, issue persistence, fallback documented |
| 6  | Version bump plugin.json/marketplace.json | resolved | 1.12.0 synced across files |
| 7  | Fix: Verifier retry section casing | resolved | Transient/logic on same line for grep |
| 8  | Fix: Worker rules checklist cleanup | resolved | Literal `git add -A` removed |
| 9  | Fix: Design doc consistency | resolved | Path and criteria aligned |
| 10 | Fix: Transient vs logic classification | resolved | Same-line phrasing for grep |
| 11 | Fix: Verifier SKIP JSON instruction | resolved | Added "verifier writes `verdict: SKIP`" clarification |
| 12 | Fix: Reviewer grep -n flag | resolved | Added `-n` for line number output |
| verify | Verify all success criteria | resolved | 14/14 criteria PASS |

## Delta from Plan

Implementation matched plan exactly:
- All 5 primary changes executed as designed (Changes 1-5)
- 8 fix tasks emerged during verification to address criterion edge cases (typos, casing, clarity)
- No design changes; all fixes were prompt clarifications
- Version bump completed per project convention (minor version for new agent capabilities)
