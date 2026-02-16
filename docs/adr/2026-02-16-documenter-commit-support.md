# ADR: Add Commit Support to Documenter Agent

## Status

Accepted — 2026-02-16

## Context

The documenter agent creates Architecture Decision Records (ADRs), updates permanent documentation, and deletes plan files after verification passes. However, the documenter did not commit these changes to git. The worker agent has a well-established commit workflow (Phase 6) using Angular commit conventions, selective file staging, and evidence recording. This creates inconsistency: worker agent changes are committed, but documenter changes are not.

## Decision

Mirror the worker agent's commit workflow in the documenter agent, adapted for the documenter's context (documentation changes rather than implementation changes).

### Selected Approach

Add a new Phase 4 (Commit Changes) between Phase 3 (Cleanup) and Phase 5 (Transition to COMPLETE) in the documenter workflow. The commit workflow follows these principles:

1. **Commit convention**: Angular format (`docs(adr): ...`)
2. **Scope type**: Always `docs` (documenter only creates/updates documentation)
3. **Metadata**: `[ultrawork] Session: ${CLAUDE_SESSION_ID}` in commit body
4. **Selective staging**: Only commit files the documenter created or modified (no `git add -A`)
5. **Conditional**: Skip commit if no files were changed

### Rationale

- **Consistency**: Documenter workflow now mirrors worker agent, reducing cognitive load across agents
- **Evidence tracking**: Recording commit hash in evidence provides audit trail of documentation changes
- **Safety**: Selective staging prevents accidental commits of unrelated files
- **Clarity**: Phase ordering makes documentation workflow explicit and reproducible

## Outcome

**Verification**: PASS
**Iterations**: 1

### Files Changed

- `plugins/ultrawork/agents/documenter/AGENT.md` (modified)

### Changes Made

#### Tools Addition

Added commit-related bash tools to documenter's tools list:

- `Bash(git add:*)`
- `Bash(git commit:*)`
- `Bash(git status:*)`
- `Bash(git rev-parse:*)`
- `Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js:*)` (for recording commit hash)

#### Phase Renumbering

Renumbered phases to accommodate new Phase 4:

- Phase 1: Gather Actual Outcomes (unchanged)
- Phase 2: Create ADR and Update Permanent Docs (unchanged)
- Phase 3: Cleanup (unchanged)
- **Phase 4: Commit Changes** (NEW)
- Phase 5: Transition to COMPLETE (previously Phase 4)

#### Phase 4: Commit Changes Specification

```markdown
### Phase 4: Commit Changes

**After cleanup, commit ONLY the files you created or modified:**

```bash
# Check if there are changes to commit
git status --porcelain
```

**Skip commit if `git status --porcelain` output is empty (no changes).**

⚠️ **CRITICAL: Selective File Staging**

```bash
# ❌ FORBIDDEN - NEVER use these:
git add -A        # Stages ALL files
git add .         # Stages ALL files
git add --all     # Stages ALL files
git add *         # Glob expansion - dangerous

# ✅ REQUIRED - Only add files YOU created/modified:
git add docs/adr/YYYY-MM-DD-slug.md docs/ARCHITECTURE.md && git commit -m "$(cat <<'EOF'
docs(adr): create ADR and update permanent docs

[ultrawork] Session: ${CLAUDE_SESSION_ID}

Created ADR from design document, updated permanent docs, deleted plan.

Files changed:
- docs/adr/YYYY-MM-DD-slug.md (created)
- docs/ARCHITECTURE.md (updated)
- docs/plans/design.md (deleted)
EOF
)"
```

**Commit convention:**
- **Type**: `docs` (always — documenter only creates/updates documentation)
- **Scope**: `adr` or relevant doc area
- **Format**: Angular commit convention
- **Metadata**: `[ultrawork] Session: ${CLAUDE_SESSION_ID}` in body
- **Files changed**: List ADR created, permanent docs updated, plan deleted

**Record commit hash:**

```bash
bun "{SCRIPTS_PATH}/task-update.js" --session ${CLAUDE_SESSION_ID} --id docs \
  --add-evidence "Committed: $(git rev-parse --short HEAD)"
```

**Skip commit if:**
- No files changed (`git status --porcelain` is empty)
- Inside a submodule or worktree where commits are discouraged
```

#### Rules Addition

Added three new rules to the documenter's operational guidelines:

- **Rule 9**: "Commit after documentation work — Always commit changes after Phase 3 cleanup, before transitioning to COMPLETE"
- **Rule 10**: "Selective staging — ONLY `git add <specific-files>`, NEVER `git add -A` or `git add .`"
- **Rule 11**: "Record commit hash — Add evidence of the commit hash before transitioning to COMPLETE"

### Test Results

All existing tests continue to pass:

```
Command: bun test tests/ultrawork/ 2>&1
Exit code: 0
Result: All tests passed
```

## Execution Summary

| ID | Task | Status | Key Evidence |
|----|------|--------|--------------|
| 1 | Add commit workflow to documenter agent | resolved | AGENT.md modified with Phase 4 commit workflow (124 lines added), tools updated with git commands, rules 9-11 added |
| verify | Final verification of documenter commit support | resolved | All tests pass, git diff confirms documenter.AGENT.md is only modified file, implementation matches design |

## Delta from Plan

Implementation matched plan exactly. No deviations or additional tasks.

The design doc specified:

1. ✓ Update documenter AGENT.md tools list with git commands
2. ✓ Renumber Phase 4 (Transition) to Phase 5
3. ✓ Add new Phase 4 (Commit Changes) between Phase 3 and Phase 5
4. ✓ Add commit-related rules (commit on success, selective staging, record commit hash)

All were completed as specified.

## Impact

This change ensures documenter agent workflows are now symmetric with worker agent workflows:

| Aspect | Worker | Documenter |
|--------|--------|-----------|
| Commit support | ✓ Phase 6 | ✓ Phase 4 |
| Angular convention | ✓ Yes | ✓ Yes |
| Selective staging | ✓ Yes | ✓ Yes |
| Evidence recording | ✓ Yes | ✓ Yes |

The documenter agent can now commit ADR creation and permanent doc updates automatically, creating a complete audit trail from planning through documentation completion.
