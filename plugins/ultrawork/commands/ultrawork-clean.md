---
name: ultrawork-clean
description: "Clean current ultrawork session or batch cleanup old sessions"
argument-hint: "[--session ID] | [--all | --completed | --older-than N]"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js:*)"]
---

# Ultrawork Clean Command

Two modes:
1. **Single session clean** (default): Delete current session for fresh `/ultrawork` start
2. **Batch cleanup**: Delete multiple sessions based on criteria

---

## Single Session Clean (Default)

With no batch flags, deletes the current session so you can run `/ultrawork` fresh.

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --session "${CLAUDE_SESSION_ID}"
```

**Output:**
```json
{
  "success": true,
  "session_id": "abc-123",
  "goal": "Add user auth",
  "phase": "PLANNING",
  "message": "Session deleted. Run /ultrawork to start fresh."
}
```

After cleanup, `/ultrawork "new goal"` will start a completely fresh session.

---

## Batch Cleanup Modes

### Mode: --older-than N

Delete sessions older than N days in terminal states only.

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --older-than 7
```

### Mode: --completed

Delete **all** sessions in terminal states, regardless of age.

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --completed
```

### Mode: --all

Delete **ALL** sessions, including active ones. **Use with caution.**

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --all
```

**Warning**: This will delete active sessions (PLANNING, EXECUTION, VERIFICATION) and may cause data loss.

---

## Terminal vs Active States

| State | Type | Batch Behavior |
|-------|------|----------------|
| COMPLETE | Terminal | Deleted by --completed, --older-than, --all |
| CANCELLED | Terminal | Deleted by --completed, --older-than, --all |
| FAILED | Terminal | Deleted by --completed, --older-than, --all |
| PLANNING | Active | Only deleted by --all |
| EXECUTION | Active | Only deleted by --all |
| VERIFICATION | Active | Only deleted by --all |

---

## Output Formats

### Single Session Clean
```json
{
  "success": true,
  "session_id": "abc-123",
  "goal": "Add user auth",
  "phase": "PLANNING",
  "message": "Session deleted. Run /ultrawork to start fresh."
}
```

### Batch Cleanup
```json
{
  "deleted_count": 5,
  "deleted_sessions": [
    {
      "session_id": "abc-123",
      "goal": "Add user auth",
      "phase": "COMPLETE",
      "age_days": 10
    }
  ],
  "preserved_count": 2
}
```

---

## Usage Examples

### Clean current session (start fresh)
```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --session "${CLAUDE_SESSION_ID}"
```

### Clean sessions older than 30 days
```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --older-than 30
```

### Clean all completed sessions
```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --completed
```

### Clean ALL sessions (dangerous)
```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --all
```
