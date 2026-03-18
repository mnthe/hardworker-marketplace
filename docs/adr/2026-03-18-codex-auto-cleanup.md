# ADR: Codex Result File Auto-Cleanup

## Status

Accepted — 2026-03-18

## Context

During verification iterations (Ralph loop), Codex result files persisted across retries, creating race conditions and requiring manual cleanup. When re-running doc-review on a fixed design document, users had to manually delete `/tmp/codex-doc-{sessionId}.json` before re-executing verification. This added friction to the debug loop and introduced opportunities for stale results to be read by gate hooks.

The Codex dual-phase gate system (PLANNING→EXECUTION and VERIFICATION→DOCUMENTATION) needed automated lifecycle management to prevent stale verification results from interfering with gate enforcement.

## Decision

### Selected Approach

Implement automatic cleanup of Codex result files at script invocation time and gate hook enforcement to prevent manual deletion:

1. **Auto-cleanup in codex-verify.js**: Delete existing `--output` file before mode execution in the `main()` function
   - Ensures fresh results on every invocation
   - Prevents race condition where gate hook reads partial/stale FAIL result
   - Happens before any mode-specific logic (check, review, exec, full, doc-review)

2. **Manual deletion blocking in gate-enforcement.js**: Block Bash commands attempting `rm` or `unlink` of codex result files
   - Detects patterns: `/tmp/codex-{sessionId}.json` and `/tmp/codex-doc-{sessionId}.json`
   - Follows existing session file tamper protection pattern
   - Returns helpful message directing user to re-run codex-verify.js instead

### Scope

**In scope:**
- codex-verify.js output file pre-cleanup
- gate-enforcement.js manual rm blocking
- ultrawork.md documentation update (remove manual rm instruction from doc-review retry flow)
- Test coverage for both mechanisms

**Out of scope:**
- session-update.js internal cleanup logic (already exists, remains unchanged)
- teamwork plugin's codex-verify.js (separate copy, independent lifecycle)
- planner/verifier agent documentation (codex-verify.js interface unchanged)

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed

| File | Change | Reason |
|------|--------|--------|
| `plugins/ultrawork/src/scripts/codex-verify.js` | Added pre-cleanup in `main()` | Auto-delete existing output file before execution |
| `plugins/ultrawork/src/hooks/gate-enforcement.js` | Added codex rm blocking | Prevent manual deletion, guide to auto-cleanup pattern |
| `plugins/ultrawork/commands/ultrawork.md` | Removed manual rm instruction | Doc-review retry now auto-managed |
| `tests/ultrawork/codex-verify.test.js` | Added pre-cleanup verification test | Confirm output file deleted before new result written |
| `tests/ultrawork/hooks/gate-enforcement-codex-rm.test.js` | Created new test file | Comprehensive test coverage for rm blocking |

### Test Results

All 4 tasks resolved:

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| 1 | codex-verify.js output file auto-cleanup | resolved | Source inspection + unit tests confirming unlinkSync in main() |
| 2 | gate-enforcement.js codex rm blocking | resolved | Hook tests blocking rm, allowing general rm, graceful codex-offline behavior |
| 3 | ultrawork.md documentation update | resolved | Manual rm instruction removed from Step 3f |
| verify | Full verification | resolved | All unit tests pass, syntax validated |

### Execution Summary

**Doc-review retry flow transformation:**

Before:
1. Fix design doc
2. `rm /tmp/codex-doc-{id}.json` (manual deletion)
3. `codex-verify.js --mode doc-review --output /tmp/codex-doc-{id}.json`
4. Gate checks result

After:
1. Fix design doc
2. `codex-verify.js --mode doc-review --output /tmp/codex-doc-{id}.json`
   - Auto-deletes old file at start
   - Writes fresh result
3. Gate checks result

## Delta from Plan

Implementation matched design document exactly:
- Pre-cleanup location: `main()` function in codex-verify.js ✓
- Blocking location: Bash section of gate-enforcement.js ✓
- Pattern detection: regex matching `/tmp/codex-*` patterns ✓
- session-update.js internal cleanup: preserved as-is ✓
- Documentation: ultrawork.md updated with auto-cleanup note ✓

## Design Rationale

### Why pre-cleanup in main()?

1. **Race condition prevention**: Gate hook executes while codex-verify.js may still be writing. Pre-cleanup before mode execution ensures clear state.
2. **Idempotency**: Re-running codex-verify.js always produces fresh results, regardless of previous failures.
3. **Simplicity**: One place per script invocation, not split across multiple cleanup points.

### Why block manual rm?

1. **Consistency**: Follows existing session file tamper protection (session.json, tasks/, evidence/)
2. **User guidance**: Helpful message teaches pattern (auto-cleanup on re-run) instead of manual deletion
3. **Future-proof**: If cleanup logic changes, manual deletion becomes harmful; blocking prevents dependency on implementation details

### Why preserve session-update.js cleanup?

1. **Separate concern**: Internal cleanup during phase transition is script logic, not user-facing deletion
2. **Not gateable**: Hook cannot distinguish internal script cleanup from user manual deletion (both use execSync)
3. **Existing pattern**: Already implemented, tested, working; no reason to change

## Implementation Details

### codex-verify.js Pre-Cleanup

```javascript
// In main() before any mode execution
if (args.output && fs.existsSync(args.output)) {
  fs.unlinkSync(args.output); // Pre-cleanup: delete old result
}
```

Location: After argument parsing, before mode-specific execution (check/review/exec/full/doc-review)

### gate-enforcement.js Blocking

```javascript
// Detect rm command targeting codex result files
if (isRmCommand && targetsCodexFile) {
  // Block with helpful message
  outputAndExit(createPreToolUseBlock(...));
}
```

Patterns blocked:
- `rm /tmp/codex-{sessionId}.json`
- `unlink /tmp/codex-doc-{sessionId}.json`
- And similar variations

Patterns allowed:
- General `rm` commands (non-codex files)
- Read-only access to codex files (cat, jq, etc.)

## References

- **Related ADR**: [2026-02-19 Codex Doc-Review Gate](./2026-02-19-codex-doc-review-gate.md) — Gate mechanism that benefits from this auto-cleanup
- **Design Document**: `/docs/plans/2026-03-18-codex-auto-cleanup-design.md` (deleted after documentation)
