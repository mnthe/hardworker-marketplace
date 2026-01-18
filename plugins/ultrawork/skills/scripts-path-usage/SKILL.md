---
name: scripts-path-usage
description: |
  This skill provides guidance for ultrawork agents on using SCRIPTS_PATH and accessing session data via scripts.
  Required knowledge for all ultrawork agents (explorer, planner, worker, verifier, reviewer, scope-analyzer).
---

# Scripts Path Usage

## What is SCRIPTS_PATH?

`SCRIPTS_PATH` is the expanded absolute path of `${CLAUDE_PLUGIN_ROOT}/src/scripts`.

Your prompt includes it like this:
```
SCRIPTS_PATH: /Users/name/.claude/plugins/cache/ultrawork/0.25.0/src/scripts
```

Use this path to call Bun scripts.

## Core Rules

1. **JSON via scripts, Markdown via Read** - Use `session-get.js`, `task-get.js` for JSON access
2. **Use `--field` for efficiency** - `session-get.js --field phase` returns only what you need

## Quick Reference

| Data | Access Method |
|------|---------------|
| session.json | `bun "{SCRIPTS_PATH}/session-get.js" --session ${CLAUDE_SESSION_ID}` |
| tasks/*.json | `bun "{SCRIPTS_PATH}/task-get.js" --session ${CLAUDE_SESSION_ID} --id 1` |
| exploration/*.md | `Read("~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}/exploration/overview.md")` |
