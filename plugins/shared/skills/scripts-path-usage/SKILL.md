---
name: scripts-path-usage
description: How to correctly reference script paths in agents when SCRIPTS_PATH is provided in the prompt
---

# SCRIPTS_PATH Usage Pattern

This skill documents the correct pattern for calling Bun scripts from agents in hardworker-marketplace plugins.

## Problem Statement

### Why SCRIPTS_PATH Exists

Claude Code expands environment variables like `${CLAUDE_PLUGIN_ROOT}` in command and hook configuration files at load time. However, these variables are NOT available as shell environment variables when agents run Bash commands.

**What happens:**
1. Command file: `${CLAUDE_PLUGIN_ROOT}` → Expands to `/Users/.../.claude/plugins/cache/...`
2. Agent content: `${CLAUDE_PLUGIN_ROOT}` → Stays literal, shell sees `${CLAUDE_PLUGIN_ROOT}`
3. Bash command: `bun "$SCRIPTS/script.js"` → Shell cannot expand, command fails

### The Solution

Commands pass a resolved `SCRIPTS_PATH` variable to agents via the prompt text. Agents then use this path value directly in their Bash commands.

---

## Pattern Overview

### 1. Command Passes SCRIPTS_PATH to Agent

In command file (e.g., `commands/ultrawork.md`):

```markdown
SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts

The orchestrator will manage the session...
```

When Claude Code loads this command, it expands to:

```
SCRIPTS_PATH: /Users/name/.claude/plugins/cache/hardworker-marketplace/ultrawork/0.23.1/src/scripts

The orchestrator will manage the session...
```

### 2. Agent Uses SCRIPTS_PATH in Bash Commands

In agent file (e.g., `agents/worker/AGENT.md`):

The agent receives `SCRIPTS_PATH` as **text in the prompt**, not as a shell variable.

**WRONG APPROACH** (will fail):

```bash
# This treats SCRIPTS_PATH as a shell variable - IT IS NOT
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id 1
```

**CORRECT APPROACH**:

The agent must extract the SCRIPTS_PATH value from its prompt and use it literally:

```bash
# Extract value from prompt: "SCRIPTS_PATH: /path/to/scripts"
# Use the actual path in the command
bun /path/to/scripts/task-update.js --session ${CLAUDE_SESSION_ID} --task-id 1
```

---

## Correct Usage in Agents

### Pattern 1: Direct Substitution (Recommended)

When writing agent markdown, agents should be instructed to **use the SCRIPTS_PATH value directly**:

```markdown
Your prompt includes:

SCRIPTS_PATH: {path to scripts}

To call scripts, extract the path value from your prompt and use it in bash commands:

\`\`\`bash
bun {SCRIPTS_PATH}/task-update.js --session {SESSION_ID} --task-id 1
\`\`\`
```

### Pattern 2: Explicit Value Extraction

Alternatively, provide a clear warning about the non-variable nature:

```markdown
<WARNING>
**SCRIPTS_PATH is NOT a shell environment variable.**

The value `SCRIPTS_PATH: /path/to/scripts` in your prompt is text. When writing bash commands:

**WRONG** (will fail):
\`\`\`bash
bun "$SCRIPTS_PATH/task-list.js"  # Shell cannot expand $SCRIPTS_PATH
\`\`\`

**CORRECT** (substitute the actual value):
\`\`\`bash
bun "/path/to/scripts/task-list.js"  # Use the value from your prompt directly
\`\`\`

Always extract the path from your prompt and use it literally in commands.
</WARNING>
```

---

## Common Mistakes

### Mistake 1: Treating SCRIPTS_PATH as Shell Variable

```bash
# WRONG - Assumes SCRIPTS_PATH is a shell environment variable
SCRIPTS="$SCRIPTS_PATH"
bun "$SCRIPTS/task-list.js"
```

**Problem**: Shell cannot expand `$SCRIPTS_PATH` because it's not in the environment.

**Fix**: Use the actual path value from the prompt.

### Mistake 2: Using CLAUDE_PLUGIN_ROOT in Agents

```bash
# WRONG - CLAUDE_PLUGIN_ROOT is not available in agent runtime
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js"
```

**Problem**: `CLAUDE_PLUGIN_ROOT` is only expanded at configuration load time, not available at agent execution time.

**Fix**: Use SCRIPTS_PATH passed via prompt instead.

### Mistake 3: Hardcoding Absolute Paths

```bash
# WRONG - Hardcoded path breaks on different machines
bun "/Users/mnthe/.claude/plugins/cache/hardworker-marketplace/ultrawork/0.23.1/src/scripts/task-list.js"
```

**Problem**: Path is specific to one machine and version. Breaks when plugin is updated or used on another system.

**Fix**: Use SCRIPTS_PATH which is dynamically resolved per environment.

---

## Where This Pattern Is Used

### ultrawork Plugin

**Commands that pass SCRIPTS_PATH:**
- `commands/ultrawork.md`
- `commands/ultrawork-status.md`
- `commands/ultrawork-evidence.md`
- `commands/ultrawork-worker.md`

**Agents that use SCRIPTS_PATH:**
- `agents/explorer/AGENT.md`
- `agents/planner/AGENT.md`
- `agents/worker/AGENT.md`
- `agents/verifier/AGENT.md`
- `agents/reviewer/AGENT.md`

**Example from worker agent:**

```markdown
## Phase 2: Mark In Progress

\`\`\`bash
bun "$SCRIPTS_PATH/task-update.js" --session ${CLAUDE_SESSION_ID} --id {TASK_ID} \
  --add-evidence "Starting implementation at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
\`\`\`
```

### teamwork Plugin

**Commands that pass SCRIPTS_PATH:**
- `commands/teamwork.md`
- `commands/teamwork-worker.md`
- `commands/teamwork-status.md`

**Agents that use SCRIPTS_PATH:**
- `agents/orchestrator/AGENT.md`
- `agents/worker/AGENT.md`
- `agents/frontend/AGENT.md`
- `agents/backend/AGENT.md`
- (All role-based worker agents)

**Example from orchestrator agent:**

```bash
bun "$SCRIPTS_PATH/task-create.js" --project {PROJECT} --team {TEAM} \
  --id "1" \
  --title "Implement feature X" \
  --role backend
```

---

## Implementation Checklist

When creating a new plugin or agent that needs to call scripts:

- [ ] Command file passes `SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts` in prompt
- [ ] Agent documentation includes clear instructions on using SCRIPTS_PATH
- [ ] Agent examples show path extraction from prompt
- [ ] No usage of `${CLAUDE_PLUGIN_ROOT}` in agent bash commands
- [ ] No hardcoded absolute paths in agent bash commands
- [ ] WARNING block added to agent docs if pattern is critical to functionality

---

## Benefits of This Pattern

1. **Cross-platform compatibility**: Works on Windows, macOS, Linux
2. **Version independence**: Path resolves to correct plugin version
3. **Environment independence**: Works in dev, test, and production
4. **No manual configuration**: Users don't need to set environment variables
5. **Consistent behavior**: Same pattern across all plugins

---

## Related Patterns

### SESSION_DIR Pattern

Some plugins also pass `SESSION_DIR` for session-specific file operations:

```markdown
SESSION_DIR: ~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}
```

Agents can use this directly:

```bash
# Read markdown file (use Read tool)
Read("$SESSION_DIR/exploration/overview.md")

# Or in bash
cat "$SESSION_DIR/exploration/overview.md"
```

**Key difference**: `SESSION_DIR` CAN be used as a shell variable because it's a literal path expansion, not a reference to `CLAUDE_PLUGIN_ROOT`.

### WORKING_DIR Pattern

For project-specific operations:

```markdown
WORKING_DIR: /path/to/user/project
```

Agents use this for project file operations:

```bash
# Run tests in project directory
cd "$WORKING_DIR" && npm test
```

---

## Testing Script Paths

When testing locally during development:

```bash
# Set SCRIPTS_PATH manually for testing
SCRIPTS_PATH="/absolute/path/to/plugins/ultrawork/src/scripts"
bun "$SCRIPTS_PATH/task-list.js" --session test-session
```

In production (via Claude Code), the command automatically provides the correct path.

---

## Summary

**Key Takeaway**: `SCRIPTS_PATH` is a **prompt variable**, not a **shell variable**. Agents must extract the path value from their prompt and use it literally in Bash commands.

**Pattern**:
1. Command: Pass `SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts`
2. Agent: Extract path from prompt, use directly in bash commands
3. Never: Assume `SCRIPTS_PATH` or `CLAUDE_PLUGIN_ROOT` are shell environment variables
