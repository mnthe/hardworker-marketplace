# hardworker-marketplace

Claude Code plugin marketplace focused on "hardworker" productivity patterns: verification-first development, multi-session collaboration, and evidence-based completion.

## Features

### ultrawork - Verification-First Development (Bash)

Strict verification-first development mode with session isolation and mandatory evidence collection.

**Key Features:**
- Session isolation with unique IDs
- Mandatory planning with success criteria
- Evidence-based completion (no "should work" claims)
- Execute→Verify loop (auto-retry on failure, max 5 iterations)
- Zero tolerance for partial implementation
- Parallel task execution with worker agents
- File-based state management with jq

**Requirements:** bash 3.2+, jq, git

[Full Documentation →](plugins/ultrawork/)

### ultrawork-js - Verification-First Development (Node.js)

Cross-platform Node.js version of ultrawork with identical functionality.

**Key Features:**
- All features of ultrawork (bash version)
- Cross-platform: Windows, MacOS, Linux
- No jq dependency (native JSON parsing)
- Pure JavaScript with JSDoc type annotations
- No build step required

**Requirements:** Node.js 18+ (bundled with Claude Code)

[Full Documentation →](plugins/ultrawork-js/)

### teamwork - Multi-Session Collaboration

Role-based worker agents for parallel development across multiple terminal sessions.

**Key Features:**
- Role-based worker agents (frontend, backend, devops, test, docs, security, review)
- File-per-task storage for concurrent access
- Continuous loop mode (hook-based auto-continue)
- Dashboard status overview
- Project and team isolation
- Works with vanilla Claude Code

**Requirements:** bash 3.2+, jq, git

[Full Documentation →](plugins/teamwork/)

## Quick Start

### Installation

```bash
# Add marketplace
claude plugin marketplace add mnthe/hardworker-marketplace

# Install verification-first development (choose one)
claude plugin install ultrawork@hardworker-marketplace        # Bash version
claude plugin install ultrawork-js@hardworker-marketplace     # Node.js version

# Install multi-session collaboration
claude plugin install teamwork@hardworker-marketplace
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

| Plugin | Storage Pattern | Location |
|--------|-----------------|----------|
| ultrawork | Session-based isolation | `~/.claude/ultrawork/sessions/{session-id}/` |
| ultrawork-js | Session-based isolation | `~/.claude/ultrawork/sessions/{session-id}/` |
| teamwork | Project-based collaboration | `~/.claude/teamwork/{project}/{team}/` |

### Component Architecture

```
Command (.md)
    ↓
Agent (AGENT.md)
    ↓
Script (.sh or .js)
    ↓
State (JSON files)
```

**ultrawork/ultrawork-js Workflow:**
```
/ultrawork "goal"
    ↓
Planner Agent → Creates task graph with dependencies
    ↓
Explorer Agent → Gathers codebase context
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

| Hook Type | Purpose |
|-----------|---------|
| session-start | Initialize session context |
| session-context | Inject session variables into agent prompts |
| post-tool-use | Evidence collection after tool execution |
| agent-lifecycle | Track agent execution state |

Hooks enable continuous mode without modifying Claude Code core.

## Contributing

### Version Sync Requirement

**CRITICAL:** When updating plugin versions, you MUST sync both files:

1. Update `plugins/{plugin}/.claude-plugin/plugin.json`
2. Update `.claude-plugin/marketplace.json` (MUST match!)

```bash
# Verify version sync
diff <(jq -r '.version' plugins/ultrawork/.claude-plugin/plugin.json) \
     <(jq -r '.plugins[] | select(.name=="ultrawork") | .version' .claude-plugin/marketplace.json)
```

### Dual-Version Maintenance: ultrawork / ultrawork-js

When making changes to ultrawork or ultrawork-js, you MUST update both versions:

| Change Type | Action |
|-------------|--------|
| Feature addition | Implement in both Bash and Node.js |
| Bug fix | Apply to both versions |
| Schema change | Sync session.json, task.json structure |
| Version bump | Keep version numbers identical |

```bash
# Check for differences
diff -r plugins/ultrawork/scripts/ plugins/ultrawork-js/src/scripts/ --brief
diff -r plugins/ultrawork/hooks/ plugins/ultrawork-js/src/hooks/ --brief
```

### Development Guidelines

**Script Requirements:**
- Bash scripts: `set -euo pipefail` strict mode
- Flag-based parameters (no positional args)
- JSON output for structured data
- Error messages to stderr
- Exit codes: 0 (success), 1 (error)

**Testing:**
- Manual testing (no automated test framework)
- Syntax validation: `bash -n scripts/*.sh`
- Functional verification: create session, verify JSON structure

**Version Bumps:**

| Change Type | Version Bump | Examples |
|-------------|--------------|----------|
| Bug fix, typo fix | Patch (0.0.x) | Script error fix, docs typo |
| New command/agent | Minor (0.x.0) | Add new agent, new command |
| Breaking change | Major (x.0.0) | Change state format, remove command |

**Commit Convention:**
```
feat(plugin): Add new feature
fix(plugin): Fix bug
docs(plugin): Update documentation
refactor(plugin): Refactor code
```

### Code Review Checklist

- [ ] `set -euo pipefail` in all Bash scripts
- [ ] Flag-based parameter parsing
- [ ] Error handling with meaningful messages
- [ ] No hardcoded paths (use environment variables)
- [ ] JSON validation before writes
- [ ] CLAUDE.md updated with changes
- [ ] Version synced: `plugin.json` == `marketplace.json`
- [ ] Dual-version sync: ultrawork == ultrawork-js (if applicable)

## Plugin Structure

```
plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json      # Plugin metadata (REQUIRED)
├── commands/            # Command definitions (.md)
├── agents/              # Agent definitions (AGENT.md)
├── scripts/             # Bash implementations (.sh)
├── hooks/               # Lifecycle hooks
│   └── hooks.json       # Hook configuration
├── skills/              # Skill definitions (optional)
├── CLAUDE.md            # Plugin-level context (REQUIRED)
└── README.md            # User documentation (REQUIRED)
```

## License

MIT
