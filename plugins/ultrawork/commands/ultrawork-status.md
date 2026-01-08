---
name: ultrawork-status
description: "Check current ultrawork session status"
argument-hint: "[--help]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-status.sh:*)"]
---

# Ultrawork Status Command

Execute the status script:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-status.sh"
```

If additional context is needed, read the session file from the output path.

Interpret the session data and provide:
- Current phase (PLANNING/EXECUTION/VERIFICATION/COMPLETE)
- Iteration (current/max)
- Task progress (completed/total)
- Evidence collection status
- Any blockers or issues

**Example output:**
```markdown
# Ultrawork Status

**Session:** abc123
**Goal:** Implement user auth
**Phase:** EXECUTION
**Iteration:** 2/5 (retry after verification failure)

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
