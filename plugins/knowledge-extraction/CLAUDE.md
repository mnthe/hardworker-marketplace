# knowledge-extraction

Bun-based plugin for automatically collecting and extracting insights from Claude sessions.

## Plugin Description

knowledge-extraction automates the capture and organization of insights during Claude Code sessions.

Key features:
- Automatic insight extraction via lifecycle hooks (Stop/SubagentStop)
- Session isolation with separate storage per session
- Context preservation (user question + surrounding text saved with insight)
- Duplicate prevention via state tracking and content hashing
- Threshold-based reminders for extraction when insight count reaches configured threshold
- Integration with ★ Insight format for consistent markup

## File Structure

```
plugins/knowledge-extraction/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata
├── commands/
│   └── insights.md           # /insights command
├── skills/
│   └── insight-awareness/
│       └── SKILL.md          # Insight capture documentation
├── agents/
│   └── insight-extractor.md  # Insight extraction agent
├── src/
│   └── hooks/
│       └── auto-extract-insight.js  # Hook implementation
├── hooks/
│   └── hooks.json            # Hook configuration
├── CLAUDE.md                 # This file
└── README.md                 # User documentation
```

## Script Inventory

All scripts use Bun runtime with flag-based parameters.

| Script | Purpose | Key Parameters |
|--------|---------|----------------|
| **auto-extract-insight.js** | Hook for automatic insight extraction from transcript. Parses ★ Insight markers, saves to insights.md with context, tracks state to prevent duplicates, recommends extraction when threshold reached (Stop hook only). | Reads from stdin: `session_id`, `transcript_path`, `hook_event_name`, `stop_hook_active` |

## Hook Inventory

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

## Agent Inventory

### Agents

| Agent | Model | Role | Key Responsibilities |
|-------|-------|------|---------------------|
| **insight-extractor** | inherit | Insight analysis | Analyzes insights, proposes extraction targets |

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

## State Management

### Directory Structure

```
~/.claude/knowledge-extraction/
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

## State Formats

### Insight Storage Format

**File**: `~/.claude/knowledge-extraction/{session-id}/insights.md`

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

### Processing State Format

**File**: `~/.claude/knowledge-extraction/{session-id}/state.json`

```json
{
  "lastProcessedUuid": "abc-123-uuid"
}
```

### Configuration Format

**File**: `~/.claude/knowledge-extraction/config.local.md`

```yaml
---
threshold: 5
auto_recommend: true
---
```

- **threshold**: Number of insights before recommending extraction (default: 5)
- **auto_recommend**: Whether to show extraction recommendations (default: true)

## Development Rules

### Hook Development Pattern

```javascript
#!/usr/bin/env bun

// Read hook input from stdin
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return chunks.join('');
}

// Hook input structure
const hookInput = JSON.parse(await readStdin());
const { session_id, transcript_path, hook_event_name, stop_hook_active } = hookInput;

// Prevent infinite loops
if (stop_hook_active) {
  process.exit(0);
}

// Hook output (for Stop hook)
const output = {
  additionalContext: "Message to display to user"
};
console.log(JSON.stringify(output));
```

### Hook Safety Rules

- Hooks must be idempotent (safe to run multiple times)
- Hooks must be non-blocking (< 1 second execution)
- Fail silently on errors (use try-catch, exit 0)
- Check `stop_hook_active` to prevent infinite loops
- Use content hashing to prevent duplicate processing

### State Management Rules

- Always check if state file exists before reading
- Provide sensible defaults for missing state
- Use atomic writes (write to temp file, then rename)
- Track processing progress to enable incremental updates
- Clean up state after successful extraction

## Hook Configuration

**IMPORTANT**: hooks.json must use explicit `bun` prefix for cross-platform compatibility.

```json
// CORRECT - explicit bun invocation
"command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/auto-extract-insight.js"
```

## No Build Step Required

Scripts run directly with Bun. No compilation needed.

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

## Insight Collection Workflow

1. **Generation**: Claude produces insight using `★ Insight` format during conversation
2. **Hook Trigger**: Stop/SubagentStop hook fires when Claude finishes responding
3. **Transcript Parse**: Hook reads transcript, finds new messages since last processed
4. **Pattern Match**: Extracts content between `★ Insight ─────` markers
5. **Context Capture**: Saves user question + text before insight for context
6. **Storage**: Appends to `{session-id}/insights.md`
7. **State Update**: Saves last processed uuid to `state.json`
8. **Threshold Check**: (Stop only) Recommends extraction if count >= threshold

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
