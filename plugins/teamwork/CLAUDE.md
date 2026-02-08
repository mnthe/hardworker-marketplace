# teamwork

Native teammate-based collaboration plugin using Claude Code agent teams.

## Plugin Description

Teamwork v3 enables multi-agent collaboration using Claude Code's native teammate API:
1. **PLANNING**: Orchestrator explores codebase and decomposes goal into tasks via native `TaskCreate`
2. **EXECUTION**: Workers are spawned as native teammates, receive tasks via `TaskUpdate(owner)`, coordinate through `SendMessage`
3. **VERIFICATION**: Final verifier agent validates project completion
4. **COORDINATION**: Event-driven via `TaskCompleted` and `TeammateIdle` hooks

Key features:
- Native Claude Code agent teams (no tmux/shell spawning)
- Role-based worker specialization (frontend, backend, devops, test, docs, security, review)
- Event-driven coordination via hooks (`TaskCompleted`, `TeammateIdle`)
- Project-based state management with shared task files
- Structured evidence collection and validation
- 6 scripts for project lifecycle and verification (setup, create, get, status, clean, codex-verify)

## File Structure

```
plugins/teamwork/
├── src/
│   ├── lib/
│   │   ├── types.js           # JSDoc type definitions (@typedef)
│   │   ├── project-utils.js   # Project and task path utilities
│   │   ├── args.js            # Common argument parsing
│   │   ├── blocked-patterns.js # Blocked pattern detection
│   │   ├── field-utils.js     # Nested field extraction with dot notation + array indexing
│   │   ├── json-ops.js        # Atomic JSON read/write operations
│   │   └── hook-utils.js      # Hook utilities (parseHookInput, passesGuards)
│   ├── scripts/               # CLI scripts (6 files)
│   │   ├── setup-teamwork.js  # Initialize teamwork environment
│   │   ├── project-create.js  # Create new project with metadata
│   │   ├── project-get.js     # Get project metadata
│   │   ├── project-clean.js   # Clean project state
│   │   └── project-status.js  # Project dashboard
│   └── hooks/                 # Lifecycle hooks (3 files)
│       ├── project-progress.js      # TaskCompleted hook
│       ├── teammate-idle.js         # TeammateIdle hook
│       └── orchestrator-completed.js # SubagentStop hook for orchestrator
├── agents/                    # Agent definitions
│   ├── orchestrator/          # Planning and coordination (delegate mode)
│   ├── final-verifier/        # Project-level verification
│   ├── worker/                # General purpose worker
│   ├── frontend/              # Frontend specialist
│   ├── backend/               # Backend specialist
│   ├── devops/                # DevOps specialist
│   ├── test/                  # Testing specialist
│   ├── docs/                  # Documentation specialist
│   ├── security/              # Security specialist
│   └── review/                # Code review specialist
├── commands/                  # Command definitions
│   ├── teamwork.md            # Main coordination command
│   ├── teamwork-worker.md     # Worker command
│   ├── teamwork-status.md     # Status dashboard
│   ├── teamwork-verify.md     # Manual verification
│   └── teamwork-clean.md      # Project cleanup
├── skills/                    # Skill definitions
│   ├── event-coordination/    # Event-driven coordination patterns
│   ├── task-decomposition/    # Goal decomposition patterns
│   ├── teamwork-clean/        # Project reset procedures
│   └── worker-workflow/       # Task execution workflow
├── hooks/
│   └── hooks.json             # Hook configuration (TaskCompleted, TeammateIdle, SubagentStop)
└── CLAUDE.md                  # This file
```

## Script Inventory

All scripts use Bun runtime with flag-based parameters. Project scripts use `--project <name> --team <name>` pattern.

| Script | Purpose | Key Parameters |
|--------|---------|----------------|
| **setup-teamwork.js** | Initialize teamwork environment | `--project <name>` `--team <name>` |
| **project-create.js** | Create new project with metadata | `--project <name>` `--team <name>` `--goal "..."` |
| **project-get.js** | Get project metadata | `--project <name>` `--team <name>` |
| **project-clean.js** | Clean project state | `--project <name>` `--team <name>` |
| **project-status.js** | Get project dashboard status | `--project <name>` `--team <name>` `[--format json|table]` `[--field <path>]` `[--verbose]` |
| **codex-verify.js** | Run Codex CLI as auxiliary verifier (dual gate) | `--mode check\|review\|exec\|full` `--working-dir <dir>` `--criteria "c1\|c2"` `--output <file>` `--enable <features>` |

**Supporting files:**
- `codex-output-schema.json` - JSON schema for Codex verification output format

Task management is handled by native Claude Code API:
- `TaskCreate` - Create tasks for teammates
- `TaskList` - List current tasks
- `TaskUpdate` - Update task status, assign owners
- `SendMessage` - Direct communication between agents

## Hook Inventory

Hooks run on `bun` runtime. Hooks are idempotent and non-blocking.

| Hook File | Event | Purpose |
|-----------|-------|---------|
| **project-progress.js** | TaskCompleted | Track project progress when tasks complete |
| **teammate-idle.js** | TeammateIdle | Detect idle teammates and assign new work |
| **orchestrator-completed.js** | SubagentStop (teamwork:orchestrator) | Track orchestrator completion |

## Skill Inventory

| Skill | Purpose | Use Case |
|-------|---------|----------|
| **event-coordination** | Event-driven coordination patterns for orchestrator | Hook-based task assignment, idle detection, progress tracking |
| **task-decomposition** | Goal decomposition into parallelizable tasks | Orchestrator uses for planning phase |
| **teamwork-clean** | Reset project execution state | Recovery from failed orchestration |
| **worker-workflow** | 8-phase task lifecycle with TDD, verification, and commit | Find → Claim → Parse → [TDD RED] → Implement/[TDD GREEN] → Verify → Commit → Complete & Report |

## Agent Inventory

| Agent | Model | Role | Key Responsibilities |
|-------|-------|------|---------------------|
| **orchestrator** | opus | Planning and coordination (delegate mode) | Codebase exploration, task decomposition via TaskCreate, spawn workers as teammates, assign tasks via TaskUpdate, coordinate via SendMessage |
| **final-verifier** | opus | Project-level verification | Full build/test, evidence completeness, blocked pattern scanning |
| **worker** | dynamic* | General purpose task execution | Receive task assignment, implement, collect structured evidence, mark resolved |
| **frontend** | dynamic* | Frontend specialist | UI components, styling, state management, accessibility |
| **backend** | dynamic* | Backend specialist | API endpoints, services, database, business logic |
| **devops** | dynamic* | DevOps specialist | CI/CD, deployment, infrastructure |
| **test** | dynamic* | Testing specialist | Unit tests, integration tests, fixtures, mocks |
| **docs** | dynamic* | Documentation specialist | README, API docs, examples |
| **security** | dynamic* | Security specialist | Authentication, authorization, input validation |
| **review** | dynamic* | Code review specialist | Code quality, refactoring, best practices |

**\*Dynamic model selection based on task complexity:**

| Complexity | Model | When to Use |
|------------|-------|-------------|
| `simple` | haiku | Single file, <10 lines, config updates |
| `standard` | sonnet | 1-3 files, typical CRUD |
| `complex` | opus | 5+ files, architecture changes |

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
```

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

**Phase values**: `PLANNING` | `EXECUTION` | `VERIFICATION` | `COMPLETE`

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
  "created_at": "2026-01-12T10:00:00Z",
  "updated_at": "2026-01-12T10:05:00Z",
  "claimed_by": null,
  "claimed_at": null,
  "completed_at": null,
  "evidence": []
}
```

**Task status values**: `open` | `in_progress` | `resolved`

**Role values**: `frontend` | `backend` | `devops` | `test` | `docs` | `security` | `review` | `worker`

## Architecture (v3)

```
┌──────────────────────────────────────────────┐
│      Orchestrator (Delegate Mode, Opus)      │
│   Planning -> Coordination -> Verification   │
│   - Codebase exploration & task breakdown    │
│   - Spawn workers via native teammate API    │
│   - Assign tasks via TaskUpdate(owner)       │
│   - React to TaskCompleted/TeammateIdle      │
└───────────────────┬──────────────────────────┘
                    │
    ┌───────────────┴────────────────┐
    v                                v
┌────────────────────┐    ┌────────────────────┐
│   Workers (8 types) │    │  Verification      │
│   - frontend        │    │  - final-verifier  │
│   - backend         │    └────────────────────┘
│   - test, devops    │
│   - docs, security  │
│   - review, worker  │
└────────────────────┘

   Coordination via native Claude Code API:
┌──────────────────────────────────────┐
│  TaskCreate / TaskUpdate / TaskList  │
│  SendMessage / TeammateIdle hooks    │
└──────────────────────────────────────┘
```

## Workflow

### Phase 1: PLANNING

1. **Input**: Goal or plan documents
2. **Process** (Orchestrator in delegate mode):
   - Explore codebase using Read, Glob, Grep
   - Decompose goal into tasks via `TaskCreate`
   - Set dependencies via `TaskUpdate(addBlockedBy)`
   - Present plan to user for review
3. **Output**: Tasks created, ready for execution

### Phase 2: EXECUTION

1. Orchestrator spawns workers as native teammates: `Task(teamwork:backend)`, `Task(teamwork:frontend)`, etc.
2. Orchestrator assigns tasks to workers via `TaskUpdate(owner)`
3. Workers follow 8-phase worker-workflow skill: Find → Claim → Parse → [TDD RED] → Implement/[TDD GREEN] → Verify → Commit → Complete & Report
   - Workers parse structured task descriptions (XML format with role, purpose, context, constraints)
   - TDD phases (RED/GREEN) are conditional based on task requirements
   - Workers collect structured evidence and commit changes before marking resolved
4. `TaskCompleted` hook notifies orchestrator of progress
5. `TeammateIdle` hook triggers new task assignment

### Phase 3: VERIFICATION

1. All tasks resolved -> orchestrator spawns `Task(teamwork:final-verifier)`
2. Final verifier runs full build/test, checks evidence completeness
3. Results: PASS -> COMPLETE | FAIL -> create fix tasks

### Phase 4: COMPLETE

Project finished. All tasks verified.

## Codex Dual Gate Verification

Teamwork integrates with Codex CLI as an auxiliary verifier in the final-verifier agent.

### How It Works

**Fork-Join Pattern:**
1. **Phase 0 (Fork)**: Final verifier spawns background Codex process via `codex-verify.js`
2. **Phases 1-4**: Final verifier performs primary checks (build, tests, evidence completeness)
3. **Phase 4.5 (Join)**: Final verifier waits for Codex completion, reads results from output file
4. **Phase 5**: Combined verdict (both gates must pass)

**Graceful Degradation:**
- If Codex not installed: Verifier continues with primary checks only
- If Codex fails: Logged as warning, primary gate verdict takes precedence
- Script detects Codex availability via `which codex` check

**Why Dual Gate?**
- Final verifier focuses on build/test success and evidence completeness
- Codex provides code quality analysis and pattern detection
- Two independent verifiers increase confidence in project completion

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

Commands pass `SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts` to agents in the prompt. Agents use `$SCRIPTS_PATH` in bash commands:

```bash
bun "$SCRIPTS_PATH/project-status.js" --project {PROJECT} --team {SUB_TEAM}
```

### Document Synchronization

**When modifying teamwork commands or agents, check and update:**

| File | Location | Role |
|------|----------|------|
| `teamwork.md` | `commands/teamwork.md` | Coordination command |
| `teamwork-worker.md` | `commands/teamwork-worker.md` | Worker command |
| `teamwork-status.md` | `commands/teamwork-status.md` | Status dashboard |
| `teamwork-verify.md` | `commands/teamwork-verify.md` | Manual verification |
| `teamwork-clean.md` | `commands/teamwork-clean.md` | Project cleanup |
| `orchestrator/AGENT.md` | `agents/orchestrator/AGENT.md` | Orchestration agent |
| `worker/AGENT.md` | `agents/worker/AGENT.md` | General worker agent |
| Role agents | `agents/{role}/AGENT.md` | Specialized workers |

## Hook Configuration

```json
{
  "hooks": {
    "TaskCompleted": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/project-progress.js"
      }]
    }],
    "TeammateIdle": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/teammate-idle.js"
      }]
    }],
    "SubagentStop": [{
      "matcher": "teamwork:orchestrator",
      "hooks": [{
        "type": "command",
        "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/orchestrator-completed.js"
      }]
    }]
  }
}
```

## No Build Step Required

Scripts run directly from source. No compilation needed.

## Testing

```bash
# Run all plugin tests
bun test tests/teamwork/

# Run specific test file
bun test tests/teamwork/project-create.test.js
```

### Test Structure

- `tests/teamwork/*.test.js` - Script tests
- `tests/teamwork/lib/*.test.js` - Library module tests
- `tests/teamwork/test-utils.js` - Shared test utilities
- `tests/teamwork/preload.js` - Test isolation preload

## Usage Examples

### Create Project

```bash
bun src/scripts/project-create.js \
  --project my-app \
  --team auth-team \
  --goal "Implement user authentication"
```

### Project Status Dashboard

```bash
bun src/scripts/project-status.js \
  --project my-app \
  --team auth-team \
  --format table
```

### Clean Project

```bash
bun src/scripts/project-clean.js \
  --project my-app \
  --team auth-team
```
