# knowledge-extraction

Bun-based plugin for automatically collecting and extracting insights from Claude sessions.

## File Structure

- `commands/insights.md` - `/insights` command for viewing/managing insights
- `skills/insight-awareness/` - Skill explaining how insights are captured
- `agents/insight-extractor.md` - Agent for extracting insights to components
- `src/hooks/auto-extract-insight.js` - Hook for automatic insight extraction
- `hooks/hooks.json` - Hook configuration

## No Build Step Required

Scripts run directly with Bun. No compilation needed.

## Hook Configuration

**IMPORTANT**: hooks.json must use explicit `bun` prefix for cross-platform compatibility.

```json
// CORRECT - explicit bun invocation
"command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/auto-extract-insight.js"
```

## Component Inventory

### Hooks

| Hook          | File                     | Trigger      | Purpose                                                    |
| ------------- | ------------------------ | ------------ | ---------------------------------------------------------- |
| Stop          | auto-extract-insight.js  | Session stop | Extracts insights from transcript + recommends extraction  |
| SubagentStop  | auto-extract-insight.js  | Agent stop   | Extracts insights from subagent transcript (no recommend)  |

**Hook behavior:**
- Parses Claude's transcript for `★ Insight` markers
- Automatically extracts and saves to `{session-id}/insights.md`
- Includes context: user question + text before insight
- State tracking prevents duplicate processing
- Stop hook shows recommendation when threshold reached

### Agents

| Agent             | Location                      | Purpose                                       |
| ----------------- | ----------------------------- | --------------------------------------------- |
| insight-extractor | agents/insight-extractor.md   | Analyzes insights, proposes extraction targets |

### Skills

| Skill             | Location                          | Purpose                                          |
| ----------------- | --------------------------------- | ------------------------------------------------ |
| insight-awareness | skills/insight-awareness/SKILL.md | Documents how automatic insight capture works    |

### Commands

| Command  | File                 | Purpose                            |
| -------- | -------------------- | ---------------------------------- |
| insights | commands/insights.md | View and manage collected insights |

**Command actions:**
- `/insights` - Show current session's insights
- `/insights extract` - Launch insight-extractor agent
- `/insights clear` - Delete current session's insights
- `/insights all` - Show all sessions' insights

## Runtime Storage

```
.claude/knowledge-extraction/
├── config.local.md              # Settings (threshold, auto_recommend)
└── {session-id}/
    ├── state.json               # Processing state (lastProcessedUuid)
    └── insights.md              # Collected insights with context
```

**Storage details:**
- Each session has its own directory
- `state.json` tracks last processed transcript message (prevents duplicates)
- `insights.md` contains extracted insights with context
- Directories deleted after successful extraction via `/insights extract`

## Insight Collection Workflow

1. **Generation**: Claude produces insight using `★ Insight` format during conversation
2. **Hook Trigger**: Stop/SubagentStop hook fires when Claude finishes responding
3. **Transcript Parse**: Hook reads transcript, finds new messages since last processed
4. **Pattern Match**: Extracts content between `★ Insight ─────` markers
5. **Context Capture**: Saves user question + text before insight for context
6. **Storage**: Appends to `{session-id}/insights.md`
7. **State Update**: Saves last processed uuid to `state.json`
8. **Threshold Check**: (Stop only) Recommends extraction if count >= threshold

## Insight Storage Format

```markdown
## {ISO-8601-timestamp}

### User Question

> {user's question that prompted the insight}

### Context

{text immediately before the insight marker}

### Content

{extracted insight content}

---
```

## Configuration Format

`.claude/knowledge-extraction/config.local.md`:

```yaml
---
threshold: 5
auto_recommend: true
---
```

- **threshold**: Number of insights before recommending extraction (default: 5)
- **auto_recommend**: Whether to show extraction recommendations (default: true)

## Key Concepts

- **Automatic Extraction**: Hooks capture insights without manual saving
- **Session Isolation**: Each Claude session stores insights separately
- **Context Preservation**: User question + surrounding text saved with insight
- **Duplicate Prevention**: State tracking + content hashing prevents duplicates
- **Threshold Reminders**: Automatic prompts when insight count reaches threshold

## Integration with ★ Insight Format

```
★ Insight ─────────────────────────────────────
[key educational points]
─────────────────────────────────────────────────
```

**Automatic workflow:**
1. Claude generates `★ Insight` block (visible to user)
2. Hook parses transcript after response completes
3. Extracts content between markers
4. Saves to session file with context
5. Recommends extraction when threshold reached

## Development Status

**Implemented:**
- Automatic insight extraction via hooks
- Context capture (user question + preceding text)
- Session-based storage with state tracking
- Threshold-based recommendations
- `/insights` command suite

**Components:**
- insight-extractor agent (for `/insights extract`)
- insight-awareness skill (documentation)
