# hardworker-marketplace

Claude Code plugin marketplace. A collection of plugins focused on "hardworker" productivity patterns.

## Project Overview

### Plugin List

| Plugin               | Description                                                                         |
| -------------------- | ----------------------------------------------------------------------------------- |
| ultrawork            | Verification-first development with session isolation and evidence-based completion |
| teamwork             | Multi-session collaboration with role-based workers                                 |
| knowledge-extraction | Extract and manage knowledge from codebases                                         |

### Tech Stack

- **Language**: JavaScript (Bun)
- **Dependencies**: git (version control)
- **Data Format**: JSON (state), Markdown (documentation)
- **Runtime**: Claude Code CLI environment (Bun 1.0+)

## Development Standards

### plugin.json Specification (Required)

```json
{
  "name": "plugin-name",           // Required: lowercase, hyphen-separated
  "version": "0.0.1",              // Required: Semantic versioning
  "description": "...",            // Required: One-line description
  "author": { "name": "..." },     // Required: Author info
  "keywords": ["..."],             // Required: Search keywords
  "license": "MIT",                // Required: MIT license
  "commands": "./commands/",       // Required: Command directory
  "agents": ["./agents/*/AGENT.md"], // Required: Agent file paths
  "skills": "./skills/"            // Optional: Skill directory
  // Note: hooks/hooks.json is auto-loaded, don't add "hooks" field
}
```

### Version Bump Rules

| Change Type       | Version Bump   | Examples                            |
| ----------------- | -------------- | ----------------------------------- |
| Bug fix, typo fix | Patch (0.0.x)  | Script error fix, docs typo         |
| New command/agent | Minor (0.x.0)  | Add new agent, new command          |
| Breaking change   | Major (x.0.0)  | Change state format, remove command |
| Behavior change   | Minor or Major | Depends on backward compatibility   |

**When to bump version:**
- Every PR that modifies plugin behavior MUST bump version
- Multiple fixes in single PR = single version bump
- Documentation-only changes = no bump required

### Script Specification

All Bun scripts must follow these conventions:

```javascript
#!/usr/bin/env bun

// REQUIRED: Parameter parsing with flags
const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    params[key] = args[i + 1];
}

// REQUIRED: Input validation
if (!params.paramName) {
    console.error('Error: --param-name required');
    process.exit(1);
}

// REQUIRED: JSON output for data
console.log(JSON.stringify({ status: 'success', data: {...} }));
```

**Required patterns:**
- Flag-based parameters (no positional args)
- Error messages to stderr
- JSON output for structured data
- Exit codes: 0 (success), 1 (error)
- JSDoc type annotations for clarity

### Command Specification

Command files (`commands/*.md`) must include:

```markdown
---
name: command-name
description: One-line description
args: "optional arguments spec"
---

# Command Title

## Overview
What this command does.

## Usage
\`\`\`
/command-name [options]
\`\`\`

## Options
- `--option`: Description

## Workflow
Step-by-step execution flow.
```

### Agent Specification

Agent files (`agents/*/AGENT.md`) must include:

```markdown
---
name: agent-name
description: Agent role description
tools: [list, of, allowed, tools]
---

# Agent Role

## Purpose
Why this agent exists.

## Responsibilities
- What this agent does
- What it should NOT do

## Input/Output
Expected inputs and outputs.

## Workflow
Step-by-step agent behavior.
```

### Hook Specification

Hook configuration (`hooks/hooks.json`):

```json
{
  "hooks": [
    {
      "matcher": { "tool_name": "...", "event": "..." },
      "hooks": [
        {
          "type": "command",
          "command": "./hooks/script.js"
        }
      ]
    }
  ]
}
```

**Hook script requirements:**
- Idempotent (safe to run multiple times)
- Non-blocking (< 1 second execution)
- Silent on success (no stdout unless necessary)
- Log errors to stderr

### State File Specification

JSON state files must be valid JSON and follow schema:

```json
{
  "version": "1",           // State schema version
  "created_at": "ISO8601",  // Creation timestamp
  "updated_at": "ISO8601",  // Last update timestamp
  "data": { ... }           // Actual state data
}
```

## Plugin Structure Standards

### Directory Layout

```
plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json      # Plugin metadata (REQUIRED)
├── commands/            # Command definitions (.md)
├── agents/              # Agent definitions (AGENT.md)
├── src/
│   ├── scripts/         # Bun script implementations (.js)
│   ├── hooks/           # Hook implementations (.js)
│   └── lib/             # Shared libraries
├── hooks/
│   └── hooks.json       # Hook configuration
├── skills/              # Skill definitions (optional)
├── CLAUDE.md            # Plugin-level context (REQUIRED)
└── README.md            # User documentation (REQUIRED)
```

### State Management Patterns

| Plugin    | Pattern                     | Location                               |
| --------- | --------------------------- | -------------------------------------- |
| ultrawork | Session-based isolation     | `~/.claude/ultrawork/sessions/{id}/`   |
| teamwork  | Project-based collaboration | `~/.claude/teamwork/{project}/{team}/` |

## Development Guidelines

### Bun Script Conventions

```javascript
#!/usr/bin/env bun

// Flag-based parameters
const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    params[key] = args[i + 1];
}
```

### Script Naming Convention

- `{entity}-{action}.js` pattern
- Examples: `session-get.js`, `task-create.js`, `task-list.js`

### JSON Manipulation

- Use native JSON.parse/JSON.stringify for all JSON operations
- Validate JSON before writing to files
- Handle empty/missing files gracefully

### Command Pattern

Commands delegate to agents or scripts:

```
Command (.md) → Agent (AGENT.md) → Script (.js) → State (JSON)
```

### Script Modification Rules

**When modifying scripts, you MUST check and sync all calling components:**

```
When modifying Script (.js), check:
├── Agents (agents/*/AGENT.md)    → Agents that call the script
├── Skills (skills/*.md)          → Skills that call the script
└── Commands (commands/*.md)      → Commands that call the script
```

**How to check:**
```bash
# Find files that reference a specific script
grep -r "script-name.js" agents/ skills/ commands/
```

**Why this matters:**
- Script interface changes (parameters, output format) require caller updates
- Script deletion/rename causes errors in callers

### Hook System

Lifecycle hooks for automation:

| Hook Type       | Purpose                    |
| --------------- | -------------------------- |
| session-start   | Initialize session context |
| session-context | Inject session variables   |
| post-tool-use   | Evidence collection        |
| agent-lifecycle | Track agent execution      |

Hook safety rules:
- Keep hooks idempotent
- Avoid blocking operations
- Log errors but don't fail silently
- Never modify tool results destructively

## Contributing Guide

### Adding New Plugin

1. Create plugin directory: `plugins/{plugin-name}/`
2. Create `.claude-plugin/plugin.json` with metadata
3. Add commands in `commands/` directory
4. Implement scripts in `src/scripts/` directory
5. Add CLAUDE.md for context tracking
6. Add README.md with usage documentation

### Plugin Requirements

- Self-contained (no cross-plugin dependencies)
- Bun-based (uses runtime bundled with Claude Code)
- JSON state management with native JSON methods
- Lifecycle hooks for automation support
- CLAUDE.md for AI agent context

### Code Review Checklist

- [ ] Flag-based parameter parsing in Bun scripts
- [ ] Error handling with meaningful messages
- [ ] No hardcoded paths (use environment variables)
- [ ] JSON validation before writes
- [ ] JSDoc type annotations for clarity
- [ ] CLAUDE.md updated with changes
- [ ] **Version synced**: `plugin.json` == `marketplace.json`

## Testing Approach

This project does not have an automated test framework. Follow manual testing procedures.

### Script Validation

```bash
# Syntax check (run scripts to validate)
bun src/scripts/*.js --help

# ESLint (if available)
npx eslint src/scripts/*.js
```

### Functional Testing

1. **Session State**: Create session, verify JSON structure
2. **Task Operations**: Create/update/list tasks
3. **Hook Execution**: Verify hooks trigger correctly
4. **Edge Cases**: Empty inputs, missing files, concurrent access

### Testing New Commands

```bash
# 1. Start Claude Code session
claude

# 2. Test command
/ultrawork "test task"

# 3. Verify session state
cat ~/.claude/ultrawork/sessions/{id}/session.json
```

## Version Management

### Semantic Versioning

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes

### Version Update Process

**CRITICAL: When updating versions, you MUST sync both files!**

1. Update `plugins/{plugin}/.claude-plugin/plugin.json` (plugin version)
2. Update `.claude-plugin/marketplace.json` (marketplace version) - **MUST match!**
3. Document changes in commit message
4. Tag release if significant milestone

```bash
# Verify version sync using Bun
bun -e "
  const pluginVersion = require('./plugins/ultrawork/.claude-plugin/plugin.json').version;
  const marketplaceVersion = require('./.claude-plugin/marketplace.json').plugins
    .find(p => p.name === 'ultrawork').version;
  if (pluginVersion !== marketplaceVersion) {
    console.error('Version mismatch:', pluginVersion, '!=', marketplaceVersion);
    process.exit(1);
  }
  console.log('Versions match:', pluginVersion);
"
```

**Version mismatch impact**: Plugins installed from marketplace will use outdated versions, causing bug fixes to not apply.

### Changelog Tracking

Changes tracked in git commit history. Follow conventional commits:

- `feat(plugin):` New features
- `fix(plugin):` Bug fixes
- `docs(plugin):` Documentation updates
- `refactor(plugin):` Code refactoring

## Context Tracking

### CLAUDE.md Usage

CLAUDE.md files provide context to AI agents.

| Level   | Location                           | Purpose                      |
| ------- | ---------------------------------- | ---------------------------- |
| Root    | `/CLAUDE.md`                       | Project overview, guidelines |
| Plugin  | `/plugins/*/CLAUDE.md`             | Plugin-specific context      |
| Agent   | `/plugins/*/agents/*/CLAUDE.md`    | Agent role context           |
| Session | `~/.claude/*/sessions/*/CLAUDE.md` | Session activity             |

### When to Update CLAUDE.md

- After architectural decisions
- When adding new patterns
- After significant refactoring
- When changing conventions

### claude-mem-context Format

```markdown
<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Date

| ID  | Time | T    | Title       | Read    |
| --- | ---- | ---- | ----------- | ------- |
| #ID | TIME | TYPE | Description | ~tokens |
</claude-mem-context>
```

## Quick Reference

### Common Commands

```bash
# ultrawork - verification-first development
/ultrawork "task description"
/ultrawork-status
/ultrawork-cancel

# teamwork - multi-session collaboration
/teamwork "project goal"
/teamwork-status
/teamwork-worker --role backend
```

### Session Directories

```bash
# ultrawork sessions
~/.claude/ultrawork/sessions/{session-id}/

# teamwork projects
~/.claude/teamwork/{project}/{team}/
```

### Plugin Cache

```bash
# Installed plugin cache
~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/
```
