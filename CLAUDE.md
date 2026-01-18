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

## Standard Vocabulary

Use consistent terminology across all plugins, agents, and documentation.

| Category | Use ✅ | Avoid ❌ | Notes |
|----------|--------|----------|-------|
| **Verification** | evidence | proof, confirmation | Concrete output demonstrating completion |
| **Criteria** | criterion (singular)<br>criteria (plural) | criterias, criterions | "One criterion was met"<br>"All criteria are satisfied" |
| **Task Status** | open<br>in_progress<br>resolved | pending<br>working<br>complete, done, closed | Matches JSON state values |
| **Test Results** | PASS<br>FAIL | passed, failed, success, error | Uppercase for verification outcomes |
| **Exit Codes** | exit code 0<br>exit code 1 | return code, status code | 0 = success, 1 = error |

**Examples:**

```markdown
### Criterion: Tests pass
Command: npm test
Output: PASS src/auth.test.ts
Exit code: 0

Evidence:
- Test execution completed
- All criteria met
- Task status: resolved
```

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
argument-hint: "optional arguments spec"
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
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

**Frontmatter fields:**
- `name`: Command identifier (lowercase, hyphen-separated)
- `description`: One-line description shown in help
- `argument-hint`: Optional hint text for command arguments
- `allowed-tools`: List of tools the command's agent can use

### Agent Specification

Agent files (`agents/*/AGENT.md`) must include:

```markdown
---
name: agent-name
description: Agent role description
model: claude-sonnet-4-5
color: blue
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

**Frontmatter fields:**
- `name`: Agent identifier (lowercase, hyphen-separated)
- `description`: Agent role description (can use rich XML format, see below)
- `model`: Claude model to use (e.g., `claude-sonnet-4-5`, `claude-opus-4-5`)
- `color`: Terminal display color (e.g., `blue`, `green`, `yellow`)
- `tools`: List of allowed tools the agent can use

**Rich description format:**

Agent descriptions support XML markup for structured information:

```markdown
---
description: |
  <role>Worker Agent</role>
  <purpose>Complete ONE specific task with evidence-based verification</purpose>
  <context>
    <session>CLAUDE_SESSION_ID: {session-id}</session>
    <task>TASK_ID: {task-id}</task>
    <constraints>
      <item>Surgical changes only</item>
      <item>Concrete evidence required</item>
      <item>No partial completion claims</item>
    </constraints>
  </context>
---
```

XML tags commonly used:
- `<role>`: Agent's primary role
- `<purpose>`: Main objective
- `<context>`: Environmental/session context
- `<constraints>`: Hard limitations
- `<workflow>`: Step-by-step process
- `<output>`: Expected output format

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

### Skill Specification

Skills are reusable knowledge modules that provide specialized guidance to agents. They document patterns, workflows, and best practices for specific capabilities.

**File**: `skills/{skill-name}/SKILL.md`

```markdown
---
name: skill-name
description: |
  Brief description of what this skill provides.
  Who should use it and when.
  Required context or dependencies.
---

# Skill Title

## What This Skill Provides

Clear explanation of the skill's purpose and capabilities.

## When to Use This Skill

Specific scenarios where this skill applies.

## Usage Examples

Concrete examples of using the skill's patterns.

## Best Practices

Guidelines for effective skill usage.
```

**Frontmatter fields:**
- `name`: Skill identifier (lowercase, hyphen-separated, must match directory name)
- `description`: Multi-line or single-line description (use `|` for multi-line)

**Skill Directory Structure:**

```
skills/{skill-name}/
├── SKILL.md          # Main skill file (REQUIRED)
└── references/       # Supporting files (OPTIONAL)
    ├── example.md
    └── diagram.png
```

**Agent Integration:**

Agents reference skills in their frontmatter:

```markdown
---
name: worker
description: Task implementation agent
model: claude-sonnet-4-5
tools: [Read, Write, Edit, Bash]
skills: [utility-scripts, data-access-patterns, tdd-workflow]
---
```

Skills are injected into the agent's context at spawn time, providing specialized knowledge without bloating the agent definition.

### Skill Development Patterns

**Pattern 1: Workflow Skills**

Document step-by-step processes with concrete bash commands and evidence requirements.

**Examples**: `tdd-workflow`, `worker-workflow`, `monitoring-loop`

```markdown
## Phase 1: Setup
```bash
bun "$SCRIPTS_PATH/script.js" --session ${ID} --param value
```

## Phase 2: Execute
[Concrete steps with expected outputs]

## Phase 3: Verify
[Evidence collection patterns]
```

**Pattern 2: Reference Skills**

Provide quick reference tables and command templates for utility scripts.

**Examples**: `utility-scripts`, `scripts-path-usage`

```markdown
| Data | Access Method |
|------|---------------|
| session.json | `bun "$SCRIPTS_PATH/session-get.js" --session ${ID}` |
| tasks/*.json | `bun "$SCRIPTS_PATH/task-get.js" --session ${ID} --id N` |
```

**Pattern 3: Concept Skills**

Explain design principles, rationale, and decision-making frameworks.

**Examples**: `data-access-patterns`, `insight-awareness`

```markdown
## Why This Pattern?

### 1. Token Efficiency
[Explanation with examples]

### 2. Error Handling
[Concrete benefits]
```

**Pattern 4: Orchestration Skills**

Document complex coordination logic with pseudocode and state transitions.

**Examples**: `monitoring-loop`, `task-decomposition`, `planning`

```markdown
## Loop Structure

### Pseudocode
```javascript
while (!isComplete()) {
  checkStatus();
  handleResult();
  sleep(interval);
}
```

### State Transitions
[Flowcharts or decision trees]
```

### Skill Inventory

**Total skills across all plugins: 14**

| Plugin | Skill | Purpose |
|--------|-------|---------|
| **ultrawork** (7) | `planning` | Task decomposition and design workflow |
| | `overview-exploration` | Codebase discovery patterns |
| | `scripts-path-usage` | Quick reference for SCRIPTS_PATH usage |
| | `data-access-patterns` | JSON vs Markdown access rules |
| | `tdd-workflow` | Test-driven development cycle |
| | `utility-scripts` | Comprehensive script usage guide |
| | `ultrawork` | Core ultrawork concepts and workflow |
| **teamwork** (6) | `scripts-path-usage` | Quick reference for SCRIPTS_PATH usage |
| | `monitoring-loop` | Wave-based monitoring algorithm |
| | `task-decomposition` | Breaking goals into tasks |
| | `utility-scripts` | Comprehensive script usage guide |
| | `worker-workflow` | Task execution workflow (Phase 1-5) |
| | `teamwork-clean` | Project reset and recovery |
| **knowledge-extraction** (1) | `insight-awareness` | Knowledge extraction principles |

### Cross-Plugin Skill Management

**Important**: Claude Code does not support cross-plugin skill dependencies. Each plugin loads skills independently.

**Strategy: Copy and adapt**

When multiple plugins need the same skill (e.g., `scripts-path-usage`, `utility-scripts`):

1. **Copy the skill** to each plugin's `skills/` directory
2. **Adapt for context** - Customize examples, variable names, and script paths for the target plugin
3. **Maintain independently** - Changes in one plugin's version don't propagate to others

**Example: `scripts-path-usage` skill**

| Plugin | Location | Adapted For |
|--------|----------|-------------|
| ultrawork | `plugins/ultrawork/skills/scripts-path-usage/` | ultrawork session scripts, CLAUDE_SESSION_ID variable |
| teamwork | `plugins/teamwork/skills/scripts-path-usage/` | teamwork project scripts, PROJECT/SUB_TEAM variables |

**When updating shared skills:**

```bash
# Find all copies of a skill
find plugins -name "SKILL.md" -path "*scripts-path-usage*"

# After updating one copy, manually sync critical changes to others
# Adapt context-specific examples while keeping core patterns consistent
```

**Why not a shared plugin?**
- Claude Code loads plugins independently
- Agent frontmatter `skills: [skill-name]` only resolves within the same plugin
- A "shared" plugin would require separate installation and wouldn't auto-link

**Trade-off**: Copy-and-adapt creates duplication but ensures plugin independence and context-appropriate documentation.

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

### Shared Component Management

**Claude Code does not support cross-plugin dependencies.** Each plugin is loaded independently; skills, scripts, and agents from one plugin cannot be referenced by another.

**Policy: Copy and maintain separately**

When multiple plugins need the same component (skill, script, lib):

1. **Copy the component** to each plugin that needs it
2. **Adapt for context** - modify descriptions and examples for the specific plugin
3. **Maintain independently** - changes in one plugin don't automatically propagate

**Example: `scripts-path-usage` skill**

| Plugin | Status | Notes |
|--------|--------|-------|
| ultrawork | ✅ Has copy | Tailored for ultrawork agents |
| teamwork | ✅ Has copy | Tailored for teamwork agents |

**When updating shared components:**

```bash
# Find all copies of a shared skill/component
find plugins -name "SKILL.md" -path "*scripts-path-usage*"

# After updating one copy, manually sync critical changes to others
# (Adapt context-specific examples, keep core patterns consistent)
```

**Why not a shared plugin?**
- Claude Code loads plugins independently
- Agent frontmatter `skills: [skill-name]` only resolves within the same plugin
- A "shared" plugin would require separate installation and wouldn't auto-link

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
