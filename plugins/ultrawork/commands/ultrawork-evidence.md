---
name: ultrawork-evidence
description: "Show collected evidence for ultrawork session"
argument-hint: "[--help]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-evidence.sh:*)"]
---

# Ultrawork Evidence Command

Execute the evidence script:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/ultrawork-evidence.sh"
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
