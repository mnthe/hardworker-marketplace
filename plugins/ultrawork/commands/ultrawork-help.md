---
name: ultrawork-help
description: "Show ultrawork plugin help and available commands"
allowed-tools: []
---

# Ultrawork Help

Explain the following to the user:

## What is Ultrawork?

Ultrawork is a **strict verification-first development mode** that enforces rigorous practices:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ✓ Mandatory planning via planner agent                   │
│   ✓ Success criteria defined BEFORE implementation          │
│   ✓ Evidence collection for every criterion                │
│   ✓ Zero tolerance for partial completion                  │
│   ✓ Parallel worker execution for maximum speed            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/ultrawork-plan <goal>` | Interactive planning → creates plan document |
| `/ultrawork-exec [file]` | Execute plan document |
| `/ultrawork <goal>` | Full auto mode (plan + exec) |
| `/ultrawork-status` | Check current phase and progress |
| `/ultrawork-evidence` | View collected evidence |
| `/ultrawork-clean` | Clean up project workspace |
| `/ultrawork-help` | Show this help |

## Recommended Workflow

```
/ultrawork-plan "implement auth"   # Interactive planning with user
→ Review/edit docs/ultrawork-plan.md
/ultrawork-exec                     # Execute approved plan
```

## Options (for /ultrawork)

| Option | Description |
|--------|-------------|
| `--max-workers N` | Limit parallel workers |
| `--skip-verify` | Skip verification phase (fast mode) |
| `--plan-only` | Only run planner, don't execute |
| `--force` | Force start even if session exists |
| `--resume` | Resume cancelled/failed session |

## Workflow

```
/ultrawork "implement feature X"
         │
         ▼
┌─────────────────────────────────────────┐
│ 1. PLANNING                             │
│    → Planner agent (opus) creates tasks │
│    → Spawns explorers for context       │
│    → Defines success criteria           │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ 2. EXECUTION                            │
│    → Workers implement in parallel      │
│    → Each worker collects evidence      │
│    → Tasks unblock as deps complete     │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ 3. VERIFICATION                         │
│    → Verifier checks all evidence       │
│    → Scans for blocked patterns         │
│    → Runs tests and builds              │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ 4. COMPLETE                             │
│    → All criteria met with evidence     │
│    → Summary reported                   │
└─────────────────────────────────────────┘
```

## Agents Used

| Agent | Model | Purpose |
|-------|-------|---------|
| `planner` | opus | Task decomposition, dependencies |
| `worker` | sonnet | Implementation execution |
| `verifier` | opus | Final validation |
| `reviewer` | sonnet | Code review (optional) |

## Zero Tolerance Rules

These phrases **BLOCK** completion:

- "should work" → Require evidence
- "basic implementation" → Complete work only
- "TODO" / "FIXME" → Finish everything
- "you can extend" → Not your job

## Examples

```bash
# Feature implementation
/ultrawork implement user authentication with JWT

# With worker limit
/ultrawork --max-workers 3 add unit tests for all modules

# Plan only (dry run)
/ultrawork --plan-only refactor database queries

# Fast mode
/ultrawork --skip-verify fix typo in README

# Resume session
/ultrawork --resume
```

## State File

Session data stored in:
```
~/.claude/ultrawork/sessions/{session-id}/session.json
```

Session ID is provided by Claude Code via hooks.
