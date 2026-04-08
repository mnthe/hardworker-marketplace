# ADR: Ultrawork Verification Pipeline Redesign

## Status

Accepted -- 2026-04-08

## Context

Ultrawork's verification pipeline relied on Codex CLI as a blocking gate for both document review (PLANNING phase) and full verification (VERIFICATION phase). This created several problems:

1. **External dependency**: Codex CLI availability determined whether verification could proceed
2. **Blocking semantics**: Codex failures halted the entire pipeline, even for non-critical findings
3. **Concurrency issues**: Stale file locks could permanently block processes after crashes; tmpFile name collisions risked data loss during concurrent writes; JSONL evidence log had no write protection

The goal was to redesign verification to be self-contained (using internal agents) for critical gates while retaining Codex as a non-blocking advisory safety net.

## Decision

### Architecture: Triple Gate + Guardrail Agent + Codex Advisory

Replaced the Quad Gate (Claude + Reviewer + Codex blocking) with a Triple Gate system:

| Gate | Role | Blocking? |
|------|------|-----------|
| Gate 1: Claude Evidence Check | Deterministic evidence validation, core command checks | Yes |
| Gate 2: Reviewer | Code quality review (P0/P1 issues) | Yes |
| Gate 3: Guardrail Agent | Context-isolated goal-alignment check | Yes |
| Advisory: Codex | Background safety net, findings in report only | No |

**Guardrail Agent** is a new context-isolated agent spawned via `Task()` during verification. It has no knowledge of the implementation process -- it reads only goal, design document, git diff, and success criteria. It checks 4 axes: goal-result alignment, critical omissions, security holes, and breaking changes.

**Codex** was demoted from blocking gate to non-blocking advisory. Its result file protection and verifier-passed gate were removed from gate-enforcement.js. The doc-review gate remains as an advisory that blocks only when a result exists and shows FAIL.

### Concurrency Foundation

Three concurrency safety fixes were applied as prerequisites:

1. **Stale lock cleanup**: Locks older than 30 seconds are auto-removed on acquire attempt (prevents permanent blocking after OOM-kill/SIGKILL)
2. **PID+timestamp tmpFile naming**: `writeJsonAtomically` uses `${filePath}.${process.pid}.${Date.now()}.tmp` instead of fixed `.tmp` suffix (prevents collision in multi-process writes)
3. **JSONL evidence log locking**: `acquireLock`/`releaseLock` wraps JSONL appends in both `post-tool-use-evidence.js` and `subagent-stop-tracking.js` with fallback to unlocked append on timeout

### Task State Transition Validation

Added a transition table to `task-update.js` that validates status changes:
- `open` -> `in_progress`, `blocked`
- `in_progress` -> `resolved`, `blocked`, `open`
- `blocked` -> `open`, `in_progress`
- `resolved` -> `open` (Ralph loop: verifier reopens tasks)

Invalid transitions (e.g., `resolved` -> `in_progress`) are rejected with exit code 1.

### Lint Reclassification

Lint failures (`eslint`) reclassified from FAIL to WARNING. Only core commands (test, build, typecheck) trigger FAIL on failure.

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed

- `plugins/ultrawork/agents/guardrail/AGENT.md` (created)
- `plugins/ultrawork/agents/verifier/AGENT.md` (modified)
- `plugins/ultrawork/src/lib/file-lock.js` (modified)
- `plugins/ultrawork/src/lib/json-ops.js` (modified)
- `plugins/ultrawork/src/hooks/gate-enforcement.js` (modified)
- `plugins/ultrawork/src/hooks/post-tool-use-evidence.js` (modified)
- `plugins/ultrawork/src/hooks/subagent-stop-tracking.js` (modified)
- `plugins/ultrawork/src/hooks/stop-hook.js` (modified)
- `plugins/ultrawork/src/scripts/task-update.js` (modified)
- `plugins/ultrawork/src/scripts/task-create.js` (modified)
- `plugins/ultrawork/.claude-plugin/plugin.json` (modified)
- `plugins/ultrawork/CLAUDE.md` (modified)
- `.claude-plugin/marketplace.json` (modified)
- `tests/ultrawork/lib/file-lock.test.js` (modified)
- `tests/ultrawork/lib/json-ops.test.js` (created)
- `tests/ultrawork/hooks/post-tool-use-evidence.test.js` (created)
- `tests/ultrawork/hooks/stop-hook.test.js` (created)
- `tests/ultrawork/hooks/evidence-log-locking.test.js` (created)
- `tests/ultrawork/hooks/gate-enforcement-codex-removal.test.js` (created)
- `tests/ultrawork/hooks/gate-enforcement-codex-doc.test.js` (modified)
- `tests/ultrawork/hooks/gate-enforcement.test.js` (modified)
- `tests/ultrawork/task-update.test.js` (modified)
- `tests/ultrawork/task-create.test.js` (modified)
- `tests/ultrawork/task-create-advisory-gate.test.js` (created)

### Test Results

- 25 files changed, 1720 insertions, 602 deletions
- 28 new tests added across hooks, lib, and script test files
- All existing tests pass after modifications
- Version bumped to 1.15.0 (synced between plugin.json and marketplace.json)

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1 | Stale lock cleanup in file-lock.js | resolved | TDD: 2 new tests, 14/14 pass. Committed: a72f9d9 |
| 2 | tmpFile name collision fix in json-ops.js | resolved | TDD: new test file, 9/9 pass. Committed: 8e4bc56 |
| 3 | JSONL evidence log locking | resolved | acquireLock/releaseLock added to both hooks. Committed: b90742f |
| 4 | Create Guardrail Agent | resolved | AGENT.md created, registered in plugin.json. Committed: ca0f109 |
| 5 | Remove Codex blocking gates | resolved | gate-enforcement.js: 153 lines removed. Committed: 73a258e |
| 6 | Update Verifier AGENT.md | resolved | Triple Gate + Guardrail + Codex Advisory. Committed: 2b6bd7d |
| 7 | Task state transition validation | resolved | Transition table + 4 test cases. Committed: 2b3282f |
| 8 | Critical hook tests | resolved | 28 new tests across 6 test files. Committed: 76559ab |
| 9 | Update CLAUDE.md and version bump | resolved | 1.15.0 synced. Committed: 75d48db |
| verify | Final verification | resolved | All gates pass, all tasks resolved |

## Delta from Plan

- Implementation matched plan.
- P2 items (max_workers enforcement, evidence-task linking, phase name enums, etc.) intentionally deferred as documented in the design.
