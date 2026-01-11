# teamwork

Cross-platform JavaScript/Node.js version of the teamwork plugin for Claude Code. Uses JavaScript with JSDoc type annotations (no TypeScript build step required).

## Features

- Role-based worker agents (frontend, backend, devops, etc.)
- File-per-task storage
- Continuous loop mode (hook-based auto-continue)
- Dashboard status overview
- **Cross-platform**: Works on Windows, MacOS, and Linux

## Installation

```bash
claude plugin marketplace add mnthe/hardworker-marketplace
claude plugin install teamwork@hardworker-marketplace
```

## Usage

```bash
# Start teamwork session (planning)
/teamwork "build REST API with tests"

# Check status
/teamwork-status

# One-shot worker
/teamwork-worker

# Continuous worker (keeps working until no tasks left)
/teamwork-worker --loop

# Role-specific continuous worker
/teamwork-worker --role backend --loop

# Specific project/team
/teamwork-worker --project myapp --team feature-x --loop
```

## Commands

| Command | Description |
|---------|-------------|
| `/teamwork "goal"` | Start coordination session |
| `/teamwork-status` | View dashboard |
| `/teamwork-worker` | Claim and complete one task |

## Worker Options

| Option | Description |
|--------|-------------|
| `--loop` | Continuous mode - keep working until done |
| `--role ROLE` | Only claim tasks with this role |
| `--project NAME` | Override project name |
| `--team NAME` | Override team name |

## Agents

| Agent | Role |
|-------|------|
| **coordinator** | Orchestrates overall workflow |
| **frontend** | UI/UX implementation |
| **backend** | API and business logic |
| **devops** | CI/CD, deployment |
| **test** | Test implementation |
| **docs** | Documentation |
| **security** | Security review |
| **review** | Code review |
| **worker** | General purpose |

## How It Works

```
/teamwork "goal"              # Terminal 1: Planning
    ↓
Coordinator creates tasks
    ↓
/teamwork-worker --loop       # Terminal 2: Backend worker
/teamwork-worker --loop       # Terminal 3: Frontend worker
    ↓
Tasks completed in parallel
```

## Loop Mode

`--loop` mode uses hook-based continuation:
1. Worker claims and completes a task
2. If more tasks available → outputs `__TEAMWORK_CONTINUE__`
3. Stop hook detects marker and re-triggers worker
4. Loop continues until no more tasks

State is tracked per-terminal in `~/.claude/teamwork/.loop-state/`

## Requirements

- Node.js 18+ (bundled with Claude Code)
- No external dependencies

## License

MIT
