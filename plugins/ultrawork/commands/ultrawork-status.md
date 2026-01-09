---
name: ultrawork-status
description: "Check current ultrawork session status"
argument-hint: "[--all] [--help]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-status.sh:*)"]
---

# Ultrawork Status Command

## Session ID Handling

The session_id is provided by the hook via systemMessage as `CLAUDE_SESSION_ID`.
You MUST pass it to the script via `--session` flag.

## Execution

Execute the status script with `--session`:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-status.sh" --session {SESSION_ID}
```

Or list all sessions:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-status.sh" --all
```

If additional context is needed, read the session file from the output path.

Interpret the session data and provide:
- Current phase (PLANNING/EXECUTION/VERIFICATION/COMPLETE)
- Exploration stage
- Task progress (completed/total)
- Evidence collection status
- Any blockers or issues

**Example output:**
```markdown
# Ultrawork Status

**Session:** abc123
**Goal:** Implement user auth
**Phase:** EXECUTION
**Exploration:** complete

## Tasks
| ID | Task | Status |
|----|------|--------|
| 1 | Setup schema | ✓ completed |
| 2 | Build API | → in_progress |
| verify | Verification | ⏳ pending |

## Evidence
- 3 test outputs collected
- 2 file changes recorded
```
