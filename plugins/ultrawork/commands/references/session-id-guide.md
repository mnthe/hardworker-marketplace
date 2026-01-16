# Session ID Handling Guide

**All scripts require `--session <id>` flag.**

## Where to get SESSION_ID

Look for this message in system-reminder (provided by SessionStart hook):
```
CLAUDE_SESSION_ID: 37b6a60f-8e3e-4631-8f62-8eaf3d235642
Use this when calling ultrawork scripts: --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642
```

**IMPORTANT: You MUST extract the actual UUID value and use it directly. DO NOT use placeholder strings like `${CLAUDE_SESSION_ID}` or `$SESSION_ID`.**

## Correct usage example

If the hook says `CLAUDE_SESSION_ID: 37b6a60f-8e3e-4631-8f62-8eaf3d235642`, then:

```bash
# ✅ CORRECT - use the actual value
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642 "goal"

# ❌ WRONG - do not use placeholders
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session ${CLAUDE_SESSION_ID} "goal"
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/setup-ultrawork.js" --session $SESSION_ID "goal"
```

## Getting Session Directory

Get session directory via script:

```bash
SESSION_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --dir)
```

For example, if `SESSION_ID` is `37b6a60f-8e3e-4631-8f62-8eaf3d235642`:

```bash
SESSION_DIR=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session 37b6a60f-8e3e-4631-8f62-8eaf3d235642 --dir)
# Returns: ~/.claude/ultrawork/sessions/37b6a60f-8e3e-4631-8f62-8eaf3d235642
```

## Reading Session State

```bash
# Get full session JSON
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID}

# Get specific field
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field phase
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field exploration_stage
```
