# ADR: Phase Transition Security - Two-Step Validation

## Status

Accepted — 2026-03-24

## Context

The `session-update.js` script controls phase transitions in ultrawork sessions. A security issue existed where the main context agent could bypass phase transition gates by combining flag-setting (`--verifier-passed`, `--documenter-completed`) with phase transitions (`--phase`) in a single call. This allowed skipping verification or documentation work entirely.

**Root cause:** Gate validation used `|| args.flag` pattern, accepting the flag from CLI arguments as equivalent to prior completion:
```javascript
// Bypassable gate
if (!currentSession.verifier_passed && !args.verifierPassed) { error }
```

An attacker could call:
```bash
session-update.js --documenter-completed --phase COMPLETE
# Skips all documentation work
```

## Decision

**Enforce two-step validation:** Separate flag-setting from phase transitions with prerequisite state checks.

**Rationale:**
- Claude Code provides no caller identity to scripts, eliminating identity-based verification
- Evidence-based checks (artifact presence) are fragile and project-specific
- State-based two-step validation raises the bypass bar: attacker must know protocol, have all prerequisites already met, and make two separate calls
- Combined with instruction-based guardrails in agent prompts, provides defense in depth

**Implementation:**

1. **Reject flag + phase combination at CLI level** (Stage 1, no file I/O):
   - Error immediately if `--verifier-passed` or `--documenter-completed` combined with `--phase`

2. **Phase transitions check only session state** (Stage 2, under file lock):
   - Remove `|| args.flag` bypass from gate checks
   - VERIFICATION → DOCUMENTATION requires `session.verifier_passed` (not CLI flag)
   - DOCUMENTATION → COMPLETE requires `session.documenter_completed` (not CLI flag)

3. **Flag-setting requires prerequisite state:**
   - `--verifier-passed`: All non-verify tasks must be `resolved`
   - `--documenter-completed`: Prior `verifier_passed` must be `true`

4. **Ralph loop state reset:**
   - EXECUTION transition now resets both `verifier_passed` and `documenter_completed` (previously only `verifier_passed`)
   - Prevents stale state from prior verification iteration allowing DOCUMENTATION→COMPLETE without fresh work

## Outcome

**Verification**: PASS
**Iterations**: 5 (initial implementation + 4 rounds of fixes)

### Files Changed
- `plugins/ultrawork/src/scripts/session-update.js` (gate hardening, prerequisite checks, Ralph loop reset)
- `plugins/ultrawork/agents/verifier/AGENT.md` (2-step call protocol)
- `plugins/ultrawork/agents/documenter/AGENT.md` (2-step call protocol)
- `plugins/ultrawork/CLAUDE.md` (phase transition rules)
- `plugins/ultrawork/commands/ultrawork.md` (phase transition docs)
- `plugins/ultrawork/commands/ultrawork-exec.md` (call pattern examples)
- `plugins/ultrawork/commands/references/06-document.md` (2-step examples)
- `plugins/ultrawork/src/hooks/compact-recovery-hook.js` (guidance updates)
- `plugins/ultrawork/src/hooks/session-context-hook.js` (guidance updates)
- `tests/ultrawork/session-update.test.js` (updated + new tests)
- `tests/ultrawork/session-update.base.test.js` (complete phase gate test updates)
- `tests/ultrawork/test-utils.js` (helper support)

### Test Results

All test suites pass:
- **Bypass prevention:** Combined `--verifier-passed --phase DOCUMENTATION` correctly rejected with exit code 1
- **Bypass prevention:** Combined `--documenter-completed --phase COMPLETE` correctly rejected with exit code 1
- **Prerequisite validation:** `--verifier-passed` with unresolved tasks fails with specific error
- **Prerequisite validation:** `--documenter-completed` without prior `verifier_passed` fails
- **Two-step lifecycle:** Full PLANNING→EXECUTION→VERIFICATION→DOCUMENTATION→COMPLETE flow with separate flag/phase calls
- **Ralph loop reset:** Both `verifier_passed` and `documenter_completed` reset to `false` on EXECUTION transition
- **Malformed task fail-closed:** `--verifier-passed` fails when non-verify task file is malformed JSON
- **Phase gate tests:** Updated to reflect state-only checks (no CLI arg bypass)
- **Regression tests:** All existing phase transition tests updated to 2-step protocol and still pass

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1  | session-update.js gate hardening | resolved | 5 files modified: phase gate logic, prerequisite checks, documenter_completed reset, error messages |
| 2  | Test updates for two-step validation | resolved | 3 files modified: new bypass prevention tests, prerequisite validation tests, Ralph loop reset test, regression updates |
| 3  | Agent documentation updates (verifier + documenter) | resolved | Both AGENT.md files updated with 2-step call examples and protocol explanation |
| 4  | Command, CLAUDE.md, and hook documentation updates | resolved | 5 files modified: all references to phase transitions now show 2-step protocol |
| 5  | Fix: Design doc Architecture section lock scope overclaim | resolved | Design doc Architecture section revised to accurately describe lock scope (session.json only, not task/evidence files) |
| verify | Verification gate and evidence collection | resolved | Gate enforcement validated; all changes verified via test execution and git diff |

## Delta from Plan

No meaningful deviations from the design document plan.

**Small clarification made during execution:**
- Design doc Architecture section initially claimed task/evidence file reads were under session.json file lock
- Clarified through implementation that lock applies only to session.json writes; task/evidence reads happen inside callback but without per-file locks (safe in single-agent-per-session model)
- Design doc Architecture updated to reflect actual implementation

## Verification Protocol

The new two-step validation protocol is now:

```bash
# Step 1: Set flag (checks prerequisites on session state)
session-update.js --session X --verifier-passed
# Exit 0 if all tasks resolved; Exit 1 if any task unresolved

# Step 2: Transition phase (checks state only, not CLI args)
session-update.js --session X --phase DOCUMENTATION
# Exit 0 if verifier_passed is true; Exit 1 otherwise

# Bypass attempt (now rejected):
session-update.js --session X --verifier-passed --phase DOCUMENTATION
# Exit 1: "cannot be combined" error
```

This is now enforced in:
- verifier/AGENT.md: Step-by-step calls documented
- documenter/AGENT.md: Step-by-step calls documented
- Hook guidance updated to reflect 2-step protocol
- All phase transition documentation updated
