---
name: scripts-path-usage
description: |
  This skill provides guidance for ultrawork agents on using SCRIPTS_PATH and accessing session data via scripts.
  Required knowledge for all ultrawork agents (explorer, planner, worker, verifier, reviewer, scope-analyzer).
---

# Scripts Path Usage for Ultrawork Agents

## SCRIPTS_PATH is Text, Not a Variable

**CRITICAL**: `SCRIPTS_PATH` in your prompt is **plain text**, not a shell environment variable.

```bash
# ❌ WRONG - shell cannot expand $SCRIPTS_PATH
bun "$SCRIPTS_PATH/task-get.js" --session ...

# ✅ CORRECT - substitute the actual value from your prompt
bun "/actual/path/from/prompt/task-get.js" --session ...
```

**Why this matters**: Your prompt contains `SCRIPTS_PATH: /some/path`. Extract that path value and use it directly in bash commands.

---

## Data Access Rule

**Never use Read tool on JSON files. Always use scripts.**

| Data Type | Script | Direct Read |
|-----------|--------|-------------|
| session.json | `session-get.js` | ❌ Never |
| context.json | `context-get.js` | ❌ Never |
| tasks/*.json | `task-get.js`, `task-list.js` | ❌ Never |
| exploration/*.md | - | ✅ OK |
| docs/plans/*.md | - | ✅ OK |

---

## Why Scripts Over Direct Read?

1. **Token efficiency**: JSON wastes tokens on structure (`{`, `"key":`, brackets)
2. **Field extraction**: Scripts return only needed data (`--field status`)
3. **AI-friendly output**: `--summary` generates markdown
4. **Validation**: Consistent error handling
5. **Abstraction**: Storage changes don't affect agent code

---

## Common Script Patterns

### Session Data

```bash
# Get full session
bun "$SCRIPTS_PATH/session-get.js" --session ${CLAUDE_SESSION_ID}

# Get specific field
bun "$SCRIPTS_PATH/session-get.js" --session ${CLAUDE_SESSION_ID} --field phase
bun "$SCRIPTS_PATH/session-get.js" --session ${CLAUDE_SESSION_ID} --field goal
bun "$SCRIPTS_PATH/session-get.js" --session ${CLAUDE_SESSION_ID} --field working_dir
```

### Task Data

```bash
# List all tasks
bun "$SCRIPTS_PATH/task-list.js" --session ${CLAUDE_SESSION_ID} --format json

# Get single task
bun "$SCRIPTS_PATH/task-get.js" --session ${CLAUDE_SESSION_ID} --id 1

# Update task
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --id 1 \
  --status resolved --add-evidence "npm test: 15/15 passed"
```

### Context Data

```bash
# Get context summary
bun "$SCRIPTS_PATH/context-get.js" --session ${CLAUDE_SESSION_ID} --summary

# Add exploration result
bun "$SCRIPTS_PATH/context-add.js" --session ${CLAUDE_SESSION_ID} \
  --explorer-id "exp-1" --summary "Found auth patterns"
```

---

## Session Directory vs Working Directory

| Path | Location | Purpose |
|------|----------|---------|
| `$SESSION_DIR` | `~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}/` | Session metadata |
| `$WORKING_DIR` | Project directory (from `session.working_dir`) | Project files |

**Important**: Session files (exploration, tasks) go to `$SESSION_DIR`. Project deliverables (code, docs) go to `$WORKING_DIR`.

```bash
# Get session directory
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}

# Get working directory
WORKING_DIR=$(bun "$SCRIPTS_PATH/session-get.js" --session ${CLAUDE_SESSION_ID} --field working_dir)
```
