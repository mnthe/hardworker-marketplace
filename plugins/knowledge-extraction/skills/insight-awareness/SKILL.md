---
name: insight-awareness
description: This skill should be used when Claude encounters valuable insights during a session that could be reused later, including when generating "★ Insight" markers, discovering code patterns, finding debugging solutions, making architectural decisions, identifying useful workflows, or learning tool usage tips. Activates automatically when insights are generated or when the user asks about "saving insights", "collecting knowledge", or "extracting patterns".
---

# Insight Awareness and Collection

## Purpose

This skill enables automatic collection of valuable insights generated during Claude sessions. When insights are produced (using the `★ Insight` format), save them to a session-specific file for later extraction into reusable components (Skills, Commands, Agents, CLAUDE.md).

## When to Collect Insights

Collect insights when any of these occur:

1. **★ Insight Marker Generated**: After producing an insight using the standard format
2. **Pattern Discovery**: Identifying a reusable code pattern or solution
3. **Debugging Solution**: Finding a non-obvious fix or root cause
4. **Architectural Decision**: Making a design choice with rationale
5. **Workflow Optimization**: Discovering an efficient process
6. **Tool Usage Tip**: Learning effective tool combinations

## Insight Collection Process

### Step 1: Identify Insight Type

Classify each insight into one of these types:

| Type | Description | Extraction Target |
|------|-------------|-------------------|
| `code-pattern` | Reusable code patterns, idioms, best practices | Skill or CLAUDE.md |
| `workflow` | Step-by-step procedures, automation processes | Command or Skill |
| `debugging` | Root cause analysis, troubleshooting techniques | Skill or CLAUDE.md |
| `architecture` | Design decisions, system structure choices | CLAUDE.md |
| `tool-usage` | Effective tool combinations, tips | Skill or CLAUDE.md |

### Step 2: Determine Storage Location

Insights are stored per-session at:

```
.claude/knowledge-extraction/sessions/{session-id}.md
```

The `session-id` is available from the environment as `CLAUDE_SESSION_ID`.

### Step 3: Save Insight to Session File

After generating an insight, immediately save it using the Write tool.

**Insight Storage Format:**

```markdown
## {ISO-8601-timestamp}

- **Type**: {type}
- **Context**: {related files, technologies, or topics}
- **Content**:
  {insight content - the actual knowledge to preserve}
```

**Example Entry:**

```markdown
## 2026-01-11T22:10:30+09:00

- **Type**: code-pattern
- **Context**: TypeScript, React hooks
- **Content**:
  When managing complex form state with multiple interdependent fields, prefer useReducer over multiple useState calls. This provides:
  - Single source of truth for form state
  - Easier state transitions with action types
  - Better testability of state logic
```

### Step 4: Ensure Directory Exists

Before writing, ensure the storage directory exists:

```bash
mkdir -p .claude/knowledge-extraction/sessions
```

### Step 5: Append or Create Session File

When saving insights:

1. **If session file exists**: Read current content, append new insight
2. **If session file doesn't exist**: Create with new insight

Use the Edit tool to append, or Write tool to create new files.

## Integration with ★ Insight Format

This plugin integrates with the existing `★ Insight` marker format used in explanatory mode:

```
★ Insight ─────────────────────────────────────
[key educational points]
─────────────────────────────────────────────────
```

**Workflow:**
1. Generate `★ Insight` block in conversation (visible to user)
2. Extract the content from the insight block
3. Save to session file with metadata

## Insight Quality Guidelines

### Worth Collecting

- Non-obvious solutions or patterns
- Project-specific conventions discovered
- Tool combinations that worked well
- Debugging techniques that solved real issues
- Architectural rationale with tradeoffs

### Not Worth Collecting

- Basic syntax or API usage (available in docs)
- Temporary workarounds without lasting value
- User-specific preferences without broader applicability
- Information already documented in project

## Session File Management

### File Naming

Session files use the session ID:
- `.claude/knowledge-extraction/sessions/abc123.md`

### File Lifecycle

1. **Created**: When first insight in session is saved
2. **Updated**: As more insights are collected
3. **Deleted**: After successful extraction via `/insights extract`

### Checking Insight Count

Count insights by counting `## ` headers (timestamp lines):

```bash
grep -c "^## " .claude/knowledge-extraction/sessions/{session-id}.md
```

## Commands Available

After collecting insights, users can manage them with:

- `/insights` - View current session's insights
- `/insights extract` - Extract insights to reusable components
- `/insights clear` - Clear current session's insights
- `/insights all` - View all sessions' insights

## Extraction Recommendations

When insights reach threshold (default: 5), recommend extraction:

> 📝 You've collected {count} insights. Consider running `/insights extract` to convert them into reusable components.

The threshold is configurable in `.claude/knowledge-extraction/config.local.md`.

## Configuration

Plugin settings stored in `.claude/knowledge-extraction/config.local.md`:

```yaml
---
threshold: 5
auto_recommend: true
output_dir: ".claude"
---
```

- **threshold**: Number of insights before recommending extraction
- **auto_recommend**: Whether to show extraction recommendations
- **output_dir**: Where to create extracted components

## Example Workflow

1. User asks about implementing authentication
2. Claude explains approach and generates insight:
   ```
   ★ Insight ─────────────────────────────────────
   JWT tokens should include minimal claims. Store sensitive data server-side,
   referenced by user ID in the token.
   ─────────────────────────────────────────────────
   ```
3. Claude saves insight to `.claude/knowledge-extraction/sessions/{session-id}.md`
4. After 5 insights, hook displays recommendation
5. User runs `/insights extract`
6. Agent analyzes and proposes adding to project's CLAUDE.md
7. User approves, insight becomes permanent project knowledge

## Key Points

1. **Save immediately**: Capture insights right after generating them
2. **Classify accurately**: Correct type helps extraction targeting
3. **Include context**: Related files/tech helps future discoverability
4. **Preserve value**: Extract the reusable knowledge, not conversation details
5. **Respect threshold**: Don't over-notify about extraction
