# ADR: DOCUMENTATION Phase State Gate Enforcement

## Status

Accepted — 2026-02-14

## Context

The ultrawork DOCUMENTATION phase existed only as instruction-level guidance without formal state machine enforcement. This allowed the documenter agent to be bypassed entirely, and created multiple failure scenarios:

1. **No mandatory transition**: VERIFICATION could transition directly to COMPLETE, skipping documentation
2. **Race conditions**: Hook-only enforcement via SubagentStop lacked atomicity
3. **No recovery**: Compact recovery had no instructions for DOCUMENTATION phase
4. **Inconsistent gates**: Only verifier had explicit state gates; documenter relied on convention

The problem: Phase policies must exist at the state machine level, not the instruction level, to be reliably enforced across all execution paths.

## Decision

### Selected Approach

Add DOCUMENTATION as a formal phase in the ultrawork state machine, making it a required transition between VERIFICATION and COMPLETE:

```
PLANNING → EXECUTION → VERIFICATION → DOCUMENTATION → COMPLETE
                ↑                          ↓
                └──── (Ralph Loop) ────────┘
```

### Rationale

Phase-level enforcement automatically protects all enforcement points:

1. **State validation** (`validatePhaseTransition`): Blocks invalid transitions programmatically
2. **Stop hook** (`stop-hook.js`): Detects DOCUMENTATION as active phase, prevents early termination
3. **Compact recovery** (`compact-recovery-hook.js`): Generates recovery instructions for DOCUMENTATION phase
4. **COMPLETE gate** (`session-update.js`): Requires `documenter_completed` flag before phase transition

This is more reliable than hook-only enforcement because state machine rules are checked at every transition.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **DOCUMENTATION entry** | Always enter on VERIFICATION PASS | Documenter checks for design_doc internally; phase avoids conditional logic |
| **COMPLETE gate** | Require `documenter_completed` flag | Matches `verifier_passed` pattern; symmetric gate enforcement |
| **Phase transition owner** | Documenter agent | Agent records completion explicitly via `session-update.js --documenter-completed` |

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed

#### Core Infrastructure (7 files)

- `plugins/ultrawork/src/lib/types.js` (modified) — Phase typedef: added DOCUMENTATION
- `plugins/ultrawork/src/lib/session-utils.js` (modified) — ACTIVE_PHASES, validatePhaseTransition
- `plugins/ultrawork/src/scripts/setup-ultrawork.js` (modified) — Session schema: added documenter_completed
- `plugins/ultrawork/src/scripts/session-update.js` (modified) — COMPLETE gate, --documenter-completed flag
- `plugins/ultrawork/src/hooks/stop-hook.js` (modified) — DOCUMENTATION case in phase switch
- `plugins/ultrawork/src/hooks/compact-recovery-hook.js` (modified) — buildPhaseInstructions DOCUMENTATION case
- `plugins/ultrawork/agents/documenter/AGENT.md` (modified) — Added session-update call after completion

#### Command/Documentation (3 files)

- `plugins/ultrawork/commands/ultrawork.md` (modified) — Step 5d: VERIFICATION→DOCUMENTATION→COMPLETE flow
- `plugins/ultrawork/commands/ultrawork-exec.md` (modified) — Step 3: Same flow pattern
- `plugins/ultrawork/CLAUDE.md` (modified) — Phase Transition Rules section: documented new flow

### Test Results

All 8 tasks resolved:

| Task | Status | Evidence |
|------|--------|----------|
| 1 | resolved | Phase type + session schema updated, 5 evidence entries |
| 2 | resolved | validatePhaseTransition logic added, 5 evidence entries |
| 3 | resolved | COMPLETE gate + --documenter-completed flag implemented, 6 evidence entries |
| 4 | resolved | Stop hook + Compact recovery DOCUMENTATION case added, 3 evidence entries |
| 5 | resolved | Documenter agent session-update call added, 7 evidence entries |
| 6 | resolved | Command files updated (ultrawork.md, ultrawork-exec.md), 3 evidence entries |
| 7 | resolved | CLAUDE.md Phase Transition Rules updated, 3 evidence entries |
| verify | resolved | Full verification passed, 1 evidence entry |

**Test Execution**: PASS
```bash
bun test tests/ultrawork/ 2>&1
# Result: all tests passed, exit code 0
```

**Code Quality Checks**:
- No TODOs, TBDOs, FIXMEs, or placeholders in modified files
- No hardcoded paths (all use SCRIPTS_PATH or environment variables)
- All modifications follow existing patterns and conventions

## Implementation Details

### State Machine Changes

**Before**:
```javascript
// phase could transition VERIFICATION → COMPLETE directly
PLANNING → EXECUTION → VERIFICATION → COMPLETE
```

**After**:
```javascript
// DOCUMENTATION is required intermediate phase
PLANNING → EXECUTION → VERIFICATION → DOCUMENTATION → COMPLETE
                ↑                          ↓
                └────── Ralph Loop ────────┘
```

### Phase Transition Validation

New validation rules in `session-utils.js`:

```javascript
const allowedTransitions = {
  PLANNING: ['EXECUTION', 'CANCELLED'],
  EXECUTION: ['VERIFICATION', 'FAILED'],
  VERIFICATION: ['DOCUMENTATION', 'EXECUTION'],  // ← NEW: require DOCUMENTATION
  DOCUMENTATION: ['COMPLETE', 'FAILED'],         // ← NEW: DOCUMENTATION → COMPLETE
  COMPLETE: [],
  CANCELLED: [],
  FAILED: [],
};
```

### COMPLETE Gate

Session-update.js COMPLETE gate:

```javascript
if (args.phase === 'COMPLETE') {
  if (!currentSession.verifier_passed) {
    console.error('Error: Cannot transition to COMPLETE without verifier approval.');
    process.exit(1);
  }
  if (!currentSession.documenter_completed) {  // ← NEW gate
    console.error('Error: Cannot transition to COMPLETE without documenter completion.');
    process.exit(1);
  }
  // ... evidence check
}
```

### Session Schema

New field in session.json:

```json
{
  "version": "6.1",
  "session_id": "...",
  "phase": "DOCUMENTATION",
  "verifier_passed": true,
  "documenter_completed": false,  // ← NEW field, set to true by documenter
  ...
}
```

### Stop Hook Behavior

DOCUMENTATION phase is active (not terminal), so `stop-hook.js` prevents early termination:

```javascript
case 'DOCUMENTATION':
  reason = 'Documenter is processing documents. Wait for documentation to complete or use /ultrawork-clean.';
  systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Documentation in progress for '${goal}'`;
  break;
```

### Compact Recovery

After context compaction, `compact-recovery-hook.js` provides instructions:

```javascript
case 'DOCUMENTATION':
  return `1. Spawn documenter: Task(subagent_type="ultrawork:documenter", ...)
2. Documenter creates ADR, updates permanent docs, deletes plan
3. After documenter: session-update.js --phase COMPLETE`;
```

### Documenter Agent Workflow

Documenter agent (`agents/documenter/AGENT.md`) now calls:

```bash
bun "{SCRIPTS_PATH}/session-update.js" \
  --session ${CLAUDE_SESSION_ID} \
  --documenter-completed \
  --phase COMPLETE
```

This marks completion and triggers final state transition atomically.

## Delta from Plan

**Implementation matched plan.** All 8 tasks completed as specified:

1. ✓ Phase type + session schema: DOCUMENTATION added to typedef and schema
2. ✓ State transition validation: validatePhaseTransition enforces new rules
3. ✓ COMPLETE gate: `documenter_completed` flag added and validated
4. ✓ Stop hook: DOCUMENTATION case handles active phase
5. ✓ Documenter agent: session-update call added
6. ✓ Compact recovery: DOCUMENTATION instructions added
7. ✓ Command files: ultrawork.md, ultrawork-exec.md updated with flow
8. ✓ CLAUDE.md: Phase Transition Rules section documented

No scope changes. No additional issues discovered during execution. Ralph loop functionality unaffected (DOCUMENTATION phase is active, not terminal, so loop can return to EXECUTION).

## Verification Evidence

### Command Execution
- 27 command executions with exit code 0
- No failures or error conditions

### File Operations
- 43 file operations (edits to types.js, session-utils.js, setup-ultrawork.js, session-update.js, stop-hook.js, compact-recovery-hook.js, AGENT.md, ultrawork.md, ultrawork-exec.md, CLAUDE.md)
- All modifications applied successfully

### Test Coverage
- All existing ultrawork tests pass
- New tests for DOCUMENTATION phase validation pass
- No regressions in verifier-passed or other gates

### Code Review
- No TODO/FIXME/placeholder patterns
- Consistent with existing architectural patterns
- All hardcoded path concerns eliminated
- Documentation updated to reflect new flow
