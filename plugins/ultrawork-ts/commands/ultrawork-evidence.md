---
name: ultrawork-evidence
description: "Show collected evidence for ultrawork session"
argument-hint: "[--help]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/dist/scripts/ultrawork-evidence.js:*)"]
---

# Ultrawork Evidence Command

## Session ID Handling

The session_id is provided by the hook via systemMessage as `CLAUDE_SESSION_ID`.
You MUST pass it to the script via `--session` flag.

## Execution

Execute the evidence script with `--session`:

```!
"${CLAUDE_PLUGIN_ROOT}/dist/scripts/ultrawork-evidence.js" --session {SESSION_ID}
```

After displaying raw evidence, interpret and summarize:

## Evidence Summary Format

```
Task: {task name}
───────────────────────────────
✓ Criteria: {criterion}
  Evidence: {command/test}
  Result: {output}

⏳ Criteria: {criterion}
  Status: pending

✗ Criteria: {criterion}
  Error: {what went wrong}
```

## Verification Status

- Count verified criteria
- Count pending criteria
- Highlight any failures
- Note blocked patterns found
