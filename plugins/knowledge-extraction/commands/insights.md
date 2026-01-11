---
name: insights
description: View and manage collected insights from Claude sessions
argument-hint: "[extract|clear|all]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Task
  - Bash
---

Manage insights collected from the current session.

## Determine Action

Parse the argument to determine which action to perform:

| Argument | Action |
|----------|--------|
| (none) | Show current session's insights |
| `extract` | Launch insight-extractor agent to convert insights |
| `clear` | Delete current session's insights |
| `all` | Show all sessions' insights |

Argument provided: `$ARGUMENTS`

## Action: Show Current Session Insights (default)

If no argument provided or argument is empty:

1. Get current session ID from `CLAUDE_SESSION_ID` environment variable
2. Check if insights file exists at `.claude/knowledge-extraction/{session-id}/insights.md`
3. If exists, read and display the contents
4. If not exists, inform that no insights have been collected this session

**Display format:**
```
📝 Insights for session {session-id}

{content of insights file}

Total: {count} insight(s)

Tip: Run `/insights extract` to convert these into reusable components.
```

## Action: Extract (`/insights extract`)

If argument is "extract":

1. Check if insights file exists at `.claude/knowledge-extraction/{session-id}/insights.md`
2. If no insights, inform user
3. If insights exist, launch the `insight-extractor` agent using Task tool:
   - Agent analyzes collected insights
   - Proposes extraction targets (Skill, Command, Agent, CLAUDE.md)
   - Presents proposals for user approval
   - Creates approved components
   - Cleans up session directory after successful extraction

## Action: Clear (`/insights clear`)

If argument is "clear":

1. Get current session ID
2. Check if session directory exists at `.claude/knowledge-extraction/{session-id}/`
3. If exists:
   - Count insights in insights.md
   - Delete the entire session directory (insights.md + state.json)
   - Confirm deletion
4. If not exists, inform no insights to clear

**Output:**
```
🗑️ Cleared {count} insight(s) from session {session-id}.
```

## Action: Show All Sessions (`/insights all`)

If argument is "all":

1. List all directories in `.claude/knowledge-extraction/` (excluding config.local.md)
2. For each session directory:
   - Check if insights.md exists
   - Count insights (lines starting with `## `)
   - Show summary
3. Display aggregated view

**Display format:**
```
📚 All Collected Insights

Session {id-1}: {count} insight(s)
Session {id-2}: {count} insight(s)
...

Total: {total} insight(s) across {n} session(s)

Tip: Use `/insights` to view current session, `/insights extract` to convert.
```

## Storage Structure

```
.claude/knowledge-extraction/
├── config.local.md              # Configuration (optional)
└── {session-id}/
    ├── state.json               # Processing state
    └── insights.md              # Collected insights with context
```

## Error Handling

- **No CLAUDE_SESSION_ID**: Inform that session ID is not available
- **Directory doesn't exist**: Create it if needed for operations
- **Invalid argument**: Show usage help

**Usage help:**
```
Usage: /insights [action]

Actions:
  (none)   - Show current session's insights
  extract  - Extract insights into reusable components
  clear    - Clear current session's insights
  all      - Show all sessions' insights
```
