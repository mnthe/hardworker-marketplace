# Phase Transition Security: Two-Step Validation

## Overview

Harden `session-update.js` phase transition gates so that flag-setting (`--verifier-passed`, `--documenter-completed`) and phase transitions (`--phase`) cannot be combined in a single call, and each flag requires verifiable prerequisite state. The current design allows any caller to combine a flag (`--verifier-passed`, `--documenter-completed`) with a `--phase` transition in a single call, effectively skipping the actual verification/documentation work.

**Constraints:** Claude Code does not provide caller identity to scripts, so enforcement uses state-based prerequisite checks rather than identity-based verification. This raises the bypass bar but does not eliminate it entirely.

**Expected outcome:** Flag-setting and phase transitions require separate calls, and flags have prerequisite state checks that raise the bar for bypass (resolved tasks, prior flag state) without claiming caller identity verification.

## Problem

Main context agent can bypass phase transition gates by combining flags with phase transitions in a single call:

```bash
# Gate correctly blocks this:
session-update.js --session X --phase COMPLETE
# Error: DOCUMENTATION → COMPLETE requires --documenter-completed flag.

# But this bypasses the gate (anyone can add the flag):
session-update.js --session X --documenter-completed --phase COMPLETE
# OK: Session updated
```

**Root cause**: Gate checks use `|| args.flag` pattern:
```javascript
// Line 146: verifier gate bypass
if (!currentSession.verifier_passed && !args.verifierPassed) { ... }
// Line 162: documenter gate bypass
if (!currentSession.documenter_completed && !args.documenterCompleted) { ... }
```

## Scope

**In-scope:**
- `session-update.js` gate logic hardening (flag + phase separation, prerequisite checks)
- Reset `documenter_completed` on EXECUTION transition (Ralph loop stale state fix)
- Agent AGENT.md updates (verifier, documenter) to use 2-step calls
- Documentation updates for phase transition rules
- Test updates for new validation behavior

**Out-of-scope / Non-goals:**
- Hook-level enforcement changes (`gate-enforcement.js`) — current hook gates remain as-is
- Caller identity verification (Claude Code doesn't provide agent context to scripts)
- Changes to `validatePhaseTransition()` in `session-utils.js` — structural transition rules are correct
- Evidence collection or evidence format changes
- Changes to the PLANNING gate or TDD enforcement

## Architecture

### Validation Flow in session-update.js

The validation happens in two stages:

```
Stage 1: Pre-lock argument validation (no file I/O)
  └── If (--verifier-passed OR --documenter-completed) AND --phase → REJECT immediately

Stage 2: Locked validation + write (inside updateSession callback, under file lock)
  ├── Read session state (guaranteed consistent under lock)
  ├── Flag prerequisite validation:
  │   ├── --verifier-passed → session.phase must be VERIFICATION
  │   │                      → all tasks with id != "verify" must have status "resolved"
  │   └── --documenter-completed → session.phase must be DOCUMENTATION
  │                              → session.verifier_passed must be true
  ├── Phase transition validation:
  │   ├── validatePhaseTransition() — structural rules
  │   ├── → DOCUMENTATION: session.verifier_passed must be true (state only)
  │   └── → COMPLETE: session.verifier_passed + session.documenter_completed must be true (state only)
  │                    evidence count >= resolved task count
  └── Apply changes atomically
      └── Reset verifier_passed + documenter_completed on EXECUTION transition (Ralph loop)
```

### Session State Read/Write Points

| Point | Read | Write |
|-------|------|-------|
| Stage 1 | CLI args only | None |
| Stage 2 (inside lock) | `readSession()` for session.json fields (phase, flags); task files and evidence log read separately (not under per-file locks) | `writeJsonAtomically()` for session.json |

The `updateSession(sessionId, updater)` function acquires the session.json file lock, reads session state, calls the updater callback, and writes — all atomically. This eliminates TOCTOU for session state fields (`phase`, `verifier_passed`, `documenter_completed`). Task file reads (`tasks/*.json`) and evidence log reads (`evidence/log.jsonl`) happen inside the same callback but are not protected by per-file locks. In the single-agent-per-session execution model, this is safe because only one process modifies task/evidence files at a time. Validation errors thrown from the updater callback propagate up and release the lock without writing.

### Non-verify Task Definition

A "non-verify task" is any task JSON file in `$SESSION_DIR/tasks/` where `task.id !== "verify"`. Only `resolved` status is accepted. Tasks with status `open`, `in_progress`, or `blocked` all cause the prerequisite check to fail.

**Fail-closed behavior:** Task file identity is determined by filename (e.g., `verify.json` → id `verify`), not by JSON content. This means:
- A malformed `verify.json` is still treated as the verify task and exempt from the non-verify check.
- A malformed non-verify task file (e.g., `1.json` that fails to parse) is treated as unresolved, blocking `--verifier-passed`.
- This follows fail-closed design: any error reading a non-verify task blocks the gate rather than allowing bypass.

### Ralph Loop Stale State Fix

Current behavior resets `verifier_passed = false` on EXECUTION transition but does NOT reset `documenter_completed`. After a Ralph loop (VERIFICATION→EXECUTION→VERIFICATION→DOCUMENTATION), `documenter_completed` remains `true` from a prior iteration, allowing DOCUMENTATION→COMPLETE to pass without fresh documenter work.

**Fix:** Also reset `documenter_completed = false` when transitioning to EXECUTION.

### CLI Contract

All error cases exit with code 1 and write to stderr. Exit behavior is unchanged from current implementation. Specific error messages:

| Condition | Error Message |
|-----------|---------------|
| `--verifier-passed` + `--phase` in same call | `Error: --verifier-passed cannot be combined with --phase. Set the flag first, then transition in a separate call.` |
| `--documenter-completed` + `--phase` in same call | `Error: --documenter-completed cannot be combined with --phase. Set the flag first, then transition in a separate call.` |
| `--verifier-passed` with unresolved tasks | `Error: --verifier-passed requires all non-verify tasks to be resolved. Task {id} has status: {status}.` |
| `--documenter-completed` without verifier_passed | `Error: --documenter-completed requires verifier_passed to be set first.` |
| `→ DOCUMENTATION` without verifier_passed | `Error: VERIFICATION → DOCUMENTATION requires verifier_passed. Set --verifier-passed first in a separate call.` |
| `→ COMPLETE` without documenter_completed | `Error: DOCUMENTATION → COMPLETE requires documenter_completed. Set --documenter-completed first in a separate call.` |
| `→ COMPLETE` without verifier_passed | `Error: Cannot transition to COMPLETE without verifier approval. Run the Verifier agent first.` |
| `--verifier-passed` during wrong phase | `Error: --verifier-passed can only be set during VERIFICATION phase (current: {phase}).` (retained) |
| `--documenter-completed` during wrong phase | `Error: --documenter-completed can only be set during DOCUMENTATION phase (current: {phase}).` (retained) |
| `→ COMPLETE` with insufficient evidence | `Error: Insufficient evidence. {count} evidence entries for {resolved} resolved tasks.` (retained) |
| `--verifier-passed` with malformed task file | `Error: --verifier-passed requires all non-verify tasks to be resolved. Failed to read task file: {filename}.` |

## Approach and Decisions

### Decision: Two-Step Validation (State-Based)

**Chosen approach:** Separate flag-setting from phase transitions, enforce prerequisite state checks on each flag.

**Rationale:** Claude Code does not expose caller identity to hooks or scripts. Three approaches were considered:

1. **Identity-based (rejected):** Verify that the caller is the correct sub-agent type. Impossible — Claude Code provides no `agent_context` field in hook inputs or script environment.

2. **Evidence-based (rejected for now):** Check that specific artifacts exist (e.g., ADR file for documenter, test results for verifier). Fragile — artifact names and locations vary by project, and absence of an artifact doesn't prove no work was done.

3. **State-based two-step (chosen):** Require flag and phase transition in separate calls, with prerequisite state checks (all tasks resolved for verifier, verifier_passed for documenter). This does not prove the correct agent ran, but it raises the bar: the main agent would need to (a) know the two-step protocol, (b) have all tasks already resolved, and (c) make two separate calls. Combined with instruction-based guardrails in agent prompts, this provides defense in depth.

**Trade-off:** State checks are not proof of identity, but they are the strongest enforcement possible given the runtime constraints.

## Solution: Two-Step Validation

### Core Change

**Separate flag-setting from phase transitions.** Phase transition gates check only session state, not CLI args.

```
Before (1 call, bypassable):
  session-update.js --verifier-passed --phase DOCUMENTATION

After (2 calls, prerequisite-checked):
  session-update.js --verifier-passed         # Step 1: set flag (requires all tasks resolved)
  session-update.js --phase DOCUMENTATION     # Step 2: transition (checks session.verifier_passed)
```

### Change 1: Reject flag + phase combination

```javascript
// NEW: Reject combining flag with phase transition
if ((args.verifierPassed || args.documenterCompleted) && args.phase) {
  const flag = args.verifierPassed ? '--verifier-passed' : '--documenter-completed';
  console.error(`Error: ${flag} cannot be combined with --phase. Set the flag first, then transition in a separate call.`);
  process.exit(1);
}
```

### Change 2: Remove `|| args.flag` bypass from gate checks

```javascript
// VERIFICATION → DOCUMENTATION gate
// Before:
if (!currentSession.verifier_passed && !args.verifierPassed) { error }
// After:
if (!currentSession.verifier_passed) { error }

// DOCUMENTATION → COMPLETE gate
// Before:
if (!currentSession.documenter_completed && !args.documenterCompleted) { error }
// After:
if (!currentSession.documenter_completed) { error }
```

### Change 3: Add prerequisite checks for flags

**`--verifier-passed`** (existing: phase must be VERIFICATION):
- NEW: All non-verify tasks must be in `resolved` status

**`--documenter-completed`** (existing: phase must be DOCUMENTATION):
- NEW: `verifier_passed` must already be `true` in session state

### Change 4: Reset documenter_completed on EXECUTION transition

```javascript
// In updateSession callback, when transitioning to EXECUTION:
if (args.phase === 'EXECUTION') {
  session.verifier_passed = false;
  session.documenter_completed = false;  // NEW: prevent stale state across Ralph loops
}
```

## Testing Strategy

### Coverage Requirements

| Category | Tests | Purpose |
|----------|-------|---------|
| Bypass prevention | 2 | Combined `--verifier-passed --phase DOCUMENTATION` rejected; combined `--documenter-completed --phase COMPLETE` rejected |
| Prerequisite validation | 3 | `--verifier-passed` with unresolved tasks fails; `--documenter-completed` without verifier_passed fails; `--verifier-passed` with all tasks resolved succeeds |
| Two-step lifecycle | 1 | Full PLANNING→EXECUTION→VERIFICATION→DOCUMENTATION→COMPLETE where `--verifier-passed` and `--documenter-completed` are set in separate calls from their phase transitions |
| Ralph loop reset | 1 | After EXECUTION transition, both `verifier_passed` and `documenter_completed` are `false` |
| Malformed task fail-closed | 1 | `--verifier-passed` fails when a non-verify task file is malformed JSON |
| Regression | Update existing | Tests using combined 1-call pattern updated to 2-step |

### Regression Scenarios

1. **Existing full lifecycle test** (`should update phase to COMPLETE through full lifecycle`): Already uses 2-step — verify still passes
2. **Combined flag tests** (previously testing 1-call success): Must be updated to 2-step or converted to rejection tests
3. **Phase gate tests** (guardrails section): Update to reflect state-only checks

### Security Guarantee Verification

The bypass prevention tests directly verify the security fix:
```bash
# This MUST fail (the exact attack vector from the bug report):
session-update.js --session X --documenter-completed --phase COMPLETE
# Expected: exit code 1, stderr contains "cannot be combined"
```

## Files to Modify

| File | Change |
|------|--------|
| `plugins/ultrawork/src/scripts/session-update.js` | Gate logic + prerequisite checks + Ralph loop reset |
| `plugins/ultrawork/agents/verifier/AGENT.md` | 2-step calls |
| `plugins/ultrawork/agents/documenter/AGENT.md` | 2-step calls |
| `plugins/ultrawork/CLAUDE.md` | Phase transition rules |
| `plugins/ultrawork/commands/ultrawork.md` | Phase transition docs |
| `plugins/ultrawork/commands/ultrawork-exec.md` | Comment updates |
| `plugins/ultrawork/commands/references/06-document.md` | 2-step examples |
| `plugins/ultrawork/src/hooks/compact-recovery-hook.js` | Update VERIFICATION/DOCUMENTATION phase guidance to 2-step |
| `plugins/ultrawork/src/hooks/session-context-hook.js` | Update phase guidance to reflect 2-step protocol |
| `tests/ultrawork/session-update.test.js` | Updated + new tests |

## Execution Strategy

### Task 1: session-update.js gate hardening
- Reject flag + phase combination (Stage 1)
- Add prerequisite check for `--verifier-passed` (all tasks resolved)
- Add prerequisite check for `--documenter-completed` (verifier_passed true)
- Remove `|| args.flag` bypass from gate checks
- Reset `documenter_completed` on EXECUTION transition

### Task 2: Test updates
- Update tests using combined pattern to 2-step
- Add bypass attempt tests (verify combined call fails)
- Add prerequisite validation tests
- Add Ralph loop reset test

### Task 3: Agent documentation updates
- verifier/AGENT.md: 2-step call pattern
- documenter/AGENT.md: 2-step call pattern

### Task 4: Command/CLAUDE.md/hook documentation updates
- CLAUDE.md phase transition rules
- ultrawork.md, ultrawork-exec.md, 06-document.md
- compact-recovery-hook.js: update VERIFICATION and DOCUMENTATION phase guidance
- session-context-hook.js: update phase guidance to reflect 2-step protocol
