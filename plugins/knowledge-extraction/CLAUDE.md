# knowledge-extraction

Bun-based plugin for collecting and extracting insights from Claude sessions.

## File Structure

- commands/insights.md - `/insights` command for viewing/managing insights
- skills/insight-awareness/ - Skill for recognizing and saving insights
- src/hooks/*.js - Lifecycle hooks for automatic reminders
- hooks/hooks.json - Hook configuration

## No Build Step Required

Scripts run directly from source. No compilation needed.

## Hook Configuration

**IMPORTANT**: hooks.json must use explicit `bun` prefix for cross-platform compatibility.

```json
// WRONG - shebang doesn't work on Windows
"command": "${CLAUDE_PLUGIN_ROOT}/src/hooks/check-insights.js"

// CORRECT - explicit bun invocation
"command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/check-insights.js"
```

Hook paths: `src/hooks/*.js`

## Component Inventory

### Scripts

Knowledge-extraction has NO scripts. All operations are performed through:
- Commands (insights.md)
- Skills (insight-awareness)
- Hooks (automatic reminders)

### Hooks

| Hook        | File               | Trigger                         | Purpose                                                |
| ----------- | ------------------ | ------------------------------- | ------------------------------------------------------ |
| Stop        | check-insights.js  | Session end                     | Reminds user to extract insights if any were collected |
| PostToolUse | check-threshold.js | Write tool used on session file | Checks if insight count reached threshold (default: 5) |

**Hook behavior:**
- check-insights.js: Counts insights in session file, displays reminder if count > 0
- check-threshold.js: Monitors writes to `.claude/knowledge-extraction/sessions/*.md`, displays reminder if count >= threshold

**Configuration:**
- Threshold: Set in `.claude/knowledge-extraction/config.local.md` (default: 5)
- Auto-recommend: Enable/disable threshold reminders (default: true)

### Agents

Knowledge-extraction has NO agents. The `insight-extractor` agent referenced in commands/insights.md does not exist yet.

**Planned agents:**
- insight-extractor - Analyzes insights and proposes extraction targets (Skill, Command, Agent, CLAUDE.md)

### Skills

| Skill             | Location                          | Purpose                                                    |
| ----------------- | --------------------------------- | ---------------------------------------------------------- |
| insight-awareness | skills/insight-awareness/SKILL.md | Automatic collection of insights using `★ Insight` markers |

**Skill activation:**
- Triggers when Claude generates insights using `★ Insight` format
- Saves insights to session-specific file
- Classifies insights by type (code-pattern, workflow, debugging, architecture, tool-usage)

### Commands

| Command  | File                 | Purpose                            |
| -------- | -------------------- | ---------------------------------- |
| insights | commands/insights.md | View and manage collected insights |

**Command actions:**
- `/insights` - Show current session's insights
- `/insights extract` - Launch insight-extractor agent (not implemented yet)
- `/insights clear` - Delete current session's insights
- `/insights all` - Show all sessions' insights

## Runtime Storage

```
.claude/knowledge-extraction/
├── config.local.md              # Settings (threshold, auto_recommend, output_dir)
└── sessions/
    └── {session-id}.md          # Per-session insights (deleted after extraction)
```

**Storage details:**
- Session files use session ID as filename: `{session-id}.md`
- Insights stored in markdown format with timestamp headers (`## {ISO-8601}`)
- Files created automatically when first insight is saved
- Files deleted after successful extraction via `/insights extract`

## Insight Collection Workflow

1. **Generation**: Claude produces insight using `★ Insight` format during conversation
2. **Classification**: insight-awareness skill identifies insight type (code-pattern, workflow, debugging, architecture, tool-usage)
3. **Storage**: Insight saved to `.claude/knowledge-extraction/sessions/{session-id}.md`
4. **Threshold check**: check-threshold.js hook monitors write, displays reminder if count >= threshold
5. **Extraction**: User runs `/insights extract` to convert insights into reusable components (Skill, Command, Agent, CLAUDE.md)
6. **Cleanup**: Session file deleted after successful extraction

## Insight Storage Format

Session files use this structure:

```markdown
## {ISO-8601-timestamp}

- **Type**: {code-pattern|workflow|debugging|architecture|tool-usage}
- **Context**: {related files, technologies, or topics}
- **Content**:
  {insight content - the actual knowledge to preserve}
```

**Example:**

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

## Configuration Format

`.claude/knowledge-extraction/config.local.md`:

```yaml
---
threshold: 5
auto_recommend: true
output_dir: ".claude"
---
```

- **threshold**: Number of insights before recommending extraction (default: 5)
- **auto_recommend**: Whether to show extraction recommendations (default: true)
- **output_dir**: Where to create extracted components (default: ".claude")

## Key Concepts

- **Session-based Isolation**: Each Claude session stores insights separately
- **Insight Format**: Uses `★ Insight` markers (Claude's existing format)
- **Auto-classification**: Insights categorized by type for extraction targeting
- **Extraction Targets**: Skills, Commands, Agents, CLAUDE.md
- **Threshold reminders**: Automatic prompts when insight count reaches threshold

## Integration with ★ Insight Format

This plugin integrates with Claude's existing insight marker format:

```
★ Insight ─────────────────────────────────────
[key educational points]
─────────────────────────────────────────────────
```

**Workflow:**
1. Generate `★ Insight` block in conversation (visible to user)
2. insight-awareness skill extracts content from insight block
3. Saves to session file with metadata (type, context, timestamp)
4. Hooks monitor file for threshold reminders

## Development Status

**Implemented:**
- Insight collection via insight-awareness skill
- Session file storage and management
- Threshold-based reminders via hooks
- `/insights` command for viewing insights

**Not implemented:**
- insight-extractor agent (referenced in commands but missing)
- `/insights extract` action (depends on missing agent)
- Automatic extraction proposals

**Known issues:**
- None currently
