# Documentation Phase Reference

**Used by**: `ultrawork.md`, `ultrawork-exec.md`

**Purpose**: Create an ADR from the design document, update permanent project docs, and delete the plan file after verification passes.

---

## Phase Transition

Verifier triggers the transition to DOCUMENTATION on PASS:

```bash
# Verifier does this on PASS (two-step protocol):
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --verifier-passed
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase DOCUMENTATION
```

Documenter triggers the transition to COMPLETE when done:

```bash
# Documenter does this when done (two-step protocol):
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --documenter-completed
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase COMPLETE
```

Flow: `VERIFICATION → (verifier PASS) → DOCUMENTATION → (documenter done) → COMPLETE`

---

## When to Run

- **Always** after verification PASS (if a design document exists)
- **Skip** if no design document was created (e.g., trivial tasks without planning)
- **Skip** if `plan.design_doc` is `null` in session state

---

## Prerequisite: Design Doc Path in Session State

The documentation phase depends on `plan.design_doc` being set in session state. This is stored during the planning phase:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} \
  --design-doc "$DESIGN_PATH"
```

**If this step was missed during planning, the documentation phase will be skipped.**

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

## What the Documenter Does

### Phase 1: Gather

Collect evidence, task results, and git diff — same as before.

### Phase 2: Create ADR + Update Permanent Docs + Extract Lessons

#### Phase 2-1: Create ADR

| Aspect | Detail |
|--------|--------|
| Location | `docs/adr/YYYY-MM-DD-{slug}.md` |
| Source | Design doc decisions + task evidence + git diff |
| Format | Standard ADR (Status, Context, Decision, Outcome) |

**ADR content extracted from design doc:**

| Design Doc Section | ADR Section | Action |
|--------------------|-------------|--------|
| Overview | Context | Brief problem statement |
| Approach Selection (selected) | Decision | Selected approach with rationale |
| Decisions | Decision | All key decisions with rationale |
| — | Outcome | Status, files changed, test results (from evidence) |
| — | Execution Summary | Task table with evidence |
| — | Delta from Plan | What differed from original plan |

**Sections NOT included in ADR:**
- Unselected approach options (condense to "Alternatives considered: X, Y")
- Speculative risks that didn't materialize
- Fallback strategies that weren't triggered
- Documentation plan / todo items

#### Phase 2-2: Update Living Docs (Drift Repair)

| Aspect | Detail |
|--------|--------|
| Scope | Only docs that **already exist** in `docs/` |
| Targets | ARCHITECTURE.md, API.md, README.md, etc. |
| Action | Surgical Edit updates with implementation details |
| Skip if | No relevant permanent docs exist |

#### Phase 2-3: Lessons Extraction

| Aspect | Detail |
|--------|--------|
| Scope | Extract reusable insights from session evidence and decisions |
| Targets | Patterns, anti-patterns, decision rationale worth preserving |
| Action | Record lessons learned for future sessions |
| Skip if | Session was trivial with no notable decisions |

### Phase 3: Cleanup

| Action | Command |
|--------|---------|
| Delete plan document | `rm "{DESIGN_DOC}"` |
| Remove empty plans dir | `rmdir "{WORKING_DIR}/docs/plans" 2>/dev/null \|\| true` |

---

## Example Transformation

### Before: Plan Document

`docs/plans/2026-02-14-user-auth-design.md`:

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

### After: ADR + Plan Deleted

`docs/adr/2026-02-14-user-auth.md` (created):

```markdown
# ADR: User Authentication

## Status

Accepted — 2026-02-14

## Context

The API needed JWT-based authentication for stateless, horizontally scalable auth.

## Decision

**Approach**: JWT with httpOnly cookie storage.
- **Rationale**: Stateless, scales horizontally, XSS protection via httpOnly cookies.
- **Alternatives considered**: Session-based, OAuth only.

### Token Storage
- **Choice**: httpOnly cookies
- **Rationale**: XSS protection
- **Asked User**: Yes

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed
- `src/middleware/auth.ts` (created)
- `src/routes/login.ts` (created)
- `tests/auth.test.ts` (created)

### Test Results
- 8/8 tests passed, exit code 0

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1  | Setup JWT middleware | resolved | auth.ts created, 5/5 tests pass |
| 2  | Login endpoint | resolved | POST /login returns 200 with token |
| verify | Verification | resolved | All criteria met |

## Delta from Plan

- Implementation matched plan.
```

`docs/plans/2026-02-14-user-auth-design.md` → **deleted**

---

## Documenter Agent

- **Model**: haiku (document transformation is lightweight)
- **Tools**: Read, Write, Edit, Bash (rm, rmdir, git diff, mkdir), Glob, Grep, scripts
- **Output**: ADR file in `docs/adr/`, optional permanent doc updates, plan file deleted
