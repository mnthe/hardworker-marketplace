# hardworker-marketplace

Claude Code plugin marketplace focused on "hardworker" productivity patterns: verification-first development, multi-session collaboration, and evidence-based completion.

## Features

### ultrawork - Verification-First Development

Strict verification-first development mode with session isolation and mandatory evidence collection.

**Key Features:**
- Session isolation with unique IDs
- Mandatory planning with success criteria
- Evidence-based completion (no "should work" claims)
- Execute→Verify loop (auto-retry on failure, max 5 iterations)
- Zero tolerance for partial implementation
- Parallel task execution with worker agents
- Cross-platform: Windows, MacOS, Linux
- Pure JavaScript with JSDoc type annotations
- No build step required

**Requirements:** Bun installed

[Full Documentation →](plugins/ultrawork/)

### teamwork - Multi-Session Collaboration

Role-based worker agents for parallel development across multiple terminal sessions.

**Key Features:**
- Role-based worker agents (frontend, backend, devops, test, docs, security, review)
- File-per-task storage for concurrent access
- Continuous loop mode (hook-based auto-continue)
- Dashboard status overview
- Project and team isolation
- Works with vanilla Claude Code

**Requirements:** Bun installed

[Full Documentation →](plugins/teamwork/)

### knowledge-extraction - Extract Knowledge from Codebases

Extract and manage knowledge from codebases for AI agent context.

**Key Features:**
- Pattern-based knowledge extraction
- Markdown documentation generation
- Context management for AI agents
- Integration with ultrawork and teamwork

**Requirements:** Bun installed

[Full Documentation →](plugins/knowledge-extraction/)

## Prerequisites

Before using plugins from this marketplace, ensure you have:

- **Claude Code CLI** (latest version with plugin support)
  - Download: https://claude.ai/download
- **Bun 1.3+** (runtime for all plugins)
  - Installation: https://bun.sh/
- **Git** (version control)
  - Required for repository operations
- **Platform**: Windows, MacOS, or Linux
  - All plugins are cross-platform compatible

## Quick Start

### Installation

```bash
# Add marketplace
claude plugin marketplace add mnthe/hardworker-marketplace

# Install verification-first development
claude plugin install ultrawork@hardworker-marketplace

# Install multi-session collaboration
claude plugin install teamwork@hardworker-marketplace

# Install knowledge extraction
claude plugin install knowledge-extraction@hardworker-marketplace
```

### Example: ultrawork Session

```bash
# Start verification-first development session
/ultrawork "implement user authentication with JWT"

# System creates plan with tasks and success criteria
# Worker agents execute tasks in parallel
# Verifier checks all criteria with concrete evidence
# Auto-retry on failures (max 5 iterations)

# Check status
/ultrawork-status

# View collected evidence
/ultrawork-evidence

# Cancel if needed
/ultrawork-cancel
```

### Example: teamwork Session

```bash
# Terminal 1: Start coordination
/teamwork "build REST API with tests and docs"

# Terminal 2: Backend worker (continuous mode)
/teamwork-worker --role backend --loop

# Terminal 3: Test worker (continuous mode)
/teamwork-worker --role test --loop

# Terminal 4: Docs worker (one-shot)
/teamwork-worker --role docs

# Terminal 1: Check status
/teamwork-status
```

## Architecture

### Design Principles

1. **Evidence-Based Completion**: No task marked complete without concrete proof (test output, file paths, command exit codes)
2. **Session Isolation**: Each session has unique ID with isolated state directory
3. **Verification-First**: Plan → Execute → Verify loop with auto-retry on failure
4. **Parallel Execution**: Worker agents execute independent tasks concurrently
5. **Hook-Based Automation**: Lifecycle hooks enable continuous mode without custom Claude Code builds

### State Management

| Plugin               | Storage Pattern             | Location                                     |
| -------------------- | --------------------------- | -------------------------------------------- |
| ultrawork            | Session-based isolation     | `~/.claude/ultrawork/sessions/{session-id}/` |
| teamwork             | Project-based collaboration | `~/.claude/teamwork/{project}/{team}/`       |
| knowledge-extraction | Cache-based storage         | `~/.claude/knowledge-extraction/cache/`      |

### Component Architecture

```
Command (.md)
    ↓
Agent (AGENT.md)
    ↓
Script (.js)
    ↓
State (JSON files)
```

**ultrawork Workflow:**
```
/ultrawork "goal"
    ↓
Explorer Agent → Gathers codebase context
    ↓
Planner Agent → Creates task graph with dependencies
    ↓
Worker Agents (parallel) → Execute tasks with evidence collection
    ↓
Verifier Agent → Validates all criteria met
    ↓ (if failed, max 5 retries)
Worker Agents → Fix issues
    ↓
Complete (all criteria met with evidence)
```

**teamwork Workflow:**
```
/teamwork "goal"              # Terminal 1
    ↓
Coordinator → Creates role-based tasks
    ↓
/teamwork-worker --loop       # Terminal 2, 3, 4...
    ↓
Workers claim tasks by role
    ↓
Parallel execution across terminals
    ↓
Complete (all tasks done)
```

### Hook System

All plugins use lifecycle hooks for automation:

| Hook Type       | Purpose                                     |
| --------------- | ------------------------------------------- |
| session-start   | Initialize session context                  |
| session-context | Inject session variables into agent prompts |
| post-tool-use   | Evidence collection after tool execution    |
| agent-lifecycle | Track agent execution state                 |

Hooks enable continuous mode without modifying Claude Code core.

## Contributing

### Version Sync Requirement

**CRITICAL:** When updating plugin versions, you MUST sync both files:

1. Update `plugins/{plugin}/.claude-plugin/plugin.json`
2. Update `.claude-plugin/marketplace.json` (MUST match!)

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

### Development Guidelines

**Script Requirements:**
- Bun scripts with JSDoc type annotations
- Flag-based parameters (no positional args)
- JSON output for structured data
- Error messages to stderr
- Exit codes: 0 (success), 1 (error)

**Testing:**
- Manual testing (no automated test framework)
- Syntax validation: run scripts directly with `bun src/scripts/*.js`
- Functional verification: create session, verify JSON structure

**Version Bumps:**

| Change Type       | Version Bump  | Examples                            |
| ----------------- | ------------- | ----------------------------------- |
| Bug fix, typo fix | Patch (0.0.x) | Script error fix, docs typo         |
| New command/agent | Minor (0.x.0) | Add new agent, new command          |
| Breaking change   | Major (x.0.0) | Change state format, remove command |

**Commit Convention:**
```
feat(plugin): Add new feature
fix(plugin): Fix bug
docs(plugin): Update documentation
refactor(plugin): Refactor code
```

### Code Review Checklist

- [ ] Flag-based parameter parsing in Bun scripts
- [ ] Error handling with meaningful messages
- [ ] No hardcoded paths (use environment variables)
- [ ] JSON validation before writes
- [ ] JSDoc type annotations for clarity
- [ ] CLAUDE.md updated with changes
- [ ] Version synced: `plugin.json` == `marketplace.json`

## Plugin Structure

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

## License

MIT
