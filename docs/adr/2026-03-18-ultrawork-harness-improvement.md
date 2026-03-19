# ADR: Ultrawork Harness Improvement

## Status

Accepted -- 2026-03-19

## Context

Ultrawork plugin had four harness engineering gaps: entropy/drift accumulation (C8), feedback loop for lessons (C7), lifecycle onboarding (C6), and deterministic pre-verification (C2/C4). These gaps meant verification relied entirely on LLM gates (expensive), session start lacked contextual onboarding, lessons from past sessions were lost, and documentation drift went undetected.

## Decision

### Gate 0: Deterministic Verification

Added a deterministic pre-check step (Gate 0) that runs before LLM-based verification gates. Gate 0 uses `phase-rules.json` for default checks (all tasks resolved, evidence exists) and supports project-level overrides via `.claude/ultrawork-rules.json`. Check types: `task_status`, `evidence_count`, `command`, `glob`. Gate 0 FAIL causes immediate return, skipping all LLM gates and saving tokens.

### Phase Numbering Restructure

Replaced decimal phase numbering (0, 1.5, 1, 2, 3, 4, 4.5, 4.7, 5, 6) with hierarchical N-M notation: Gate 0 (deterministic), Phase 1 (1-1 primary, 1-2 codex), Phase 2 (2-1 join codex, 2-2 reviewer), Phase 3 (3-1 quad gate, 3-2 transition). The N-M format distinguishes sequential phases (N) from parallel tracks within a phase (N-M).

### Documenter Extension: Lessons + Drift Repair

Extended documenter agent with Phase 2-2 (drift repair via file_operation evidence analysis) and Phase 2-3 (lessons extraction to `docs/lessons/`). Lessons and ADR are separate files because they serve different consumers: ADR for code understanding, lessons for process improvement.

### Session Onboarding Banner

Extended `session-start-hook.js` to display stale sessions, recent lessons recommendations, and git status at session start. Banner is suppressed when all sections are empty.

### /ultrawork-lessons Command

New command for viewing accumulated lessons from `docs/lessons/` with options `--all` and `--last N`.

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed

- `plugins/ultrawork/src/rules/phase-rules.json` (created)
- `plugins/ultrawork/src/scripts/deterministic-verify.js` (created)
- `tests/ultrawork/deterministic-verify.test.js` (created)
- `tests/ultrawork/hooks/session-start-hook.test.js` (created)
- `plugins/ultrawork/commands/ultrawork-lessons.md` (created)
- `plugins/ultrawork/agents/verifier/AGENT.md` (modified)
- `plugins/ultrawork/agents/documenter/AGENT.md` (modified)
- `plugins/ultrawork/agents/reviewer/AGENT.md` (modified)
- `plugins/ultrawork/commands/references/05-validate.md` (modified)
- `plugins/ultrawork/commands/references/06-document.md` (modified)
- `plugins/ultrawork/skills/planning/SKILL.md` (modified -- phase number references)
- `plugins/ultrawork/src/hooks/gate-enforcement.js` (modified)
- `plugins/ultrawork/src/hooks/session-start-hook.js` (modified)
- `plugins/ultrawork/CLAUDE.md` (modified)
- `plugins/ultrawork/.claude-plugin/plugin.json` (modified -- 1.6.0 to 1.7.0)
- `.claude-plugin/marketplace.json` (modified -- 1.6.0 to 1.7.0)

### Test Results

- `bun test tests/ultrawork/deterministic-verify.test.js`: PASS (all check types covered -- task_status, evidence_count, command, glob, merge logic)
- `bun test tests/ultrawork/hooks/session-start-hook.test.js`: PASS (onboarding banner output verification)
- Version sync check: plugin.json 1.7.0 == marketplace.json 1.7.0

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1 | phase-rules.json | resolved | File created at src/rules/phase-rules.json with task_status + evidence_count checks |
| 2 | deterministic-verify.js tests | resolved | RED tests written covering all 4 check types + merge logic |
| 3 | deterministic-verify.js implementation | resolved | All tests PASS, handles command/task_status/evidence_count/glob checks |
| 4 | session-start-hook.js onboarding banner | resolved | Banner displays stale sessions, recent lessons, git status; suppressed when empty |
| 5 | Verifier AGENT.md -- Gate 0 + Phase restructure | resolved | Gate 0 integration as early-exit, N-M phase notation applied |
| 6 | Documenter AGENT.md -- Lessons + Drift Repair | resolved | Phase 2-2 drift repair and Phase 2-3 lessons extraction added |
| 7 | /ultrawork-lessons command | resolved | Command file created with --all and --last options |
| 8 | Phase number reference updates (6 files) | resolved | All decimal references replaced with N-M notation across reviewer, 05-validate, 06-document, planning skill, gate-enforcement, CLAUDE.md |
| 9 | CLAUDE.md + version bump 1.7.0 | resolved | plugin.json and marketplace.json both at 1.7.0, CLAUDE.md updated |

## Delta from Plan

- Implementation matched plan.
