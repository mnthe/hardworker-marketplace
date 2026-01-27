# teamwork

Multi-session collaboration plugin with role-based workers.

## Plugin Description

Teamwork enables multi-session collaboration where:
1. **PLANNING & MONITORING**: Unified orchestrator agent handles codebase exploration, task decomposition, and wave monitoring
2. **EXECUTION**: Multiple workers claim and complete tasks in parallel sessions
3. **VERIFICATION**: Wave-based verification ensures correctness at task, wave, and project levels
4. **SYNCHRONIZATION**: Workers coordinate through shared task files with optimistic concurrency control (OCC)

Key features:
- Project-based task management with wave-based execution
- Role-based worker specialization (frontend, backend, devops, test, docs, security, review)
- Three-tier verification (task-level, wave-level, final verification)
- File-based locking with owner identification for conflict-free parallel execution
- Fresh start mechanism for stuck workers
- Loop detection for continuous worker execution
- Multi-terminal coordination via shared state
- Structured evidence collection and validation
- **Automatic swarm worker state tracking** (v2.2): Workers automatically update their state (current_task, tasks_completed, last_heartbeat) when claiming/completing tasks

## File Structure

```
plugins/teamwork/
├── src/
│   ├── lib/
│   │   ├── types.js           # JSDoc type definitions (@typedef)
│   │   ├── file-lock.js       # Cross-platform file locking with owner identification
│   │   ├── optimistic-lock.js # Task claim/release with file lock protection
│   │   ├── project-utils.js   # Project and task path utilities
│   │   ├── args.js            # Common argument parsing
│   │   └── hook-utils.js      # Hook utilities (stdin, output, error handling)
│   ├── scripts/               # CLI scripts (15 files)
│   │   ├── setup-teamwork.js
│   │   ├── project-create.js
│   │   ├── project-get.js
│   │   ├── project-clean.js   # Clean project (delete tasks/verification)
│   │   ├── project-status.js  # Project dashboard
│   │   ├── task-create.js
│   │   ├── task-get.js
│   │   ├── task-list.js
│   │   ├── task-claim.js
│   │   ├── task-update.js
│   │   ├── wave-calculate.js  # v2: Wave calculation from DAG
│   │   ├── wave-update.js     # v2: Wave status management
│   │   ├── wave-status.js     # v2: Wave progress queries
│   │   ├── loop-state.js
│   │   └── worker-setup.js
│   └── hooks/                 # Lifecycle hooks (1 file)
│       └── loop-detector.js
├── agents/                    # Agent definitions
│   ├── orchestrator/          # v2: renamed from coordinator, adds monitoring loop
│   ├── wave-verifier/         # v2: cross-task verification
│   ├── final-verifier/        # v2: project-level verification
│   ├── worker/
│   ├── frontend/
│   ├── backend/
│   ├── devops/
│   ├── test/
│   ├── docs/
│   ├── security/
│   └── review/
├── commands/                  # Command definitions
├── skills/                    # Skill definitions
│   └── worker-workflow/       # Shared task execution workflow (Phase 1-5)
├── hooks/
│   └── hooks.json            # Hook configuration
└── CLAUDE.md                 # This file
```

## Script Inventory

All scripts use Bun runtime with flag-based parameters. All task/project scripts use `--project <name> --team <name>` pattern.

| Script | Purpose | Key Parameters |
|--------|---------|----------------|
| **setup-teamwork.js** | Initialize teamwork environment | `--project <name>` `--team <name>` |
| **project-create.js** | Create new project with metadata | `--project <name>` `--team <name>` `--goal "..."` |
| **project-get.js** | Get project metadata | `--project <name>` `--team <name>` |
| **project-clean.js** | Clean project by deleting task and verification directories | `--project <name>` `--team <name>` |
| **project-status.js** | Get project dashboard status | `--project <name>` `--team <name>` `[--format json\|table]` `[--field <path>]` `[--verbose]` |
| **task-create.js** | Create new task file | `--project <name>` `--team <name>` `--id <id>` `--title "..."` `--description "..."` `--role <role>` `--complexity simple\|standard\|complex` `--blocked-by "1,2"` |
| **task-get.js** | Get single task details | `--project <name>` `--team <name>` `--id <id>` |
| **task-list.js** | List all tasks in project | `--project <name>` `--team <name>` `--available` `--role <role>` `--format json\|table` |
| **task-claim.js** | Atomically claim a task | `--project <name>` `--team <name>` `--id <id>` `--owner <session_id>` `[--role <role>]` `[--strict-role]` |
| **task-update.js** | Update task status/evidence/metadata | `--project <name>` `--team <name>` `--id <id>` `--status open\|in_progress\|resolved` `--add-evidence "..."` `--title "..."` `--description "..."` `--role <role>` `--release` `--worker-id <id>` (sends idle notification on resolve) |
| **task-delete.js** | Delete a task (PLANNING phase only) | `--project <name>` `--team <name>` `--id <id>` `[--force]` |
| **wave-calculate.js** | Calculate wave groups from task DAG | `--project <name>` `--team <name>` |
| **wave-update.js** | Update wave status | `--project <name>` `--team <name>` `--wave <id>` `--status planning\|in_progress\|completed\|verified\|failed` |
| **wave-status.js** | Query wave progress | `--project <name>` `--team <name>` `--format json\|table` |
| **loop-state.js** | Manage worker loop state | `--get` `--start --project <name> --team <name> --role <role>` `--clear` |
| **worker-setup.js** | Setup worker session context | `--project <name>` `--team <name>` `--role <role>` `--worker-id <id>` |
| **swarm-spawn.js** | Spawn workers in tmux panes | `--project <name>` `--team <name>` `--role <role>` or `--roles <role1,role2>` `--count <n>` `--worktree` `--source-dir <path>` |
| **swarm-status.js** | Query swarm status | `--project <name>` `--team <name>` `--format json\|table` |
| **swarm-stop.js** | Stop worker or swarm | `--project <name>` `--team <name>` `--worker <id>` or `--all` |
| **swarm-merge.js** | Merge worktrees on wave completion | `--project <name>` `--team <name>` `--wave <n>` `--source-dir <path>` |
| **swarm-sync.js** | Sync worktree with main | `--project <name>` `--team <name>` `--worker-id <id>` `--source-dir <path>` |
| **worktree-create.js** | Create git worktree for worker | `--project <name>` `--team <name>` `--worker-id <id>` `--source-dir <path>` |
| **worktree-remove.js** | Remove git worktree | `--project <name>` `--team <name>` `--worker-id <id>` `--source-dir <path>` |
| **mailbox-send.js** | Send message to inbox | `--project <name>` `--team <name>` `--from <sender>` `--to <recipient>` `--type text\|idle_notification\|shutdown_request\|shutdown_response` `--payload "..."` |
| **mailbox-read.js** | Read messages from inbox | `--project <name>` `--team <name>` `--inbox <name>` `[--unread-only]` `[--type <type>]` `[--mark-read]` |
| **mailbox-poll.js** | Wait for new messages with timeout | `--project <name>` `--team <name>` `--inbox <name>` `[--timeout <seconds>]` |

## Hook Inventory

All hooks run on `bun` runtime. Hooks are idempotent and non-blocking.

| Hook File | Event | Purpose | Behavior |
|-----------|-------|---------|----------|
| **loop-detector.js** | Stop | Detect continuation marker and trigger next worker iteration | Checks for `__TEAMWORK_CONTINUE__` marker in agent output, continues worker loop if found |

## Skill Inventory

Skills provide reusable capabilities for agents. Each skill documents when to use it and what it does.

| Skill | Purpose | Use Case |
|-------|---------|----------|
| **worker-workflow** | Core task execution workflow (Phase 1-5) for all worker agents | Injected into role-specific agents via `skills` frontmatter field. Provides find task, claim, implement, evidence, and status update phases. |
| **teamwork-clean** | Reset project execution state while preserving metadata | Recovering from failed orchestration, starting fresh with same goal, cleaning up after testing |
| **swarm-workflow** | Swarm orchestration workflow for automatic worker spawning and coordination | Orchestrator uses this for spawn decisions, monitoring loop, merge/sync operations with tmux and git worktrees |

## Agent Inventory

| Agent | Model | Role | Key Responsibilities |
|-------|-------|------|---------------------|
| **orchestrator** | opus | Unified planning, monitoring, and verification orchestration | Codebase exploration, task decomposition, wave monitoring, trigger verifiers, handle conflicts, coordinate verification phases, fresh start detection |
| **wave-verifier** | sonnet | Wave-level verification | Cross-task dependency checking, file conflict detection, wave-scoped build/test execution |
| **final-verifier** | opus | Project-level verification | Full build/test, blocked pattern scanning, evidence completeness, cross-wave dependency validation |
| **coordinator** | opus | DEPRECATED - Planning (v1 compatibility) | **Deprecated in v2**: Use orchestrator instead. Kept for backward compatibility only. |
| **worker** | dynamic* | General purpose task execution | Find available tasks, claim with file lock, implement, collect structured evidence, mark resolved |
| **frontend** | dynamic* | Frontend development specialist | UI components, styling, state management, user interactions, responsive design, accessibility |
| **backend** | dynamic* | Backend development specialist | API endpoints, services, database, business logic, data validation |
| **devops** | dynamic* | DevOps and infrastructure specialist | CI/CD, deployment, infrastructure, containerization, monitoring |
| **test** | dynamic* | Testing specialist | Unit tests, integration tests, fixtures, mocks, test coverage |
| **docs** | dynamic* | Documentation specialist | README, API docs, examples, architectural documentation |
| **security** | dynamic* | Security specialist | Authentication, authorization, input validation, security audits |
| **review** | dynamic* | Code review specialist | Code quality, refactoring, best practices, architecture review |

**\*Dynamic model selection based on task complexity:**

| Complexity | Model | When to Use |
|------------|-------|-------------|
| `simple` | haiku | Single file, <10 lines, config updates, simple docs |
| `standard` | sonnet | 1-3 files, typical CRUD, straightforward implementation |
| `complex` | opus | 5+ files, architecture changes, security-critical work |

Model is determined at worker spawn time by reading `task.complexity` field.

## State Management

### Directory Structure

```
~/.claude/teamwork/
├── {project}/
│   └── {team}/
│       ├── project.json       # Project metadata
│       ├── waves.json         # Wave definitions and progress (v2)
│       ├── tasks/             # Task files (*.json)
│       │   ├── 1.json
│       │   ├── 2.json
│       │   └── 3.json
│       ├── inboxes/           # Mailbox system (v2.3)
│       │   ├── orchestrator.json  # Orchestrator inbox
│       │   ├── w1.json            # Worker 1 inbox
│       │   └── w2.json            # Worker 2 inbox
│       └── verification/      # Verification results (v2)
│           ├── wave-1.json
│           ├── wave-2.json
│           └── final.json
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
  "complexity": "complex",
  "status": "open",
  "blocked_by": [],
  "wave": 1,
  "created_at": "2026-01-12T10:00:00Z",
  "updated_at": "2026-01-12T10:05:00Z",
  "claimed_by": null,
  "claimed_at": null,
  "completed_at": null,
  "evidence": [
    {
      "type": "command",
      "command": "npm test -- auth.test.ts",
      "output": "Tests passed: 5/5",
      "exit_code": 0,
      "timestamp": "2026-01-12T10:10:00Z"
    },
    {
      "type": "file",
      "action": "created",
      "path": "src/middleware/auth.ts",
      "timestamp": "2026-01-12T10:08:00Z"
    }
  ]
}
```

**Task status values**: `open` | `in_progress` | `resolved`

**Role values**: `frontend` | `backend` | `devops` | `test` | `docs` | `security` | `review` | `worker`

**Complexity values**: `simple` | `standard` | `complex` (default: `standard`)

**Evidence types** (v2):
- `command`: Command execution with exit code
- `file`: File operations (created, modified, deleted)
- `test`: Test results with pass/fail counts
- `note`: General observations or notes

### Project State Format

**File**: `~/.claude/teamwork/{project}/{team}/project.json`

```json
{
  "project": "my-app",
  "team": "auth-team",
  "goal": "Implement user authentication system",
  "phase": "EXECUTION",
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

**Phase values** (v2): `PLANNING` | `EXECUTION` | `VERIFICATION` | `COMPLETE`

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

### Wave State Format (v2)

**File**: `~/.claude/teamwork/{project}/{team}/waves.json`

```json
{
  "version": "1.0",
  "total_waves": 3,
  "current_wave": 2,
  "waves": [
    {
      "id": 1,
      "status": "verified",
      "tasks": ["1", "2", "3"],
      "started_at": "2026-01-15T10:00:00Z",
      "verified_at": "2026-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "status": "in_progress",
      "tasks": ["4", "5"],
      "started_at": "2026-01-15T10:30:00Z",
      "verified_at": null
    },
    {
      "id": 3,
      "status": "open",
      "tasks": ["6", "7", "8"],
      "started_at": null,
      "verified_at": null
    }
  ]
}
```

**Wave status values**: `planning` | `in_progress` | `completed` | `verified` | `failed`

### Verification Result Format (v2)

**File**: `~/.claude/teamwork/{project}/{team}/verification/wave-{n}.json`

```json
{
  "wave_id": 1,
  "status": "passed",
  "verified_at": "2026-01-15T10:30:00Z",
  "tasks_verified": ["1", "2", "3"],
  "checks": [
    {
      "name": "all_tasks_resolved",
      "status": "passed"
    },
    {
      "name": "no_file_conflicts",
      "status": "passed"
    },
    {
      "name": "build_succeeds",
      "status": "passed",
      "evidence": "npm run build: exit 0"
    }
  ],
  "issues": []
}
```

**Verification status values**: `passed` | `failed`

### Mailbox State Format (v2.3)

**File**: `~/.claude/teamwork/{project}/{team}/inboxes/{name}.json`

```json
{
  "messages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "from": "w1",
      "to": "orchestrator",
      "type": "idle_notification",
      "payload": {
        "worker_id": "w1",
        "completed_task_id": "3",
        "completed_status": "resolved"
      },
      "timestamp": "2026-01-27T10:30:00Z",
      "read": false
    }
  ]
}
```

**Message types**: `text` | `idle_notification` | `shutdown_request` | `shutdown_response`

**Payload schemas by type**:

| Type | Payload Fields |
|------|----------------|
| `text` | `{ message: string }` |
| `idle_notification` | `{ worker_id, completed_task_id?, completed_status?, failure_reason? }` |
| `shutdown_request` | `{ request_id, reason? }` |
| `shutdown_response` | `{ request_id, approved, decline_reason? }` |

**Usage**: Workers automatically send `idle_notification` when completing tasks via `task-update.js --status resolved --worker-id <id>`.

## Architecture (v2)

```
┌──────────────────────────────────────────────┐
│      Orchestrator (Unified, Opus Model)      │
│   Planning → Monitoring → Verification       │
│   - Codebase exploration & task breakdown    │
│   - Wave completion monitoring               │
│   - Fresh start detection                    │
│   - Verification orchestration               │
└───────────────────┬──────────────────────────┘
                    │
    ┌───────────────┴────────────────┐
    ▼                                ▼
┌────────────────────┐    ┌────────────────────┐
│   Workers (8 types) │    │  Verification      │
│   - frontend        │    │  - wave-verifier   │
│   - backend         │    │  - final-verifier  │
│   - test, devops    │    └────────────────────┘
│   - docs, security  │
│   - review, worker  │
└────────────────────┘

         All coordinate via:
    ┌──────────────────────────┐
    │  Shared Task Files       │
    │  (Optimistic Concurrency)│
    └──────────────────────────┘
```

## Wave Workflow (v2)

### Phase 1: PLANNING

1. **Input**: Plan documents or goal
2. **Process** (Orchestrator):
   - Parse plan or decompose goal into tasks
   - Create task files with `blocked_by` dependencies
   - Calculate waves using DAG (Kahn's algorithm)
   - Write `waves.json`
3. **Output**: Tasks with wave assignments, phase → EXECUTION

### Phase 2: EXECUTION

1. **Workers**: Run autonomous loops, claim and execute tasks with file lock
2. **Orchestrator**: Monitors wave completion, detects stuck workers
3. **Wave Complete**: All tasks in wave resolved → trigger verification

### Phase 3: VERIFICATION

1. **Wave Verification**: Cross-task checks, build/test execution
2. **Results**:
   - PASS → Proceed to next wave
   - FAIL → Create fix tasks, append to current wave
3. **Final Wave**: After last wave verified → final verification

### Phase 4: COMPLETE

1. **Final Verification**: Full project build/test, evidence completeness
2. **Results**:
   - PASS → Phase → COMPLETE
   - FAIL → Create fix tasks, new wave

## Worker Polling Mode

Workers can start before the orchestrator creates the project, continuously polling for work.

**Polling is automatically enabled when `--loop` flag is used.**

### How It Works

1. **Worker starts**: Command invokes `worker-setup.js`
2. **Setup fails**: No project found or no open tasks
3. **Polling (if `--loop`)**: Command waits and retries instead of exiting
   - Outputs timestamped status message
   - Waits `--poll-interval` seconds (default: 30)
   - Retries worker setup
4. **Setup succeeds**: Project and tasks found, spawn worker agent
5. **Loop**: After task completion, return to step 1

### Usage Examples

```bash
# Start worker with auto-detected project/team (polling enabled via --loop)
/teamwork-worker --loop
# Output: [15:50:30] Waiting for project item-search/master...

# Explicit project/team specification
/teamwork-worker --project my-app --team master --role backend --loop

# Multi-terminal workflow
Terminal 1: /teamwork-worker --loop
            → [15:50:30] Waiting for project item-search/master...

Terminal 2: /teamwork-worker --role frontend --loop
            → [15:50:35] Waiting for project item-search/master...

Terminal 3: /teamwork "Build API"
            → Creates project
            → Workers in Terminal 1 & 2 detect project and start working
```

### Configuration

```bash
# Default: 30 second wait between polls
/teamwork-worker --loop

# Custom poll interval (60 seconds)
/teamwork-worker --loop --poll-interval 60
```

### Termination

Workers in polling mode run indefinitely until manually stopped:

- **User action required**: Press Ctrl+C to stop worker
- **No auto-exit**: Workers continue polling even when all tasks complete

### Status Output

Workers display timestamped status messages during polling:

```
[23:30:01] Waiting for project item-search/master...
[23:30:31] Waiting for project item-search/master...
[23:31:01] Project found: item-search/master
[23:31:01] Found 5 open tasks. Starting worker...
```

When no tasks available:
```
[23:35:45] No available tasks (role: backend). Waiting 30s...
[23:36:15] No available tasks (role: backend). Waiting 30s...
[23:36:45] Found task 3: "Implement items.schema.ts"
```

## Swarm (Automatic Worker Spawning)

Teamwork supports automatic worker spawning via tmux with optional git worktree isolation.

### Overview

Swarm enables the orchestrator to automatically spawn workers in tmux panes, eliminating the need for manual terminal management. Each worker can optionally work in an isolated git worktree to prevent merge conflicts.

**Key features:**
- Automatic worker spawning in tmux panes
- Role-based or generic worker allocation
- Optional git worktree isolation per worker
- Wave-based merge strategy
- Worker health monitoring and auto-restart

### Quick Start

```bash
# Start project with automatic worker spawning (default: role-based)
/teamwork "build REST API" --workers auto

# Specify number of generic workers
/teamwork "build REST API" --workers 5

# Specify workers by role
/teamwork "build REST API" --workers backend:2,frontend:1,test:1

# Enable worktree isolation
/teamwork "build REST API" --workers auto --worktree

# Manual mode (traditional)
/teamwork "build REST API" --workers 0
```

### Swarm Options

| Option | Default | Description |
|--------|---------|-------------|
| `--workers auto` | (default) | Spawn workers based on unique task roles |
| `--workers N` | - | Spawn N generic workers |
| `--workers role:N,...` | - | Spawn specific workers by role |
| `--workers 0` | - | Disable automatic spawning (manual mode) |
| `--worktree` | false | Enable git worktree isolation per worker |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    /teamwork "goal"                          │
│                           │                                  │
│              ┌────────────▼────────────┐                     │
│              │      Orchestrator       │                     │
│              │  - Task creation        │                     │
│              │  - Wave calculation     │                     │
│              │  - Spawn decision       │                     │
│              └────────────┬────────────┘                     │
│                           │                                  │
│              ┌────────────▼────────────┐                     │
│              │   swarm-spawn.js        │                     │
│              │  - tmux session         │                     │
│              │  - pane splitting       │                     │
│              │  - worker startup       │                     │
│              └────────────┬────────────┘                     │
│                           │                                  │
│    ┌──────────────────────┼──────────────────────┐          │
│    ▼                      ▼                      ▼          │
│ ┌──────┐              ┌──────┐              ┌──────┐        │
│ │Worker│              │Worker│              │Worker│        │
│ │ (BE) │              │ (FE) │              │(Test)│        │
│ └──┬───┘              └──┬───┘              └──┬───┘        │
│    │                     │                     │             │
│    ▼                     ▼                     ▼             │
│ worktree/w1          worktree/w2          worktree/w3       │
│ (when --worktree enabled)                                   │
└─────────────────────────────────────────────────────────────┘
```

### Swarm Commands

**Spawn Workers:**
```bash
# Spawn backend worker
bun "$SCRIPTS_PATH/swarm-spawn.js" \
  --project my-app \
  --team master \
  --role backend \
  --count 1

# Spawn multiple roles
bun "$SCRIPTS_PATH/swarm-spawn.js" \
  --project my-app \
  --team master \
  --roles backend,frontend,test \
  --count 1 \
  --worktree \
  --source-dir /path/to/project
```

**Check Swarm Status:**
```bash
bun "$SCRIPTS_PATH/swarm-status.js" \
  --project my-app \
  --team master \
  --format json
```

**Stop Workers:**
```bash
# Stop specific worker
bun "$SCRIPTS_PATH/swarm-stop.js" \
  --project my-app \
  --team master \
  --worker w1

# Stop all workers
bun "$SCRIPTS_PATH/swarm-stop.js" \
  --project my-app \
  --team master \
  --all
```

**Merge Worktrees (Wave Completion):**
```bash
bun "$SCRIPTS_PATH/swarm-merge.js" \
  --project my-app \
  --team master \
  --wave 1 \
  --source-dir /path/to/project
```

**Sync Worktree with Main:**
```bash
bun "$SCRIPTS_PATH/swarm-sync.js" \
  --project my-app \
  --team master \
  --worker-id w1 \
  --source-dir /path/to/project
```

### Worktree Management

**Create Worktree:**
```bash
bun "$SCRIPTS_PATH/worktree-create.js" \
  --project my-app \
  --team master \
  --worker-id w1 \
  --source-dir /path/to/project
```

**Remove Worktree:**
```bash
bun "$SCRIPTS_PATH/worktree-remove.js" \
  --project my-app \
  --team master \
  --worker-id w1 \
  --source-dir /path/to/project
```

### tmux Layout

Workers are spawned in a single tmux session with split panes:

```
┌─────────────────────────────────────────────────────┐
│ teamwork-{project}                                   │
├─────────────────────┬───────────────────────────────┤
│ [0] backend-w1      │ [1] frontend-w2               │
│ Task #3 in progress │ Task #5 in progress           │
├─────────────────────┼───────────────────────────────┤
│ [2] test-w3         │ [3] (available)               │
│ Waiting for task... │                               │
└─────────────────────┴───────────────────────────────┘
```

### Worktree Isolation

When `--worktree` is enabled:

1. **Creation**: Each worker gets a dedicated git worktree on branch `worker-{id}`
2. **Execution**: Workers commit changes to their isolated worktree
3. **Wave Completion**: Orchestrator merges all worktrees to main sequentially
4. **Conflict Handling**: Merge conflicts trigger fix tasks
5. **Cleanup**: Worktrees removed when worker stops

### State Management

Swarm state is stored under the project directory:

```
~/.claude/teamwork/{project}/{team}/
├── project.json
├── tasks/
├── waves.json
├── swarm/                  # Swarm state
│   ├── swarm.json          # Overall swarm status
│   └── workers/
│       ├── w1.json         # Worker 1 state
│       └── w2.json         # Worker 2 state
└── worktrees/              # Worktree directories
    ├── w1/                 # git worktree (branch: worker-w1)
    └── w2/
```

**swarm.json format:**
```json
{
  "session": "teamwork-my-app",
  "status": "running",
  "created_at": "2026-01-26T10:00:00Z",
  "workers": ["w1", "w2", "w3"],
  "current_wave": 1,
  "paused": false,
  "use_worktree": true,
  "source_dir": "/Users/me/my-app"
}
```

**workers/{id}.json format:**
```json
{
  "id": "w1",
  "role": "backend",
  "pane": 1,
  "worktree": "~/.claude/teamwork/my-app/master/worktrees/w1",
  "branch": "worker-w1",
  "session_id": "abc-123-xyz",
  "status": "working",
  "current_task": "3",
  "tasks_completed": ["1"],
  "last_heartbeat": "2026-01-26T10:05:00Z"
}
```

**Worker state fields (v2.2):**
| Field | Description | Updated By |
|-------|-------------|------------|
| `id` | Worker ID (w1, w2, etc.) | swarm-spawn.js |
| `role` | Worker role (backend, frontend, etc.) | swarm-spawn.js |
| `pane` | tmux pane index | swarm-spawn.js |
| `worktree` | Git worktree path (if enabled) | swarm-spawn.js |
| `branch` | Git branch name (if worktree enabled) | swarm-spawn.js |
| `session_id` | CLAUDE_SESSION_ID of the worker | worker-setup.js (via --worker-id) |
| `status` | Worker status (idle, working) | task-claim.js, task-update.js |
| `current_task` | Currently claimed task ID | task-claim.js, task-update.js |
| `tasks_completed` | Array of completed task IDs | task-update.js |
| `last_heartbeat` | Last activity timestamp | task-claim.js, task-update.js |

### Error Handling

| Scenario | Detection | Response |
|----------|-----------|----------|
| Worker crash | pane_dead=1, no heartbeat | Auto-restart worker |
| Task stuck | fresh-start-interval exceeded | Release task, restart worker |
| tmux session lost | session check fails | Recreate entire swarm |
| Merge conflict | swarm-merge.js error | Create fix task, pause wave |

### Requirements

- **tmux**: Must be installed and in PATH
- **Git repository**: Required for worktree feature
- **Same machine**: Orchestrator and workers must run on same host

## Fresh Start Mechanism (v2)

The fresh start mechanism prevents workers from getting stuck on difficult tasks:

### How It Works

1. **Orchestrator monitors** task claim timestamps via `--fresh-start-interval N` (default: 3600 seconds / 1 hour)
2. **Detection**: If task `claimed_at` is older than interval and status is still `in_progress`
3. **Action**: Orchestrator releases the task (clears `claimed_by`, resets `claimed_at`)
4. **Notification**: Logs fresh start event in orchestrator output
5. **Worker impact**: Worker can detect task was released, should abandon work

### Configuration

```bash
# Default: 1 hour fresh start interval
/teamwork-worker --role backend --loop

# Custom interval (30 minutes)
/teamwork-worker --role backend --loop --fresh-start-interval 1800

# Disable fresh start
/teamwork-worker --role backend --loop --fresh-start-interval 0
```

### Use Cases

- Worker hangs or crashes mid-task
- Task is more difficult than expected
- Worker session is terminated
- Network issues prevent completion

### Worker Best Practices

1. Check task ownership before committing work
2. Handle graceful interruption when task is released
3. Use `--release` flag when abandoning difficult tasks manually

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

### Agent Script Path Pattern

**IMPORTANT**: When agents need to call scripts, they receive `SCRIPTS_PATH` via their prompt.

#### Why?

Claude Code expands `${CLAUDE_PLUGIN_ROOT}` in command/hook files at load time, but NOT in agent markdown content. Agents cannot rely on `${CLAUDE_PLUGIN_ROOT}` being available as a shell environment variable.

#### Pattern

1. **Commands** pass `SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts` to agents in the prompt
2. **Agents** use `$SCRIPTS_PATH` in bash commands:
   ```bash
   bun "$SCRIPTS_PATH/task-list.js" --project {PROJECT} --team {SUB_TEAM}
   ```

#### DO NOT

```bash
# WRONG - this will fail in agents
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"
bun "$SCRIPTS/task-list.js" ...
```

#### DO

```bash
# CORRECT - use SCRIPTS_PATH from prompt
bun "$SCRIPTS_PATH/task-list.js" ...
```

### Document Synchronization

**When modifying teamwork commands or agents, you MUST check and update the following files:**

| File | Location | Role |
|------|----------|------|
| `teamwork.md` | `commands/teamwork.md` | Coordination command (planning phase) |
| `teamwork-worker.md` | `commands/teamwork-worker.md` | Worker command (execution phase) |
| `teamwork-status.md` | `commands/teamwork-status.md` | Status dashboard command |
| `teamwork-verify.md` | `commands/teamwork-verify.md` | Manual verification command (v2) |
| `teamwork-clean.md` | `commands/teamwork-clean.md` | Project cleanup command |
| `orchestrator/AGENT.md` | `agents/orchestrator/AGENT.md` | Main orchestration agent (v2) |
| `coordinator/AGENT.md` | `agents/coordinator/AGENT.md` | DEPRECATED - Use orchestrator instead |
| `worker/AGENT.md` | `agents/worker/AGENT.md` | General purpose worker agent |
| Role agents | `agents/{role}/AGENT.md` | Specialized worker agents (frontend, backend, etc.) |

### Role Enforcement (v2.1)

**Purpose**: Prevent workers from claiming tasks outside their designated role.

**Script options**:
```bash
# Strict mode: reject claim if role mismatch
bun task-claim.js --project X --team Y --id 1 --role backend --strict-role
# Error: Task 1 role mismatch - task role: frontend, worker role: backend

# Warning mode (default): warn but allow claim
bun task-claim.js --project X --team Y --id 1 --role backend
# Warning: Role mismatch - task role: frontend, worker role: backend
```

**Role enforcement behavior**:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `--role <role>` only | Warn on mismatch, allow claim | Flexible teams, cross-training |
| `--role <role> --strict-role` | Reject claim on mismatch | Large projects, strict separation |
| No `--role` flag | No enforcement | Backward compatibility |

**Agent-level enforcement**:

Worker agents have "Role Adherence Rules" in their prompt:
1. **Role Lock Mechanism**: After first claim, lock to that role for session
2. **No cross-role claims**: Cannot claim frontend after backend (or vice versa)
3. **Graceful exit**: Report "No tasks for role X" instead of switching roles

**Why this matters**:
- Prevents single worker from monopolizing tasks across all roles
- Ensures role-specialized agents handle appropriate tasks
- Enables parallel execution with clear boundaries

### Concurrency Safety (v2)

**File Lock with Owner Identification:**
- Workers use mkdir-based atomic file locks for task claims
- Lock holder info stored in `holder.json` (owner, pid, timestamp)
- Reentrant locks: same owner can re-acquire without waiting
- Stale lock detection: auto-cleanup if holder process is dead (>1 min)
- Version tracking maintained for audit trail

**Lock Flow:**
```
Session A: acquireLock(task.json, "session-a")
           → mkdir task.json.lock/
           → write holder.json {owner: "session-a", pid: 12345, ...}
           → [CRITICAL SECTION: read→check→write]
           → releaseLock(task.json, "session-a")

Session B: acquireLock(task.json, "session-b")
           → EEXIST → read holder.json → owner != "session-b"
           → wait and retry until Session A releases
```

**Benefits:**
- No race conditions (atomic mkdir + holder identification)
- Reentrant: same session can claim multiple tasks
- Stale lock recovery: auto-cleanup crashed sessions
- Cross-platform: works on Windows, macOS, Linux

### Worker Coordination

- Each worker runs in separate terminal/session
- Workers claim tasks based on role matching
- Workers coordinate through file locks with session ID identification
- Orchestrator monitors progress through task status

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

## Backward Compatibility (v2)

Teamwork v2 maintains full backward compatibility with v1:

| Feature | v1 Behavior | v2 Behavior | Compatibility |
|---------|-------------|-------------|---------------|
| **waves.json** | Not used | Optional wave-based execution | If missing, falls back to v1 single-phase execution |
| **Evidence format** | Simple strings | Structured objects | Accepts both formats, prefers structured |
| **Commands** | `/teamwork`, `/teamwork-worker`, `/teamwork-status` | Same commands + new options | All v1 commands work unchanged |
| **Task format** | No `wave` field | Optional `wave` field | Field ignored if waves.json missing |
| **Verification** | Manual | Automatic wave + final verification | Auto-enabled if waves.json exists |

**Migration path**:
1. Existing projects without `waves.json` continue working as-is
2. New projects can opt into waves via `--plans` flag
3. Mixed mode: Add `waves.json` to existing project to enable verification

## Usage Examples

### Create Project

```bash
bun src/scripts/project-create.js \
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
  --project my-app \
  --team auth-team \
  --available \
  --format json

# Filter by role
bun src/scripts/task-list.js \
  --project my-app \
  --team auth-team \
  --available \
  --role backend
```

### Claim Task

```bash
bun src/scripts/task-claim.js \
  --project my-app \
  --team auth-team \
  --id "1" \
  --owner session-abc-123
```

### Update Task

```bash
# Add evidence
bun src/scripts/task-update.js \
  --project my-app \
  --team auth-team \
  --id "1" \
  --add-evidence "Created src/middleware/auth.ts"

# Update metadata (title, description, role)
bun src/scripts/task-update.js \
  --project my-app \
  --team auth-team \
  --id "1" \
  --title "New task title" \
  --description "Updated description" \
  --role frontend

# Mark resolved
bun src/scripts/task-update.js \
  --project my-app \
  --team auth-team \
  --id "1" \
  --status resolved \
  --add-evidence "npm test: 5/5 passed, exit 0"

# Release task (on failure)
bun src/scripts/task-update.js \
  --project my-app \
  --team auth-team \
  --id "1" \
  --release
```

### Manage Loop State

```bash
# Get loop state
bun src/scripts/loop-state.js --get

# Start loop (register loop state)
bun src/scripts/loop-state.js --start \
  --project my-app \
  --team auth-team \
  --role backend

# Clear loop state
bun src/scripts/loop-state.js --clear
```

### Project Status Dashboard

```bash
# Get status dashboard (table format)
bun src/scripts/project-status.js \
  --project my-app \
  --team auth-team \
  --format table

# Get status in JSON format
bun src/scripts/project-status.js \
  --project my-app \
  --team auth-team \
  --format json

# Get specific field using dot notation
bun src/scripts/project-status.js \
  --project my-app \
  --team auth-team \
  --field stats.progress

# Get verbose output with task details
bun src/scripts/project-status.js \
  --project my-app \
  --team auth-team \
  --verbose
```

### Clean Project

```bash
# Clean project to start fresh
bun src/scripts/project-clean.js \
  --project my-app \
  --team auth-team
```

## Testing

The teamwork plugin includes a comprehensive test suite to ensure script reliability and prevent regressions.

### Running Tests

```bash
# Run all plugin tests
bun test tests/teamwork/

# Run specific test file
bun test tests/teamwork/project-create.test.js

# Run with coverage
bun test tests/teamwork/ --coverage
```

### Test Structure

Tests are organized to mirror the plugin structure:

- `tests/teamwork/*.test.js` - Script tests (one file per script)
- `tests/teamwork/lib/*.test.js` - Library module tests (file-lock, optimistic-lock, etc.)
- `tests/test-utils.js` - Shared test utilities (`mockProject()`, `runScript()`, etc.)

**Key test utilities:**
- `mockProject()` - Creates isolated test project structure
- `runScript(scriptPath, params, options)` - Executes scripts with proper environment
- Always pass `HOME` env var to `runScript()` for correct project location

### Writing New Tests

When adding or modifying scripts, create or update the corresponding `.test.js` file:

**Required test coverage:**
1. **Help flag**: Verify `--help` displays usage information
2. **Success case**: Test normal execution with valid inputs
3. **Required parameters**: Verify error when required params missing
4. **Edge cases**: Empty values, invalid inputs, boundary conditions

**Test pattern example:**

```javascript
import { test, expect } from "bun:test";
import { runScript, mockProject } from "../test-utils.js";

test("script-name --help shows usage", async () => {
  const result = await runScript("./src/scripts/script-name.js", { help: true });
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Usage:");
});

test("script-name succeeds with valid params", async () => {
  const { projectDir, projectName, teamName } = await mockProject();

  const result = await runScript("./src/scripts/script-name.js", {
    project: projectName,
    team: teamName,
    param: "value"
  }, {
    env: { HOME: projectDir }
  });

  expect(result.exitCode).toBe(0);
  // Verify output or side effects
});

test("script-name fails without required param", async () => {
  const result = await runScript("./src/scripts/script-name.js", {
    project: "test"
  });

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("--param required");
});
```

**Best practices:**
- Use `mockProject()` for isolated test environments
- Clean up test artifacts after test completion
- Run tests before committing changes

### Test Isolation (CRITICAL)

**Tests MUST be isolated from real user data.** The `~/.claude/teamwork/` directory contains real user projects that must never be affected by tests.

#### How It Works

1. **Environment Variable**: `TEAMWORK_TEST_BASE_DIR` overrides the base directory
2. **Preload Script**: `tests/teamwork/preload.js` sets this before any test runs
3. **Safety Validation**: `validateSafeDelete()` blocks deletion of real paths

#### Test File Pattern

```javascript
// Use test utilities that automatically handle isolation
const { runScript, mockProject, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');

// mockProject() creates in isolated test directory
const project = mockProject({ project: 'test-proj', team: 'test-team' });

// runScript() automatically passes TEAMWORK_TEST_BASE_DIR
const result = runScript(SCRIPT_PATH, { project: 'test-proj', team: 'test-team' });

// Clean up in afterAll
afterAll(() => {
  project.cleanup();
});
```

#### Safety Mechanisms

| Mechanism | Purpose |
|-----------|---------|
| `TEAMWORK_TEST_BASE_DIR` | Redirects all paths to tmpdir |
| `validateSafeDelete()` | Throws error if deleting outside test dir |
| `bunfig.toml` preload | Auto-sets env for all tests |
| `test-isolation.test.js` | Verifies isolation is working |

#### If Tests Delete Real Data

1. Check if `TEAMWORK_TEST_BASE_DIR` is set before import
2. Run `bun test tests/teamwork/test-isolation.test.js` to verify setup
3. Check `bunfig.toml` has preload configured

### Updating Tests on Plugin Changes

When modifying the plugin, update tests to reflect changes:

| Change Type | Test Action |
|-------------|-------------|
| New parameter | Add test for parameter handling and validation |
| New output field | Update schema validation and output assertions |
| Bug fix | Add regression test to prevent reoccurrence |
| New script | Create new `.test.js` file with full coverage |
| Changed behavior | Update existing tests to match new behavior |
| Removed feature | Delete or skip obsolete tests |

**Pre-commit checklist:**
- [ ] All tests pass: `bun test tests/teamwork/`
- [ ] New code has corresponding tests
- [ ] Existing tests updated for behavior changes
- [ ] No skipped/disabled tests without documentation
