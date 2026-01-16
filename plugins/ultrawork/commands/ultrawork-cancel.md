---
name: ultrawork-cancel
description: "Cancel current ultrawork session"
argument-hint: "[--help]"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-cancel.js:*)"]
---

# Ultrawork Cancel Command

## Session ID Handling

The session_id is provided by the hook via systemMessage as `CLAUDE_SESSION_ID`.
You MUST pass it to the script via `--session` flag.

## Execution

First, confirm with the user:

```python
AskUserQuestion(questions=[{
  "question": "Cancel the current ultrawork session?",
  "header": "Confirm",
  "options": [
    {"label": "Yes, cancel", "description": "Mark session as cancelled, preserve history"},
    {"label": "No, continue", "description": "Keep working on current session"}
  ],
  "multiSelect": False
}])
```

If confirmed, execute the cancel script with `--session`:

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-cancel.js" --session ${CLAUDE_SESSION_ID}
```

The script will:
- Update session.json phase to CANCELLED
- Preserve all history and evidence
- Allow starting a new session
