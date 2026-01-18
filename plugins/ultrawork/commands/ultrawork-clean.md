---
name: ultrawork-clean
description: "Clean current ultrawork session or batch cleanup old sessions"
argument-hint: "[--all | --completed | --older-than N]"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-clean.js:*)"]
---

# Ultrawork Clean Command

## Overview

Clean ultrawork sessions. Two modes:
1. **Single session clean** (default): Delete current session for fresh `/ultrawork` start
2. **Batch cleanup**: Delete multiple sessions based on criteria (requires explicit flags)

---

## Step 1: Parse Arguments

Parse command arguments to determine cleanup mode:

| Argument | Mode | Behavior |
|----------|------|----------|
| (no args) | Single session | Delete ONLY current session (`CLAUDE_SESSION_ID`) |
| `--older-than N` | Batch | Delete terminal-state sessions older than N days |
| `--completed` | Batch | Delete all terminal-state sessions |
| `--all` | Batch | Delete ALL sessions (dangerous!) |

**IMPORTANT**: Without batch flags (`--all`, `--completed`, `--older-than`), ONLY the current session is deleted.

---

## Step 2: Execute Cleanup

### Default Mode (No Arguments) - Single Session Clean

**This is the DEFAULT behavior when `/ultrawork-clean` is run without arguments.**

Deletes ONLY the current session (identified by `CLAUDE_SESSION_ID`) to allow a fresh `/ultrawork` start.

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

bun "${SCRIPTS}/ultrawork-clean.js" --session "${CLAUDE_SESSION_ID}"
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

### Batch Mode: --older-than N

Delete sessions older than N days **in terminal states only** (COMPLETE, CANCELLED, FAILED).

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

bun "${SCRIPTS}/ultrawork-clean.js" --older-than ${N}
```

### Batch Mode: --completed

Delete **all** sessions in terminal states, regardless of age.

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

bun "${SCRIPTS}/ultrawork-clean.js" --completed
```

### Batch Mode: --all

Delete **ALL** sessions, including active ones. **Use with extreme caution.**

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

bun "${SCRIPTS}/ultrawork-clean.js" --all
```

**Warning**: This will delete active sessions (PLANNING, EXECUTION, VERIFICATION) and may cause data loss.

**Batch output format:**
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

## Step 3: Display Results

Format the cleanup result for the user:

**Single session clean:**
```
Session {session_id} deleted.
- Goal: {goal}
- Phase: {phase}

Run /ultrawork to start fresh.
```

**Batch cleanup:**
```
{deleted_count} sessions deleted, {preserved_count} preserved.

Deleted:
{list of deleted sessions with goal and phase}
```

---

## Reference: Terminal vs Active States

| State | Type | Batch Behavior |
|-------|------|----------------|
| COMPLETE | Terminal | Deleted by --completed, --older-than, --all |
| CANCELLED | Terminal | Deleted by --completed, --older-than, --all |
| FAILED | Terminal | Deleted by --completed, --older-than, --all |
| PLANNING | Active | Only deleted by --all |
| EXECUTION | Active | Only deleted by --all |
| VERIFICATION | Active | Only deleted by --all |

---

## Usage Examples

```bash
# Clean current session only (DEFAULT - no flags needed)
/ultrawork-clean

# Clean sessions older than 30 days (terminal states only)
/ultrawork-clean --older-than 30

# Clean all completed/cancelled/failed sessions
/ultrawork-clean --completed

# Clean ALL sessions (dangerous - includes active sessions)
/ultrawork-clean --all
```
