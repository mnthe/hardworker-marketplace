# teamwork

Multi-session collaboration plugin with role-based workers.

## Plugin Description

Teamwork enables multi-session collaboration where:
1. **COORDINATION**: Orchestrator agent explores codebase and decomposes work into tasks
2. **EXECUTION**: Multiple workers claim and complete tasks in parallel sessions
3. **VERIFICATION**: Wave-based verification ensures correctness at task, wave, and project levels
4. **SYNCHRONIZATION**: Workers coordinate through shared task files with atomic locking

Key features:
- Project-based task management with wave-based execution
- Role-based worker specialization (frontend, backend, devops, test, docs, security, review)
- Three-tier verification (task-level, wave-level, final verification)
- Atomic task claiming with file-based locking
- Loop detection for continuous worker execution
- Multi-terminal coordination via shared state
- Structured evidence collection and validation

## File Structure

```
plugins/teamwork/
├── src/
│   ├── lib/
│   │   ├── types.js           # JSDoc type definitions (@typedef)
│   │   ├── file-lock.js       # Cross-platform file locking
│   │   ├── project-utils.js   # Project and task path utilities
│   │   └── args.js            # Common argument parsing
│   ├── scripts/               # CLI scripts (13 files)
│   │   ├── setup-teamwork.js
│   │   ├── project-create.js
│   │   ├── project-get.js
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
| **wave-calculate.js** | Calculate wave groups from task DAG | `--dir <path>` `--output waves.json` |
| **wave-update.js** | Update wave status | `--dir <path>` `--wave <id>` `--status pending\|in_progress\|verifying\|verified\|failed` |
| **wave-status.js** | Query wave progress | `--dir <path>` `--wave <id>` `--format json\|table` |
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
| **orchestrator** | opus | Project monitoring and verification orchestration | Monitor wave completion, trigger verifiers, handle conflicts, coordinate verification phases |
| **wave-verifier** | sonnet | Wave-level verification | Cross-task dependency checking, file conflict detection, wave-scoped build/test execution |
| **final-verifier** | opus | Project-level verification | Full build/test, blocked pattern scanning, evidence completeness, cross-wave dependency validation |
| **worker** | inherit | General purpose task execution | Find available tasks, claim atomically, implement, collect structured evidence, mark resolved |
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

**Wave status values**: `pending` | `in_progress` | `verifying` | `verified` | `failed`

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

## Wave Workflow (v2)

### Phase 1: PLANNING

1. **Input**: Plan documents or goal
2. **Process**:
   - Parse plan or decompose goal into tasks
   - Create task files with `blocked_by` dependencies
   - Calculate waves using DAG (Kahn's algorithm)
   - Write `waves.json`
3. **Output**: Tasks with wave assignments, phase → EXECUTION

### Phase 2: EXECUTION

1. **Workers**: Run autonomous loops, claim and execute tasks
2. **Orchestrator**: Monitors wave completion
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
