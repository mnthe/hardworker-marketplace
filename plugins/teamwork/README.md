# teamwork

Native teammate-based collaboration plugin for Claude Code. Enables multi-agent project execution with role-based workers and event-driven coordination.

## Overview

Teamwork v3 uses Claude Code's native agent teams API for multi-agent collaboration. The orchestrator operates in delegate mode -- it plans tasks, spawns workers as native teammates, and coordinates through `TaskCreate`, `TaskUpdate`, `SendMessage`, and event hooks.

**Key capabilities:**
- Native Claude Code agent teams (no tmux/shell spawning)
- Orchestrator in delegate mode (plans and coordinates, never writes code)
- Role-based task assignment (frontend, backend, test, devops, docs, security, review)
- Event-driven coordination via `TaskCompleted` and `TeammateIdle` hooks
- Project-level verification via final-verifier agent
- Dashboard status view with progress tracking
- Cross-platform support (Windows, macOS, Linux)

## Requirements

- **Claude Code CLI**: Latest version with agent teams support
- **Bun**: 1.3+ for script execution
- **Git**: For project/team name detection (optional)
- **Agent Teams**: Must be enabled in Claude Code configuration (`CLAUDE_AGENT_TEAMS=1` or equivalent setting)

## Installation

### From Marketplace

```bash
claude plugin marketplace add mnthe/hardworker-marketplace
claude plugin install teamwork@hardworker-marketplace
```

### Local Development

```bash
claude --plugin-dir /path/to/teamwork
```

## Usage

### Start a Project

```bash
# Start project with goal (orchestrator plans and spawns workers)
/teamwork "build REST API with authentication and tests"

# Start with plan documents
/teamwork --plans docs/api-spec.md docs/design.md
```

### Check Progress

```bash
# Basic status
/teamwork-status

# Detailed task list
/teamwork-status --verbose
```

### Manual Worker (Optional)

```bash
# Workers are spawned automatically by the orchestrator.
# Manual worker for ad-hoc task execution:
/teamwork-worker --role backend
```

### Cleanup

```bash
# Clean project to start fresh
/teamwork-clean
```

## Commands

| Command | Description | Options |
|---------|-------------|---------|
| `/teamwork <goal>` | Start coordination session | `--project NAME`, `--team NAME`, `--plans FILE...` |
| `/teamwork-status` | View dashboard with progress | `--project NAME`, `--team NAME`, `--verbose` |
| `/teamwork-worker` | Manual task execution | `--role ROLE`, `--project NAME`, `--team NAME` |
| `/teamwork-verify` | Trigger manual verification | `--final`, `--project NAME`, `--team NAME` |
| `/teamwork-clean` | Clean project state | `--project NAME`, `--team NAME` |

## Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| **orchestrator** | opus | Planning, worker spawning, task assignment, coordination |
| **final-verifier** | opus | Project-level build/test verification |
| **worker** | dynamic | General purpose task execution |
| **frontend** | dynamic | UI components, styling, state management |
| **backend** | dynamic | API endpoints, services, database |
| **test** | dynamic | Unit tests, integration tests |
| **devops** | dynamic | CI/CD, deployment, infrastructure |
| **docs** | dynamic | Documentation, README, examples |
| **security** | dynamic | Authentication, authorization, validation |
| **review** | dynamic | Code review, refactoring |

Dynamic model selection: `simple` -> haiku, `standard` -> sonnet, `complex` -> opus.

## How It Works

### Architecture

```
Orchestrator (delegate mode, Opus)
    |
    +-- TaskCreate / TaskUpdate / SendMessage
    |
    +-- Workers (native teammates)
    |   |-- backend, frontend, test, devops
    |   |-- docs, security, review, worker
    |
    +-- Hooks (event-driven)
    |   |-- TaskCompleted -> track progress
    |   |-- TeammateIdle -> assign next task
    |
    +-- Final Verifier (project validation)
```

### Workflow

1. **PLANNING**: Orchestrator explores codebase, decomposes goal into tasks via `TaskCreate`, sets dependencies
2. **EXECUTION**: Orchestrator spawns role-specific workers as native teammates, assigns tasks, reacts to completion events
3. **VERIFICATION**: Final verifier runs full build/test, checks evidence completeness
4. **COMPLETE**: All tasks verified, project finished

### Coordination Model

The orchestrator uses Claude Code's native API for all coordination:

| Operation | API |
|-----------|-----|
| Create tasks | `TaskCreate` |
| List tasks | `TaskList` |
| Assign/update tasks | `TaskUpdate` |
| Communicate | `SendMessage` |
| Spawn workers | `Task(teamwork:backend)`, etc. |
| React to events | `TaskCompleted` hook, `TeammateIdle` hook |

## Storage

```
~/.claude/teamwork/{project}/{team}/
    project.json      # Project metadata and stats
    tasks/
        1.json        # Individual task files
        2.json
        ...
```

### Task Statuses

- `open` - Available for assignment
- `in_progress` - Assigned to a worker
- `resolved` - Completed with evidence

### Project Phases

- `PLANNING` - Orchestrator analyzing and creating tasks
- `EXECUTION` - Workers implementing tasks
- `VERIFICATION` - Final verification in progress
- `COMPLETE` - All tasks verified

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `--project` | Git repo name | Override project name |
| `--team` | Git branch name | Override team name |
| `--role` | none (all roles) | Filter tasks by role |
| `--verbose` | false | Show detailed task information |

### Role Assignment

| Role | Use Cases |
|------|-----------|
| `frontend` | UI components, styling, user interactions |
| `backend` | API endpoints, services, database |
| `test` | Unit tests, integration tests |
| `devops` | CI/CD, deployment, infrastructure |
| `docs` | Documentation, README, examples |
| `security` | Authentication, authorization, validation |
| `review` | Code review, refactoring suggestions |
| `worker` | General purpose (claims any role) |

## Troubleshooting

### Worker Not Finding Tasks

```bash
# Check if tasks exist
/teamwork-status --verbose

# Verify project and team names match
/teamwork-status --project myapp --team feature-123
```

### Project State Issues

```bash
# Clean and restart
/teamwork-clean
/teamwork "your goal"
```

## License

MIT
