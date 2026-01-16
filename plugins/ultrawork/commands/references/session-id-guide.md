# Session ID Handling Guide

**All scripts require `--session <id>` flag.**

## Using CLAUDE_SESSION_ID

Claude Code v2.1.9+ automatically replaces `${CLAUDE_SESSION_ID}` with the actual session UUID in all tool inputs.

```bash
# ✅ CORRECT - use the placeholder (auto-replaced)
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID}

# Also correct in combined commands
SESSION_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --dir)
```

## Reading Session State

```bash
# Get full session JSON
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID}

# Get specific field
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field phase
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field exploration_stage
```

## Getting Session Directory

```bash
SESSION_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --dir)
# Returns: ~/.claude/ultrawork/sessions/{session-id}
```
