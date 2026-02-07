# hardworker-marketplace

Claude Code plugin marketplace focused on "hardworker" productivity patterns: verification-first development, multi-session collaboration, and evidence-based completion.

## TL;DR

- **ultrawork** - Strict verification-first development. Use for solo features with evidence requirements.
- **teamwork** - Multi-session collaboration. Use for team projects with parallel workers.
- **knowledge-extraction** - Capture and extract insights. Use for learning and documentation.

**Quick Install:**
```bash
claude plugin marketplace add mnthe/hardworker-marketplace
claude plugin install ultrawork@hardworker-marketplace
```

[Detailed Comparison →](#plugin-comparison) | [Architecture →](#architecture-overview)

---

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

# Check status
/ultrawork-status
```

### Example: teamwork Session

```bash
# Start coordination (orchestrator spawns native teammates automatically)
/teamwork "build REST API with tests and docs"

# Orchestrator creates tasks, spawns role-based workers as native teammates
# Workers execute tasks, coordinate via SendMessage
# Event-driven: TaskCompleted and TeammateIdle hooks drive progress

# Check status
/teamwork-status
```

## Which Plugin Should I Use?

| Scenario | Recommendation |
|----------|----------------|
| Solo developer, strict verification | **ultrawork** |
| Team collaboration, parallel work | **teamwork** |
| Capturing code patterns and insights | **knowledge-extraction** |
| CI/CD and automation | **ultrawork --auto** |
| Parallel agent collaboration | **teamwork** |
| TDD workflow enforcement | **ultrawork** |

See [Detailed Scenarios](#decision-guide) below for more guidance.

---

## Plugins

### ultrawork - Verification-First Development

Strict verification-first development mode with session isolation and mandatory evidence collection.

**Key Features:** Session isolation, mandatory planning with success criteria, evidence-based completion, Execute→Verify loop with auto-retry, parallel task execution, cross-platform support.

**[Full Documentation →](plugins/ultrawork/)**

### teamwork - Native Teammate Collaboration

Role-based worker agents for parallel development using Claude Code's native teammate API.

**Key Features:** Role-based worker agents (frontend, backend, devops, test, docs, security, review), native teammate API, event-driven coordination (TaskCompleted, TeammateIdle hooks), dashboard status, project and team isolation.

**[Full Documentation →](plugins/teamwork/)**

### knowledge-extraction - Extract Knowledge from Codebases

Extract and manage knowledge from codebases for AI agent context.

**Key Features:** Pattern-based knowledge extraction, markdown documentation generation, context management for AI agents, integration with ultrawork and teamwork.

**[Full Documentation →](plugins/knowledge-extraction/)**

## Plugin Comparison

| Feature | ultrawork | teamwork | knowledge-extraction |
|---------|-----------|----------|---------------------|
| **Primary Use Case** | Solo developer, strict verification | Agent team collaboration, parallel work | Pattern capture, documentation |
| **Session Model** | Single session, isolated worktree | Single session, native teammate API | Session-based insights |
| **Verification** | Mandatory, multi-tier (task + final) | Final verifier agent | Not applicable |
| **Evidence Collection** | Automatic via hooks | Structured via workers | Insight extraction |
| **Concurrency** | Parallel workers, single session | Native teammates, event-driven coordination | Single session |
| **Role Specialization** | No | Yes (8 worker roles) | No |
| **Auto Mode** | Yes (`--auto` flag) | No (interactive only) | No (hook-based) |
| **Best For** | Feature implementation, bug fixes | Large features, parallel agent work | Learning, documentation |

## Architecture Overview

### System Architecture

```mermaid
flowchart TD
    CLI[Claude Code CLI] --> Commands
    CLI --> Hooks[Lifecycle Hooks]

    subgraph ultrawork
        UW_CMD["/ultrawork"] --> UW_AGENTS[6 Agents]
        UW_AGENTS --> UW_STATE["~/.claude/ultrawork/"]
        Hooks --> UW_HOOKS["Evidence/Gates"]
        UW_HOOKS --> UW_STATE
    end

    subgraph teamwork
        TW_CMD["/teamwork"] --> TW_AGENTS[10 Agents]
        TW_AGENTS --> TW_STATE["~/.claude/teamwork/"]
        Hooks --> TW_HOOKS[Event Hooks]
        TW_HOOKS --> TW_STATE
    end

    subgraph knowledge-extraction
        KE_CMD["/insights"] --> KE_AGENT[Extractor]
        Hooks --> KE_HOOKS[Auto Extract]
        KE_HOOKS --> KE_STATE["~/.claude/knowledge-extraction/"]
        KE_AGENT --> KE_STATE
    end

    Commands --> UW_CMD
    Commands --> TW_CMD
    Commands --> KE_CMD

    UW_STATE -.-> KE_HOOKS
    TW_STATE -.-> KE_HOOKS
```

### Data Flow

1. **ultrawork**: Goal → Explorer → Planner → Workers (parallel) → Verifier → Complete
2. **teamwork**: Goal → Orchestrator → Tasks ← Workers (native teammates) → Verification → Complete
3. **knowledge-extraction**: Session → Hooks → Storage → Extract → Components

## Decision Guide

#### Scenario 1: Solo Developer, Single Feature Implementation

**Recommendation: ultrawork**

Use ultrawork when:
- Working alone on a well-defined feature
- Need strict verification and evidence
- Want automatic retry on failures
- Require TDD workflow enforcement
- Need session isolation (worktree support)

```bash
/ultrawork "implement user authentication with JWT"
```

#### Scenario 2: Team Collaboration, Large Feature

**Recommendation: teamwork**

Use teamwork when:
- Need parallel agent collaboration on a project
- Tasks can be parallelized across roles
- Need specialization (frontend, backend, test, etc.)
- Want event-driven coordination with native teammate API
- Require final verification by dedicated verifier agent

```bash
# Single session: Orchestrator spawns and coordinates native teammates
/teamwork "build REST API with authentication"

# Orchestrator automatically:
# - Creates tasks via TaskCreate
# - Spawns workers: Task(teamwork:backend), Task(teamwork:frontend), etc.
# - Assigns tasks via TaskUpdate(owner)
# - Monitors via TaskCompleted and TeammateIdle hooks
```

#### Scenario 3: Strict Verification Required

**Recommendation: ultrawork**

Use ultrawork when:
- Zero tolerance for incomplete work
- Need blocked pattern detection ("TODO", "FIXME")
- Require concrete evidence for every success criterion
- Want automatic execute→verify retry loop
- Need final verifier to audit all evidence

#### Scenario 4: Parallel Agent Development

**Recommendation: teamwork**

Use teamwork when:
- Need multiple agents working in parallel
- Workers should receive tasks from orchestrator
- Need role-based task assignment
- Require event-driven coordination
- Want native teammate API for agent lifecycle management

#### Scenario 5: Capturing Code Patterns and Insights

**Recommendation: knowledge-extraction**

Use knowledge-extraction when:
- Want to learn from past sessions
- Need to document discovered patterns
- Building reusable skills and commands
- Creating project-specific rules files
- Extracting architectural decisions

```bash
# During any session, Claude generates insights
★ Insight ─────────────────────────────────────
JWT tokens should include minimal claims.
─────────────────────────────────────────────────

# Later, extract to components
/insights extract
```

#### Scenario 6: CI/CD and Automation

**Recommendation: ultrawork --auto**

Use ultrawork auto mode when running in CI/CD pipelines with no user interaction possible, well-defined tasks with clear criteria, or need fully autonomous operation.

```bash
/ultrawork --auto "add unit tests for payment module"
```

## Skills System Overview

Plugins provide reusable skills that can be referenced by agents and commands. Skills are markdown files containing documented patterns, workflows, and best practices.

### ultrawork Skills (15 skills)

Core workflow skills: **planning** (task decomposition), **overview-exploration** (project discovery), **ultrawork** (session lifecycle), **tdd-workflow** (test-first enforcement).

Utility skills: **scripts-path-usage** (script access), **data-access-patterns** (state reading), **utility-scripts** (common patterns).

Review skills: **code-quality-review**, **architecture-review**, **security-review**, **consistency-review**.

Pattern skills: **backend-patterns**, **frontend-patterns**, **security-patterns**, **testing-patterns**.

**Key Pattern:** All agents use `scripts-path-usage` for correct script invocation.

### teamwork Skills (4 skills)

Core workflow skills: **worker-workflow** (task execution with native API), **event-coordination** (hook-based orchestration patterns), **task-decomposition** (parallel planning with role assignment), **teamwork-clean** (project reset).

**Key Pattern:** The `worker-workflow` skill is shared by all 8 role-specific workers. The `event-coordination` skill drives the orchestrator's hook-based coordination via `TaskCompleted` and `TeammateIdle` events.

### knowledge-extraction Skills (1 skill)

**insight-awareness**: Documents `★ Insight` format and automatic capture workflow. Operates primarily via hooks.

### Skills Invocation

Skills are referenced in agent frontmatter:

```yaml
---
name: worker
skills: [scripts-path-usage, data-access-patterns, worker-workflow]
---
```

Skills are also available as standalone commands in Claude Code CLI (when skill has frontmatter with `command: true`).

## Troubleshooting

### Issue 1: Version Mismatch Between plugin.json and marketplace.json

**Symptom:** Plugin updates not reflected after installation from marketplace.

**Cause:** `plugins/{plugin}/.claude-plugin/plugin.json` version doesn't match `.claude-plugin/marketplace.json` version.

**Solution:**

```bash
# Verify version sync
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

**Prevention:** Always update both files when bumping plugin version.

### Issue 2: Session Not Found (ultrawork)

**Symptom:** Command fails with "Session not found" error.

**Solution:** List sessions with `/ultrawork-status --all`. Verify `$CLAUDE_SESSION_ID` is set. Sessions in terminal states are auto-deleted after 7 days.

### Issue 3: Workers Not Receiving Tasks (teamwork)

**Symptom:** Spawned workers are idle and not executing tasks.

**Solution:** Check `/teamwork-status`. Verify the orchestrator has created tasks via `TaskCreate` and assigned them via `TaskUpdate(owner)`. Check that `TaskCompleted` and `TeammateIdle` hooks are registered in `hooks/hooks.json`. Workers receive tasks through orchestrator assignment, not self-claiming.

### Issue 4: Evidence Collection Failing (ultrawork)

**Symptom:** Verifier reports "missing evidence" despite task completion.

**Solution:** View `/ultrawork-evidence`. Verify evidence includes command, output, and exit code. Check for blocked patterns ("should work", "TODO", "FIXME"). Ensure hooks are registered in hooks.json.

### Issue 5: Hook Not Triggering (all plugins)

**Symptom:** Expected hook behavior doesn't occur (evidence not collected, insights not captured, gates not enforced).

**Solution:** Verify Bun is installed (`bun --version`). Check hook registration in `hooks/hooks.json`. Test manually: `echo '{"session_id": "test"}' | bun hook-script.js`. Use explicit `bun` prefix in hooks.json for cross-platform compatibility.


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
