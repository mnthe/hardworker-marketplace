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
| **task-create.js** | Create new task file | `--project <name>` `--team <name>` `--id <id>` `--title "..."` `--description "..."` `--role <role>` `--blocked-by "1,2"` |
| **task-get.js** | Get single task details | `--project <name>` `--team <name>` `--id <id>` |
| **task-list.js** | List all tasks in project | `--project <name>` `--team <name>` `--available` `--role <role>` `--format json\|table` |
| **task-claim.js** | Atomically claim a task | `--project <name>` `--team <name>` `--id <id>` `--owner <session_id>` |
| **task-update.js** | Update task status/evidence/metadata | `--project <name>` `--team <name>` `--id <id>` `--status open\|in_progress\|resolved` `--add-evidence "..."` `--title "..."` `--description "..."` `--role <role>` `--release` |
| **wave-calculate.js** | Calculate wave groups from task DAG | `--project <name>` `--team <name>` |
| **wave-update.js** | Update wave status | `--project <name>` `--team <name>` `--wave <id>` `--status planning\|in_progress\|completed\|verified\|failed` |
| **wave-status.js** | Query wave progress | `--project <name>` `--team <name>` `--format json\|table` |
| **loop-state.js** | Manage worker loop state | `--get` `--set --project <name> --team <name> --role <role>` `--clear` |
| **worker-setup.js** | Setup worker session context | `--project <name>` `--team <name>` `--role <role>` |

## Hook Inventory

All hooks run on `bun` runtime. Hooks are idempotent and non-blocking.

| Hook File | Event | Purpose | Behavior |
|-----------|-------|---------|----------|
| **loop-detector.js** | Stop | Detect continuation marker and trigger next worker iteration | Checks for `__TEAMWORK_CONTINUE__` marker in agent output, continues worker loop if found |

## Skill Inventory

Skills provide reusable capabilities for agents. Each skill documents when to use it and what it does.

| Skill | Purpose | Use Case |
|-------|---------|----------|
| **teamwork-clean** | Reset project execution state while preserving metadata | Recovering from failed orchestration, starting fresh with same goal, cleaning up after testing |

## Agent Inventory

| Agent | Model | Role | Key Responsibilities |
|-------|-------|------|---------------------|
| **orchestrator** | opus | Unified planning, monitoring, and verification orchestration | Codebase exploration, task decomposition, wave monitoring, trigger verifiers, handle conflicts, coordinate verification phases, fresh start detection |
| **wave-verifier** | sonnet | Wave-level verification | Cross-task dependency checking, file conflict detection, wave-scoped build/test execution |
| **final-verifier** | opus | Project-level verification | Full build/test, blocked pattern scanning, evidence completeness, cross-wave dependency validation |
| **coordinator** | opus | DEPRECATED - Planning (v1 compatibility) | **Deprecated in v2**: Use orchestrator instead. Kept for backward compatibility only. |
| **worker** | inherit | General purpose task execution | Find available tasks, claim with file lock, implement, collect structured evidence, mark resolved |
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
│       ├── waves.json         # Wave definitions and progress (v2)
│       ├── tasks/             # Task files (*.json)
│       │   ├── 1.json
│       │   ├── 2.json
│       │   └── 3.json
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
      "status": "pending",
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

### How It Works

1. **Worker starts**: Worker agent starts with `--loop` flag
2. **Project polling**: Checks if project.json exists
   - If missing: Wait N seconds, retry
   - If found: Proceed to task polling
3. **Task polling**: Checks for available tasks matching role
   - If none available: Wait N seconds, retry
   - If found: Claim and execute task
4. **Loop**: After task completion, return to task polling (step 3)

### Required Parameters

`--project` and `--team` are **REQUIRED** for polling mode to specify which project to watch:

```bash
# Correct: Specify target project
/teamwork-worker --project my-app --team master --role backend --loop

# Wrong: Missing project/team
/teamwork-worker --role backend --loop  # ❌ Error: --project required
```

### Usage Examples

```bash
# Start worker before orchestrator creates project
Terminal 1: /teamwork-worker --project my-app --team master --role backend --loop
            → Polling: Waiting for project...

Terminal 2: /teamwork-worker --project my-app --team master --role frontend --loop
            → Polling: Waiting for project...

Terminal 3: /teamwork "Build API"
            → Creates project my-app/master
            → Workers in Terminal 1 & 2 detect project and start working
```

### Configuration

```bash
# Default: 30 second wait between polls
/teamwork-worker --project my-app --team master --role backend --loop

# Custom wait interval (60 seconds)
/teamwork-worker --project my-app --team master --role backend --loop --wait 60
```

### Termination

Workers in polling mode run indefinitely until manually stopped:

- **User action required**: Press Ctrl+C to stop worker
- **No auto-exit**: Workers never exit automatically, even when all tasks complete

### Status Output

Workers display timestamped status messages during polling:

```
[23:30:01] Waiting for project...
[23:30:31] Waiting for project...
[23:31:01] Project found: my-app/master
[23:31:01] No available tasks (role: backend). Waiting 30s...
[23:31:31] Found task 3: "Implement items.schema.ts"
[23:31:31] Claiming task 3...
[23:31:32] Working on task 3...
```

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
| `orchestrator/AGENT.md` | `agents/orchestrator/AGENT.md` | Main orchestration agent (v2) |
| `coordinator/AGENT.md` | `agents/coordinator/AGENT.md` | DEPRECATED - Use orchestrator instead |
| `worker/AGENT.md` | `agents/worker/AGENT.md` | General purpose worker agent |
| Role agents | `agents/{role}/AGENT.md` | Specialized worker agents (frontend, backend, etc.) |

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

# Set loop state
bun src/scripts/loop-state.js --set \
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
