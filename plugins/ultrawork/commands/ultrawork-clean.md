---
name: ultrawork-clean
description: "Clean up ultrawork sessions based on age and status"
argument-hint: "[--all | --completed | --older-than N]"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js:*)"]
---

# Ultrawork Clean Command

Clean up ultrawork sessions to free disk space and remove old session data.

## Cleanup Modes

### Default Behavior (--older-than 7)

If no mode is specified, the command deletes sessions **older than 7 days** that are in terminal states (COMPLETE, CANCELLED, FAILED). Active sessions (PLANNING, EXECUTION, VERIFICATION) are always preserved.

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js"
```

### Mode: --older-than N

Delete sessions older than N days in terminal states only.

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --older-than 14
```

**Example**: `--older-than 30` deletes sessions older than 30 days that are COMPLETE, CANCELLED, or FAILED.

### Mode: --completed

Delete **all** sessions in terminal states, regardless of age.

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --completed
```

**Example**: Removes all COMPLETE, CANCELLED, and FAILED sessions immediately.

### Mode: --all

Delete **ALL** sessions, including active ones. **Use with caution.**

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js" --all
```

**Warning**: This will delete active sessions (PLANNING, EXECUTION, VERIFICATION) and may cause data loss.

## Terminal vs Active States

| State | Type | Default Behavior |
|-------|------|------------------|
| COMPLETE | Terminal | Deleted if older than 7 days |
| CANCELLED | Terminal | Deleted if older than 7 days |
| FAILED | Terminal | Deleted if older than 7 days |
| PLANNING | Active | Preserved |
| EXECUTION | Active | Preserved |
| VERIFICATION | Active | Preserved |

## Output

The script outputs JSON with cleanup results:

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

## Usage Examples

### Clean old sessions (default)
```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js"
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

## Confirmation

Before executing the cleanup, summarize what will be deleted based on the mode:

- **Default/--older-than**: "Will delete sessions older than N days in terminal states (COMPLETE, CANCELLED, FAILED)"
- **--completed**: "Will delete ALL completed sessions regardless of age"
- **--all**: "⚠️  WARNING: Will delete ALL sessions including active ones"

Display the cleanup results after execution, including:
- Number of sessions deleted
- Number of sessions preserved
- Details of deleted sessions (session_id, goal, phase, age)
