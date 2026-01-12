# teamwork

Multi-session collaboration plugin with role-based workers, file-per-task storage, and parallel execution support.

## Overview

Teamwork enables distributed collaboration across multiple Claude sessions. A coordinator breaks down project goals into tasks, and specialized workers claim and execute them in parallel. Each worker runs in its own terminal session, coordinating through shared task files.

**Key capabilities:**
- Role-based task assignment (frontend, backend, test, devops, etc.)
- File-per-task storage with atomic operations
- Continuous loop mode for unattended execution
- Dashboard status view with progress tracking
- Cross-platform support (Windows, MacOS, Linux)

## Features

- **Parallel Execution**: Multiple workers run simultaneously in separate terminals
- **Role Specialization**: Workers filter tasks by role (frontend, backend, test, etc.)
- **Atomic Operations**: File-based locking prevents race conditions
- **Loop Mode**: Workers automatically claim next task until project complete
- **Progress Dashboard**: Real-time status view with completion metrics
- **Zero Build Step**: Pure JavaScript with JSDoc types (no TypeScript compilation)

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

### Basic Workflow

```bash
# Terminal 1: Start project (coordination)
/teamwork "build REST API with authentication and tests"

# Terminal 2: Start backend worker
/teamwork-worker --role backend --loop

# Terminal 3: Start frontend worker
/teamwork-worker --role frontend --loop

# Terminal 4: Check progress
/teamwork-status
```

### One-Shot Worker

```bash
# Complete one task then exit
/teamwork-worker
```

### Continuous Worker

```bash
# Keep claiming tasks until project complete
/teamwork-worker --loop

# Specialized continuous worker
/teamwork-worker --role backend --loop
```

### Status Dashboard

```bash
# Basic status
/teamwork-status

# Detailed task list
/teamwork-status --verbose
```

## Commands

| Command            | Description                                             | Options                                                                   |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/teamwork <goal>` | Start coordination session, create task breakdown       | `--project NAME`, `--team NAME`                                           |
| `/teamwork-status` | View dashboard with progress metrics and active workers | `--project NAME`, `--team NAME`, `--verbose`                              |
| `/teamwork-worker` | Claim and complete one task (one-shot mode)             | `--loop`, `--role ROLE`, `--project NAME`, `--team NAME`                  |

### Options

#### /teamwork

| Option           | Description                                    |
| ---------------- | ---------------------------------------------- |
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME`    | Override team name (default: git branch name)  |

#### /teamwork-worker

| Option           | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `--loop`         | Continuous mode - keep working until all tasks complete |
| `--role ROLE`    | Only claim tasks assigned to this role                  |
| `--project NAME` | Override project name detection                         |
| `--team NAME`    | Override team name detection                            |

#### /teamwork-status

| Option           | Description                                       |
| ---------------- | ------------------------------------------------- |
| `--project NAME` | Override project name detection                   |
| `--team NAME`    | Override team name detection                      |
| `--verbose`      | Show detailed task list with status and ownership |

## Agents

| Agent           | Model   | Purpose            | Key Responsibilities                                            |
| --------------- | ------- | ------------------ | --------------------------------------------------------------- |
| **coordinator** | opus    | Planning           | Breaks down goals into tasks, assigns roles, creates task files |
| **frontend**    | inherit | UI Implementation  | UI components, styling, user interactions                       |
| **backend**     | inherit | API Implementation | API endpoints, services, database, business logic               |
| **test**        | inherit | Testing            | Unit tests, integration tests, fixtures, mocks                  |
| **devops**      | inherit | Infrastructure     | CI/CD pipelines, deployment, infrastructure                     |
| **docs**        | inherit | Documentation      | README files, API documentation, examples                       |
| **security**    | inherit | Security           | Authentication, authorization, input validation                 |
| **review**      | inherit | Code Review        | Code review, refactoring suggestions                            |
| **worker**      | inherit | General Purpose    | Claims tasks for any role (fallback agent)                      |

## How It Works

### Phase 1: Coordination

```
/teamwork "build REST API"
    ↓
Coordinator agent spawned (uses Opus model)
    ↓
Analyzes codebase and requirements
    ↓
Creates task breakdown with roles
    ↓
Writes task files to shared directory
```

### Phase 2: Parallel Execution

```
Terminal 1: /teamwork-worker --role backend --loop
    ↓ (claims task #1: "Setup database schema")
    ↓ (completes task, marks resolved)
    ↓ (claims task #2: "Build API endpoints")

Terminal 2: /teamwork-worker --role frontend --loop
    ↓ (claims task #3: "Create login form")
    ↓ (completes task, marks resolved)
    ↓ (claims task #4: "Build dashboard")
```

### Phase 3: Monitoring

```
Terminal 3: /teamwork-status --verbose
    ↓
Shows progress dashboard:
- Overall completion percentage
- Per-role completion metrics
- Active workers and claimed tasks
- Blocked tasks waiting on dependencies
```

### Concurrency Safety

Teamwork handles multiple workers accessing shared state:

- **File-based locking**: Prevents race conditions during task claiming
- **Atomic operations**: Task status updates are transactional
- **Retry logic**: Workers retry on lock contention
- **Stale detection**: Workers detect when tasks are claimed by others

## Configuration

### Command Options

Teamwork is configured via command-line flags:

| Option           | Default             | Description                              |
| ---------------- | ------------------- | ---------------------------------------- |
| `--project`      | Git repo name       | Override project name                    |
| `--team`         | Git branch name     | Override team name                       |
| `--role`         | none (all roles)    | Filter tasks by role                     |
| `--loop`         | false               | Continuous mode (claim tasks until done) |
| `--verbose`      | false               | Show detailed task information           |

### Role Assignment

Tasks are assigned roles during coordination phase:

| Role         | Use Cases                                      |
| ------------ | ---------------------------------------------- |
| `frontend`   | UI components, styling, user interactions      |
| `backend`    | API endpoints, services, database              |
| `test`       | Unit tests, integration tests                  |
| `devops`     | CI/CD, deployment, infrastructure              |
| `docs`       | Documentation, README, examples                |
| `security`   | Authentication, authorization, validation      |
| `review`     | Code review, refactoring suggestions           |
| `worker`     | General purpose (claims any role)              |

## Storage

### Directory Structure

```
~/.claude/teamwork/{project}/{team}/
├── project.json              # Project metadata and statistics
└── tasks/
    ├── 1.json                # Individual task files
    ├── 2.json
    └── ...
```

### Task File Format

```json
{
  "id": "1",
  "title": "Setup database schema",
  "description": "Create user and post tables with migrations",
  "role": "backend",
  "status": "open",
  "created_at": "2026-01-12T10:30:00Z",
  "updated_at": "2026-01-12T10:30:00Z",
  "claimed_by": null,
  "evidence": []
}
```

**Task statuses:**
- `open`: Available for claiming
- `in_progress`: Claimed by a worker
- `resolved`: Completed with evidence

### Project File Format

```json
{
  "project": "my-app",
  "team": "feature-auth",
  "goal": "Build REST API with authentication",
  "created_at": "2026-01-12T10:30:00Z",
  "updated_at": "2026-01-12T10:35:00Z",
  "stats": {
    "total": 10,
    "open": 3,
    "in_progress": 2,
    "resolved": 5
  }
}
```

## Workflows

### Interactive Workflow

```bash
# Terminal 1: Start project coordination
/teamwork "build todo app with React frontend and Express backend"

# Terminal 2: Backend specialist
/teamwork-worker --role backend --loop

# Terminal 3: Frontend specialist
/teamwork-worker --role frontend --loop

# Terminal 4: Test specialist
/teamwork-worker --role test --loop

# Terminal 5: Monitor progress
/teamwork-status
```

### Single Developer Workflow

```bash
# Start project
/teamwork "implement user authentication"

# Work on one task at a time
/teamwork-worker

# Check what's left
/teamwork-status

# Continue with next task
/teamwork-worker
```

### Loop Mode Workflow

Loop mode uses hook-based continuation for unattended execution:

1. Worker completes a task
2. Outputs special marker: `__TEAMWORK_CONTINUE__`
3. Stop hook detects marker and checks for more tasks
4. Hook re-triggers `/teamwork-worker` with same context
5. Loop continues until no open tasks remain

**Loop state tracking:**
- State stored per-terminal in `~/.claude/teamwork/.loop-state/{pid}.json`
- Preserves project, team, and role filter across iterations
- Automatically cleaned up when loop exits

```bash
# Start continuous worker
/teamwork-worker --loop

# Or with role specialization
/teamwork-worker --role backend --loop
```

### Project Override Workflow

```bash
# Work on specific project/team combination
/teamwork-worker --project myapp --team bugfix-123 --loop
```

## Troubleshooting

### Worker Not Finding Tasks

```bash
# Check if tasks exist
/teamwork-status --verbose

# Verify project and team names match
/teamwork-status --project myapp --team feature-123
```

### Tasks Not Being Claimed

```bash
# Check role filter - workers with --role only claim matching tasks
/teamwork-worker --role backend

# Use general worker to claim any role
/teamwork-worker
```

### Multiple Workers Claiming Same Task

This should not happen due to file-based locking. If it does:
- Check filesystem supports atomic operations
- Verify no NFS or network filesystem issues
- Check for stale lock files in task directory

### Loop Mode Not Continuing

```bash
# Check loop state file
cat ~/.claude/teamwork/.loop-state/{pid}.json

# Verify stop hook is registered
# Loop mode requires hook system to be active
```

### Project State Corruption

```bash
# Task files are individual JSON files
# If corrupted, manually fix the specific task file
nano ~/.claude/teamwork/{project}/{team}/tasks/{id}.json

# Or delete corrupted task and recreate
rm ~/.claude/teamwork/{project}/{team}/tasks/{id}.json
```

## Requirements

- **Claude Code CLI**: Latest version with plugin support
- **Bun**: 1.3+ for script execution
- **Git**: For project/team name detection (optional)
- **Platform**: Windows, MacOS, or Linux
- **Filesystem**: Must support atomic file operations

## License

MIT
