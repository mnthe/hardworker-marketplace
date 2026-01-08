---
name: ultrawork-cancel
description: "Cancel current ultrawork session"
argument-hint: "[--help]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-cancel.sh:*)"]
---

# Ultrawork Cancel Command

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

If confirmed, execute the cancel script:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-cancel.sh"
```

The script will:
- Update session.json phase to CANCELLED
- Preserve all history and evidence
- Allow starting a new session
