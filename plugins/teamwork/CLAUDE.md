# teamwork

Multi-session collaboration plugin with role-based workers.

## Plugin Description

Teamwork enables multi-session collaboration where:
1. **COORDINATION**: Coordinator agent explores codebase and decomposes work into tasks
2. **EXECUTION**: Multiple workers claim and complete tasks in parallel sessions
3. **SYNCHRONIZATION**: Workers coordinate through shared task files with atomic locking

Key features:
- Project-based task management
- Role-based worker specialization (frontend, backend, devops, test, docs, security, review)
- Atomic task claiming with file-based locking
- Loop detection for continuous worker execution
- Multi-terminal coordination via shared state

## File Structure

```
plugins/teamwork/
├── src/
│   ├── lib/
│   │   ├── types.js           # JSDoc type definitions (@typedef)
│   │   ├── file-lock.js       # Cross-platform file locking
│   │   ├── project-utils.js   # Project and task path utilities
│   │   └── args.js            # Common argument parsing
│   ├── scripts/               # CLI scripts (10 files)
│   │   ├── setup-teamwork.js
│   │   ├── project-create.js
│   │   ├── project-get.js
│   │   ├── task-create.js
│   │   ├── task-get.js
│   │   ├── task-list.js
│   │   ├── task-claim.js
│   │   ├── task-update.js
│   │   ├── loop-state.js
│   │   └── worker-setup.js
│   └── hooks/                 # Lifecycle hooks (1 file)
│       └── loop-detector.js
├── agents/                    # Agent definitions
│   ├── coordinator/
│   ├── worker/
│   ├── frontend/
│   ├── backend/
│   ├── devops/
│   ├── test/
│   ├── docs/
│   ├── security/
│   └── review/
├── commands/                  # Command definitions
├── hooks/
│   └── hooks.json            # Hook configuration
└── CLAUDE.md                 # This file
```

## Script Inventory

All scripts use Bun runtime with flag-based parameters.

| Script | Purpose | Key Parameters |
|--------|---------|----------------|
| **setup-teamwork.js** | Initialize teamwork environment | (no parameters) |
| **project-create.js** | Create new project with metadata | `--dir <path>` `--project <name>` `--team <name>` `--goal "..."` |
| **project-get.js** | Get project metadata | `--dir <path>` `--field <field_name>` |
| **task-create.js** | Create new task file | `--project <name>` `--team <name>` `--id <id>` `--title "..."` `--description "..."` `--role <role>` |
| **task-get.js** | Get single task details | `--dir <path>` `--id <id>` `--field <field_name>` |
| **task-list.js** | List all tasks in project | `--dir <path>` `--available` `--role <role>` `--format json\|table` |
| **task-claim.js** | Atomically claim a task | `--dir <path>` `--id <id>` `--owner <session_id>` |
| **task-update.js** | Update task status/evidence | `--dir <path>` `--id <id>` `--status open\|in_progress\|resolved` `--add-evidence "..."` `--release` |
| **loop-state.js** | Manage worker loop state | `--get` `--set --project <name> --team <name> --role <role>` `--clear` |
| **worker-setup.js** | Setup worker session context | `--project <name>` `--team <name>` `--role <role>` |

## Hook Inventory

All hooks run on `bun` runtime. Hooks are idempotent and non-blocking.

| Hook File | Event | Purpose | Behavior |
|-----------|-------|---------|----------|
| **loop-detector.js** | Stop | Detect continuation marker and trigger next worker iteration | Checks for `__TEAMWORK_CONTINUE__` marker in agent output, continues worker loop if found |

## Agent Inventory

| Agent | Model | Role | Key Responsibilities |
|-------|-------|------|---------------------|
| **coordinator** | opus | Project setup and task decomposition | Explore codebase, break down work into tasks, assign roles, create task files, maximize parallelism |
| **worker** | inherit | General purpose task execution | Find available tasks, claim atomically, implement, collect evidence, mark resolved |
| **frontend** | inherit | Frontend development specialist | UI components, styling, state management, user interactions, responsive design, accessibility |
| **backend** | inherit | Backend development specialist | API endpoints, services, database, business logic, data validation |
| **devops** | inherit | DevOps and infrastructure specialist | CI/CD, deployment, infrastructure, containerization, monitoring |
| **test** | inherit | Testing specialist | Unit tests, integration tests, fixtures, mocks, test coverage |
| **docs** | inherit | Documentation specialist | README, API docs, examples, architectural documentation |
| **security** | inherit | Security specialist | Authentication, authorization, input validation, security audits |
| **review** | inherit | Code review specialist | Code quality, refactoring, best practices, architecture review |

## State Management

### Directory Structure

```
~/.claude/teamwork/
├── {project}/
│   └── {team}/
│       ├── project.json       # Project metadata
│       └── tasks/             # Task files (*.json)
│           ├── 1.json
│           ├── 2.json
│           └── 3.json
└── .loop-state/               # Worker loop state
    └── {terminal_id}.json
```

### Task State Format

**File**: `~/.claude/teamwork/{project}/{team}/tasks/{id}.json`

```json
{
  "id": "1",
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication middleware",
  "role": "backend",
  "status": "open",
  "created_at": "2026-01-12T10:00:00Z",
  "updated_at": "2026-01-12T10:05:00Z",
  "claimed_by": null,
  "claimed_at": null,
  "completed_at": null,
  "evidence": [
    "Created src/middleware/auth.ts",
    "npm test: 5/5 passed, exit 0"
  ]
}
```

**Task status values**: `open` | `in_progress` | `resolved`

**Role values**: `frontend` | `backend` | `devops` | `test` | `docs` | `security` | `review` | `worker`

### Project State Format

**File**: `~/.claude/teamwork/{project}/{team}/project.json`

```json
{
  "project": "my-app",
  "team": "auth-team",
  "goal": "Implement user authentication system",
  "created_at": "2026-01-12T10:00:00Z",
  "updated_at": "2026-01-12T10:05:00Z",
  "stats": {
    "total": 5,
    "open": 2,
    "in_progress": 1,
    "resolved": 2
  }
}
```

### Loop State Format

**File**: `~/.claude/teamwork/.loop-state/{terminal_id}.json`

```json
{
  "active": true,
  "project": "my-app",
  "team": "auth-team",
  "role": "backend",
  "started_at": "2026-01-12T10:00:00Z",
  "terminal_id": "abc-123"
}
```

## Development Rules

### Script Usage Pattern

```javascript
#!/usr/bin/env bun

// Flag-based parameters (required)
const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    params[key] = args[i + 1];
}

// Error messages to stderr
console.error('Error: --param required');

// JSON output for data
console.log(JSON.stringify({ status: 'success', data: {...} }));

// Exit codes
process.exit(0); // success
process.exit(1); // error
```

### Document Synchronization

**When modifying teamwork commands or agents, you MUST check and update the following files:**

| File | Location | Role |
|------|----------|------|
| `teamwork.md` | `commands/teamwork.md` | Coordination command (planning phase) |
| `teamwork-worker.md` | `commands/teamwork-worker.md` | Worker command (execution phase) |
| `teamwork-status.md` | `commands/teamwork-status.md` | Status dashboard command |
| `coordinator/AGENT.md` | `agents/coordinator/AGENT.md` | Main orchestration agent |
| `worker/AGENT.md` | `agents/worker/AGENT.md` | General purpose worker agent |
| Role agents | `agents/{role}/AGENT.md` | Specialized worker agents (frontend, backend, etc.) |

### Concurrency Safety

- Workers must claim tasks atomically (file-based locking)
- Task status updates must be atomic operations
- Multiple workers can run in parallel without conflicts

### Worker Coordination

- Each worker runs in separate terminal/session
- Workers claim tasks based on role matching
- Workers communicate through shared task files
- Coordinator monitors progress through task status

## Hook Configuration

**IMPORTANT**: hooks.json must use explicit `bun` prefix for cross-platform compatibility.

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/loop-detector.js"
      }]
    }]
  }
}
```

**Why explicit `bun`?**
- Shebang (`#!/usr/bin/env bun`) doesn't work on Windows
- Explicit runtime ensures cross-platform execution
- All hooks should follow this pattern

## No Build Step Required

Scripts run directly from source. No compilation needed.

## Usage Examples

### Create Project

```bash
bun src/scripts/project-create.js \
  --dir ~/.claude/teamwork/my-app/auth-team \
  --project my-app \
  --team auth-team \
  --goal "Implement user authentication"
```

### Create Task

```bash
bun src/scripts/task-create.js \
  --project my-app \
  --team auth-team \
  --id "1" \
  --title "Add auth middleware" \
  --description "Implement JWT-based authentication middleware" \
  --role backend
```

### List Available Tasks

```bash
# All available tasks
bun src/scripts/task-list.js \
  --dir ~/.claude/teamwork/my-app/auth-team \
  --available \
  --format json

# Filter by role
bun src/scripts/task-list.js \
  --dir ~/.claude/teamwork/my-app/auth-team \
  --available \
  --role backend
```

### Claim Task

```bash
bun src/scripts/task-claim.js \
  --dir ~/.claude/teamwork/my-app/auth-team \
  --id "1" \
  --owner session-abc-123
```

### Update Task

```bash
# Add evidence
bun src/scripts/task-update.js \
  --dir ~/.claude/teamwork/my-app/auth-team \
  --id "1" \
  --add-evidence "Created src/middleware/auth.ts"

# Mark resolved
bun src/scripts/task-update.js \
  --dir ~/.claude/teamwork/my-app/auth-team \
  --id "1" \
  --status resolved \
  --add-evidence "npm test: 5/5 passed, exit 0"

# Release task (on failure)
bun src/scripts/task-update.js \
  --dir ~/.claude/teamwork/my-app/auth-team \
  --id "1" \
  --release
```

### Manage Loop State

```bash
# Get loop state
bun src/scripts/loop-state.js --get

# Set loop state
bun src/scripts/loop-state.js --set \
  --project my-app \
  --team auth-team \
  --role backend

# Clear loop state
bun src/scripts/loop-state.js --clear
```
