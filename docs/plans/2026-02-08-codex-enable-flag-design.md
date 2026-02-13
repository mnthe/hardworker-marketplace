# Design: Add --enable Flag to codex-verify.js

**Date**: 2026-02-08
**Session**: 50603d8a-d096-43a6-9e9f-9d5378f08da6
**Goal**: Add `--enable` parameter to codex-verify.js in both ultrawork and teamwork plugins, allowing Codex CLI experimental features (e.g., `collab`) to be enabled during verification.

## Outcome

**Status**: PASS
**Completed**: 2026-02-08
**Iterations**: 1

### Files Changed
- `plugins/ultrawork/src/scripts/codex-verify.js` (modified)
- `plugins/teamwork/src/scripts/codex-verify.js` (modified)
- `tests/ultrawork/codex-verify.test.js` (modified)
- `plugins/ultrawork/agents/verifier/AGENT.md` (modified)
- `plugins/teamwork/agents/final-verifier/AGENT.md` (modified)

---

## Overview

The Codex CLI supports `--enable <FEATURE>` as a repeatable flag to enable experimental features. The `collab` feature enables multi-agent collaboration during verification, which can improve review quality for complex scenarios.

Currently, codex-verify.js does not expose this capability. This change adds a `--enable` CLI parameter that passes through to the underlying `codex exec` invocations.

---

## Approach / Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parameter type | Comma-separated string | Simpler than adding repeatable argument support to args.js. `--enable collab,shell_snapshot` splits into array internally. Works with existing `parseArgs()`. |
| Default value | Empty (no features enabled) | Backward compatible. Existing callers unaffected. |
| Alias | `-e` | Consistent with short-alias pattern in ARG_SPEC. |
| Scope | `runCodexExec()` and `runCodexDocReview()` | Both functions invoke `codex exec` and benefit from feature enablement. `runCodexReview()` uses `codex review` which also supports `--enable` but is less impactful. |
| args.js changes | None | Standard string parameter works. No library modification needed. |
| Output schema | Unchanged | `--enable` affects Codex behavior, not output format. |
| Version bump | Patch (ultrawork 0.32.1, teamwork 3.3.1) | New optional parameter, fully backward compatible. |

---

## Architecture

### Parameter Flow

```
CLI Input:
  codex-verify.js --mode exec --enable collab,shell_snapshot ...

parseArgs() Output:
  args.enableFeatures = "collab,shell_snapshot"

main() Parsing:
  enableFeatures = ["collab", "shell_snapshot"]

Passed to runCodexExec() / runCodexDocReview():
  enableFeatures parameter (string array)

Codex exec args construction:
  ['exec', '--sandbox', 'read-only', '--enable', 'collab', '--enable', 'shell_snapshot', '-m', model, prompt]
```

### Modified Functions

**ARG_SPEC** (both ultrawork and teamwork):
```javascript
'--enable': { key: 'enableFeatures', aliases: ['-e'] }
```

**`main()`**: Parse `args.enableFeatures` into array, pass to exec/doc-review functions.

**`runCodexExec()`**: New parameter `enableFeatures = []`. Inject `--enable <feature>` pairs into args array before `-m`.

**`runCodexDocReview()`**: Same pattern as `runCodexExec()`.

### Files Modified

| File | Change |
|------|--------|
| `plugins/ultrawork/src/scripts/codex-verify.js` | Add `--enable` to ARG_SPEC, parse features, pass to exec functions |
| `plugins/teamwork/src/scripts/codex-verify.js` | Mirror ultrawork changes |
| `tests/ultrawork/codex-verify.test.js` | Add test cases for `--enable` parameter |
| `plugins/ultrawork/agents/verifier/AGENT.md` | Document `--enable` in Phase 0 |
| `plugins/teamwork/agents/final-verifier/AGENT.md` | Document `--enable` in Step 0 |
| `plugins/ultrawork/.claude-plugin/plugin.json` | Version 0.32.0 -> 0.32.1 |
| `plugins/teamwork/.claude-plugin/plugin.json` | Version 3.3.0 -> 3.3.1 |
| `.claude-plugin/marketplace.json` | Match plugin versions |
| `plugins/ultrawork/CLAUDE.md` | Document `--enable` in script inventory |
| `plugins/teamwork/CLAUDE.md` | Document `--enable` in script inventory |

---

## Testing Strategy

### Unit Tests (codex-verify.test.js)

1. **Help text includes --enable**: Verify `--help` output contains `--enable`
2. **Enable parameter accepted**: Verify script runs without error when `--enable collab` is passed
3. **Enable parameter optional**: Verify script runs without error when `--enable` is absent (backward compat)
4. **Multiple features**: Verify `--enable collab,shell_snapshot` is accepted
5. **Enable with all modes**: Verify `--enable` works with `--mode exec`, `--mode full`, `--mode doc-review`

### Integration Testing (Manual)

When codex is installed:
```bash
bun codex-verify.js --mode exec --enable collab \
  --working-dir /project --criteria "Tests pass"
```

---

## Scope

### In Scope

- Add `--enable` parameter to codex-verify.js (both plugins)
- Pass features to `runCodexExec()` and `runCodexDocReview()`
- Add tests for the new parameter
- Update agent documentation
- Version bump both plugins

### Out of Scope

- Modifying args.js library (not needed)
- Changing codex-output-schema.json (output format unchanged)
- Adding `--enable` support to `runCodexReview()` (uses `codex review`, not `codex exec`)
- Enabling features by default (opt-in only)

---

## Assumptions

1. Codex CLI `--enable` flag is stable enough for opt-in use
2. Feature names are single words without special characters
3. Comma is a safe delimiter for feature names (no feature name contains commas)
4. The `--enable` flag has no interaction with `--sandbox read-only`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `collab` feature changes behavior in future Codex versions | Medium | Feature is opt-in; users control when to enable |
| Codex versions without `--enable` support | Low | Codex handles unknown flags gracefully (error), and script already handles codex exec failures |
| Feature name validation | Low | No validation needed; invalid features cause Codex error, which is caught by existing error handling |
