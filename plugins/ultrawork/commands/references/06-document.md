# Documentation Phase Reference

**Used by**: `ultrawork.md`, `ultrawork-exec.md`

**Purpose**: Transform the design document from a planning artifact into a permanent implementation record after verification passes.

---

## Phase Transition

After verifier returns PASS, before marking COMPLETE:

```
VERIFICATION (PASS) → DOCUMENTATION → COMPLETE
```

---

## When to Run

- **Always** after verification PASS (if a design document exists)
- **Skip** if no design document was created (e.g., trivial tasks without planning)
- **Skip** if `--auto` mode and no design doc path in session

---

## Spawn Documenter

```python
# Get design doc path
design_doc = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --field plan.design_doc')
working_dir = Bash(f'bun "{CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session {SESSION_ID} --field working_dir')

# Only run if design doc exists
if design_doc and design_doc != "null":
    Task(
        subagent_type="ultrawork:documenter",
        model="haiku",
        prompt=f"""
CLAUDE_SESSION_ID: {SESSION_ID}
SCRIPTS_PATH: {CLAUDE_PLUGIN_ROOT}/src/scripts
WORKING_DIR: {working_dir}
DESIGN_DOC: {design_doc}
"""
    )
```

---

## What Changes in the Design Document

### Removed/Condensed

| Section | Action | Reason |
|---------|--------|--------|
| Unselected options in Approach Selection | Condense to one-line | No longer relevant for record |
| Risks & Mitigations | Remove speculative risks | Only keep encountered risks |
| Fallback Strategies | Remove if unused | Speculative content |
| Documentation plan | Remove | Was a todo list |

### Kept (ADR Value)

| Section | Action | Reason |
|---------|--------|--------|
| Overview | Update if scope changed | Core context |
| Approach Selection (selected) | Keep with rationale | ADR core |
| Decisions | Keep all with rationale | ADR core |
| Architecture | Update to match reality | Reference value |

### Added

| Section | Content | Source |
|---------|---------|--------|
| Outcome | Status, date, iterations, files changed, test results | Evidence + git diff |
| Execution Summary | Task table with status and key evidence | Task JSON |
| Delta from Plan | What differed from original plan | Comparison |

---

## Example Transformation

### Before (Planning Artifact)

```markdown
# Design: User Authentication

## Overview
Add JWT-based authentication to the API.

## Approach Selection
### Considered Options
| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| JWT (Selected) | Stateless | Token management | Best fit |
| Session-based | Simple | Requires DB | Not scalable |
| OAuth only | Delegated | External dependency | Too limited |

### Selected: JWT
**Rationale**: Stateless, scales horizontally.

## Decisions
### Token Storage
- **Choice**: httpOnly cookies
- **Rationale**: XSS protection
- **Asked User**: Yes

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Token theft | High | Short expiry + refresh tokens |
| Key rotation | Medium | Use env vars |
```

### After (Implementation Record)

```markdown
# Design: User Authentication

## Overview
Added JWT-based authentication to the API.

## Outcome

**Status**: PASS
**Completed**: 2026-02-13
**Iterations**: 1

### Files Changed
- `src/middleware/auth.ts` (created)
- `src/routes/login.ts` (created)
- `tests/auth.test.ts` (created)

### Test Results
- 8/8 tests passed, exit code 0

## Approach Selection

### Selected: JWT
**Rationale**: Stateless, scales horizontally.
**Alternatives considered**: Session-based, OAuth only

## Decisions
### Token Storage
- **Choice**: httpOnly cookies
- **Rationale**: XSS protection
- **Asked User**: Yes

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1  | Setup JWT middleware | resolved | auth.ts created, 5/5 tests pass |
| 2  | Login endpoint | resolved | POST /login returns 200 with token |
| verify | Verification | resolved | All criteria met |
```

---

## Documenter Agent

- **Model**: haiku (document transformation is lightweight)
- **Tools**: Read, Edit, Bash (scripts only), Glob, Grep
- **Output**: Updated design document in-place
- **Duration**: Fast (~30s)
