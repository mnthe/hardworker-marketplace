# hardworker-marketplace

Claude Code plugin marketplace focused on "hardworker" productivity patterns: verification-first development, multi-session collaboration, and evidence-based completion.

## Plugins

### ultrawork - Verification-First Development

Strict verification-first development mode with session isolation and mandatory evidence collection.

**Key Features:** Session isolation, mandatory planning with success criteria, evidence-based completion, Execute→Verify loop with auto-retry, parallel task execution, cross-platform support.

**[Full Documentation →](plugins/ultrawork/)**

### teamwork - Multi-Session Collaboration

Role-based worker agents for parallel development across multiple terminal sessions.

**Key Features:** Role-based worker agents (frontend, backend, devops, test, docs, security, review), file-per-task storage, continuous loop mode, dashboard status, project and team isolation.

**[Full Documentation →](plugins/teamwork/)**

### knowledge-extraction - Extract Knowledge from Codebases

Extract and manage knowledge from codebases for AI agent context.

**Key Features:** Pattern-based knowledge extraction, markdown documentation generation, context management for AI agents, integration with ultrawork and teamwork.

**[Full Documentation →](plugins/knowledge-extraction/)**

## Prerequisites

- **Claude Code CLI** (latest version with plugin support) - https://claude.ai/download
- **Bun 1.3+** (runtime for all plugins) - https://bun.sh/
- **Git** (version control)
- **Platform**: Windows, MacOS, or Linux

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

## Contributing

See [CLAUDE.md](CLAUDE.md) for full development guidelines.

### Quick Guidelines

**Version Sync:** When updating plugin versions, MUST sync both `plugins/{plugin}/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.

**Script Requirements:**
- Flag-based parameters (no positional args)
- JSON output for structured data
- Exit codes: 0 (success), 1 (error)

**Version Bumps:**
- Patch (0.0.x): Bug fixes, typo fixes
- Minor (0.x.0): New commands/agents
- Major (x.0.0): Breaking changes

**Commit Convention:**
```
feat(plugin): Add new feature
fix(plugin): Fix bug
docs(plugin): Update documentation
refactor(plugin): Refactor code
```

## License

MIT
