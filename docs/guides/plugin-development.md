# Plugin Development Guide

This guide covers creating Claude Code plugins for the hardworker-marketplace. You will learn plugin structure, implementation patterns, and testing procedures.

For workflow patterns using existing plugins, see [Workflow Guide](workflow-guide.md). For installation instructions, see [Getting Started Guide](getting-started.md).

## Plugin Architecture

### Directory Structure

Every plugin follows this layout:

```
plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json      # Plugin metadata (REQUIRED)
├── commands/            # Command definitions (.md)
│   ├── command1.md
│   └── command2.md
├── agents/              # Agent definitions (AGENT.md)
│   ├── planner/
│   │   └── AGENT.md
│   └── worker/
│       └── AGENT.md
├── src/
│   ├── scripts/         # Implementation scripts
│   │   └── session-get.js
│   ├── hooks/           # Hook implementations
│   │   └── post-tool-use-evidence.js
│   └── lib/             # Shared libraries
├── hooks/
│   └── hooks.json       # Hook configuration
├── skills/              # Skill definitions (optional)
│   └── skill.md
├── CLAUDE.md            # Plugin context (REQUIRED)
└── README.md            # User documentation (REQUIRED)
```

All paths shown are mandatory unless marked optional.

### Core Components

| Component   | Format         | Purpose                                |
| ----------- | -------------- | -------------------------------------- |
| plugin.json | JSON           | Plugin metadata, version, entry points |
| Commands    | Markdown       | User-facing command definitions        |
| Agents      | Markdown       | AI agent role specifications           |
| Scripts     | JavaScript     | Implementation logic                   |
| Hooks       | JSON + scripts | Lifecycle automation                   |

## Creating Your First Plugin

### Step 1: Initialize Plugin Directory

```bash
mkdir -p plugins/myplugin/{.claude-plugin,commands,agents,scripts,hooks}
```

### Step 2: Create plugin.json

File: `plugins/myplugin/.claude-plugin/plugin.json`

```json
{
  "name": "myplugin",
  "version": "0.1.0",
  "description": "My first hardworker plugin",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "keywords": ["productivity", "workflow"],
  "license": "MIT",
  "commands": "./commands/",
  "agents": ["./agents/*/AGENT.md"],
  "skills": "./skills/"
}
```

Required fields:
- `name`: lowercase, hyphen-separated
- `version`: semantic versioning (MAJOR.MINOR.PATCH)
- `description`: one-line summary
- `author.name`: plugin creator
- `keywords`: search terms
- `license`: MIT (recommended)
- `commands`: relative path to commands directory
- `agents`: glob pattern for agent files

### Step 3: Create a Command

File: `plugins/myplugin/commands/myplugin-start.md`

```markdown
---
name: myplugin-start
description: Start a myplugin session
args: "goal (required)"
---

# Myplugin Start Command

## Overview

Starts a new myplugin session with the specified goal.

## Usage

\`\`\`bash
/myplugin-start "implement feature X"
\`\`\`

## Arguments

- `goal` (required): Description of what to accomplish

## Workflow

1. Invoke `myplugin-planner` agent with goal
2. Wait for plan creation
3. Display plan to user
4. Begin execution phase
```

Command files must include frontmatter (YAML between `---` markers) with name, description, and args.

### Step 4: Create an Agent

File: `plugins/myplugin/agents/planner/AGENT.md`

```markdown
---
name: myplugin-planner
description: Plans tasks for myplugin sessions
tools: [Read, Write, Bash, Glob, Grep]
---

# Myplugin Planner Agent

## Purpose

Analyzes user goals and creates execution plans with success criteria.

## Responsibilities

- Parse user goal into actionable tasks
- Define success criteria for each task
- Identify task dependencies
- Write plan to session directory

## Input

- User goal (string)
- Session directory path
- Existing codebase context

## Output

- plan.md file with task graph
- session.json updated with tasks

## Workflow

1. Read session.json for context
2. Analyze goal requirements
3. Create task list with criteria
4. Write plan.md to session directory
5. Update session.json with task data
```

Agent files must include:
- Frontmatter with name, description, tools
- Purpose section
- Responsibilities (what agent does and doesn't do)
- Input/Output specifications
- Workflow steps

### Step 5: Implement Scripts

Scripts handle state management and coordination.

File: `plugins/myplugin/src/scripts/session-create.js`

```javascript
#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse arguments
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  args[key] = process.argv[i + 1];
}

// Validation
if (!args['session-id']) {
  console.error('Error: --session-id required');
  process.exit(1);
}
if (!args.goal) {
  console.error('Error: --goal required');
  process.exit(1);
}

// Create session directory
const sessionDir = path.join(
  os.homedir(),
  '.claude',
  'myplugin',
  'sessions',
  args['session-id']
);
fs.mkdirSync(sessionDir, { recursive: true });

// Create session.json
const session = {
  id: args['session-id'],
  goal: args.goal,
  phase: 'planning',
  created_at: new Date().toISOString(),
  tasks: []
};

fs.writeFileSync(
  path.join(sessionDir, 'session.json'),
  JSON.stringify(session, null, 2)
);

// Output session path
console.log(sessionDir);
```

Script requirements:
- Shebang line (`#!/usr/bin/env bun`)
- Flag-based parameter parsing
- Input validation with error messages to stderr
- JSON output for structured data
- Exit code 0 for success, 1 for error

## Lifecycle Hooks

Hooks automate plugin behavior at specific lifecycle points.

### Hook Configuration

File: `plugins/myplugin/hooks/hooks.json`

```json
{
  "description": "Myplugin hooks for automation",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start-hook.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/collect-evidence.js"
          }
        ]
      }
    ]
  }
}
```

This configuration runs `session-start-hook.js` at session start and `collect-evidence.js` after every Bash tool invocation.

### Hook Implementation

File: `plugins/myplugin/src/hooks/collect-evidence.js`

```javascript
#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');
const os = require('os');

// Read tool result from stdin
let input = '';
process.stdin.on('data', chunk => { input += chunk; });

process.stdin.on('end', () => {
  try {
    const toolResult = JSON.parse(input);
    const exitCode = toolResult.exit_code || 0;

    // Only record non-zero exits
    if (exitCode !== 0) {
      const sessionFile = path.join(os.homedir(), '.claude', 'myplugin', 'current-session');
      if (fs.existsSync(sessionFile)) {
        const sessionDir = fs.readFileSync(sessionFile, 'utf8').trim();
        const evidenceLog = path.join(sessionDir, 'evidence.log');
        fs.appendFileSync(evidenceLog, `Command failed with exit code ${exitCode}\n`);
      }
    }

    // Output unmodified result
    console.log(input);
  } catch (err) {
    // Pass through on error
    console.log(input);
  }
});
```

Hook requirements:
- Read input from stdin
- Write output to stdout (must preserve original data)
- Idempotent (safe to run multiple times)
- Fast execution (< 1 second)
- Silent on success (only log errors)

### Available Hook Events

| Event            | When                                  | Matcher          |
| ---------------- | ------------------------------------- | ---------------- |
| SessionStart     | At the start of a Claude Code session | `*`              |
| UserPromptSubmit | When user submits a prompt            | `*`              |
| PreToolUse       | Before any tool is invoked            | Tool name or `*` |
| PostToolUse      | After any tool is invoked             | Tool name or `*` |
| SubagentStop     | When a sub-agent completes            | `*`              |
| Stop             | At session end                        | `*`              |

Common tool matchers: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Task`

## State Management

### Session State Pattern

Store session state in JSON files:

```
~/.claude/{plugin-name}/sessions/{session-id}/
├── session.json        # Core session state
├── tasks.json          # Task list with criteria
└── evidence.json       # Collected evidence
```

### State File Schema

File: `session.json`

```json
{
  "version": "1",
  "id": "uuid",
  "goal": "user goal",
  "phase": "planning|executing|verifying|complete",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "data": {
    "tasks": [],
    "evidence": []
  }
}
```

Required fields:
- `version`: State schema version (string)
- `created_at`: ISO8601 timestamp
- `updated_at`: ISO8601 timestamp
- `data`: Plugin-specific state

### Concurrent Access

Use file locking for concurrent writes:

```javascript
// Use file-lock.js utility for safe concurrent access
const { withLock } = require('./lib/file-lock.js');

await withLock('session.lock', async () => {
  const session = JSON.parse(fs.readFileSync('session.json', 'utf8'));
  session.phase = 'executing';
  fs.writeFileSync('session.json', JSON.stringify(session, null, 2));
});
```

## Testing Plugins

This project uses manual testing procedures (no automated test framework).

### Script Validation

```bash
# Bun syntax check
bun plugins/myplugin/src/scripts/*.js
```

### Functional Testing Steps

1. **Install plugin locally**:
   ```bash
   claude plugin install ./plugins/myplugin
   ```

2. **Start Claude Code session**:
   ```bash
   claude
   ```

3. **Test command**:
   ```bash
   /myplugin-start "test goal"
   ```

4. **Verify state files**:
   ```bash
   ls -la ~/.claude/myplugin/sessions/
   cat ~/.claude/myplugin/sessions/{id}/session.json
   ```

5. **Check for errors**:
   - Command output shows no errors
   - Session state transitions correctly
   - Files created at expected paths

### Edge Case Testing

Test these scenarios:

- Empty inputs: `""`
- Missing session directory
- Concurrent command execution
- Interrupted operations (Ctrl+C)
- Invalid JSON in state files

## Version Management

### Semantic Versioning Rules

| Change Type     | Version Bump  | Examples            |
| --------------- | ------------- | ------------------- |
| Bug fix         | Patch (0.0.x) | Script error fix    |
| New feature     | Minor (0.x.0) | Add new command     |
| Breaking change | Major (x.0.0) | Change state format |

### Marketplace Registration

Update marketplace configuration:

File: `.claude-plugin/marketplace.json`

```json
{
  "plugins": [
    {
      "name": "myplugin",
      "version": "0.1.0",
      "description": "My first hardworker plugin",
      "repository": "https://github.com/mnthe/hardworker-marketplace"
    }
  ]
}
```

Version in `marketplace.json` must match `plugin.json`.

## Best Practices

### Evidence-Based Language

Use concrete facts, not speculation:

- AVOID: "This should work"
- USE: "npm test exited with code 0"

- AVOID: "File probably exists"
- USE: "ls -la confirms file created at path X"

### Error Handling

```javascript
// Always validate inputs
if (!args['required-param']) {
  console.error('Error: missing required parameter');
  process.exit(1);
}

// Check command success
try {
  await someCommand();
} catch (err) {
  console.error('Error: command failed:', err.message);
  process.exit(1);
}
```

### Cross-Platform Paths

```javascript
// Use path.join() for cross-platform compatibility
const sessionPath = path.join(os.homedir(), '.claude', 'myplugin', 'sessions', id);
```

### JSON Manipulation

```javascript
// Use native JSON parsing and stringification
const data = JSON.parse(fs.readFileSync('session.json', 'utf8'));
data.phase = 'complete';
fs.writeFileSync('session.json', JSON.stringify(data, null, 2));
```

## Debugging

### Enable Debug Logging

```bash
# Set environment variable
export MYPLUGIN_DEBUG=1

# Commands now output debug info
/myplugin-start "test"
```

### Inspect Session State

```bash
# Pretty-print JSON
jq '.' ~/.claude/myplugin/sessions/{id}/session.json

# Watch for changes
watch -n 1 jq '.' ~/.claude/myplugin/sessions/{id}/session.json
```

### Trace Script Execution

```bash
# Bun: Use --inspect flag for debugging
bun --inspect plugins/myplugin/src/scripts/session-create.js --session-id test --goal "test"
```

## Publishing Plugins

1. **Create repository** on GitHub
2. **Add plugin files** following structure above
3. **Create `.claude-plugin/marketplace.json`** with plugin metadata
4. **Tag release** with semantic version:
   ```bash
   git tag -a v0.1.0 -m "Initial release"
   git push origin v0.1.0
   ```
5. **Submit to marketplace** (create PR to hardworker-marketplace repository)

## Next Steps

- Review [Workflow Guide](workflow-guide.md) for usage patterns
- Study existing plugins in `plugins/` directory
- Read [Getting Started Guide](getting-started.md) for installation procedures

## Additional Resources

- Repository: https://github.com/mnthe/hardworker-marketplace
- Plugin specification: See `/CLAUDE.md` in repository root
- Example plugins: ultrawork, teamwork, knowledge-extraction
