# ultrawork

Verification-first development plugin with evidence-based task completion.

## Plugin Description

Ultrawork enforces a strict workflow cycle:

1. **PLANNING**: Explore codebase, decompose work into tasks with success criteria
2. **EXECUTION**: Workers implement tasks, collecting concrete evidence
3. **VERIFICATION**: Verifier audits evidence, runs tests, makes PASS/FAIL determination
4. **COMPLETE**: All criteria met with verified evidence

Key features:

- Session isolation with state tracking
- Multi-agent orchestration (explorer, planner, worker, verifier, reviewer, scope-analyzer)
- Gate enforcement (blocks code edits during PLANNING phase)
- TDD support with test-first enforcement
- Evidence collection via lifecycle hooks
- Ralph loop (return to EXECUTION on verification failure)
- **Worktree support** for isolated development (v6.1+)

## File Structure

```
plugins/ultrawork/
├── src/
│   ├── lib/
│   │   ├── types.js           # JSDoc type definitions (@typedef)
│   │   ├── file-lock.js       # Cross-platform file locking
│   │   ├── session-utils.js   # Session management utilities
│   │   ├── hook-utils.js      # Hook utilities (stdin, output helpers, error handling)
│   │   ├── args.js            # Command-line argument parsing utility
│   │   ├── blocked-patterns.js # Blocked pattern detection for verification
│   │   ├── field-utils.js     # Nested field extraction with dot notation + array indexing
│   │   ├── json-ops.js        # Atomic JSON read/write operations
│   │   └── hook-guards.js     # Hook guard utilities (parseHookInput, guardSession)
│   ├── scripts/               # CLI scripts (19 files)
│   │   ├── setup-ultrawork.js
│   │   ├── session-get.js
│   │   ├── session-field.js     # Optimized single field extraction
│   │   ├── session-update.js
│   │   ├── task-create.js
│   │   ├── task-get.js
│   │   ├── task-list.js
│   │   ├── task-update.js
│   │   ├── task-summary.js      # AI-friendly task markdown
│   │   ├── context-init.js
│   │   ├── context-add.js
│   │   ├── context-get.js       # Read context.json with field extraction
│   │   ├── ultrawork-status.js
│   │   ├── ultrawork-clean.js
│   │   ├── ultrawork-evidence.js
│   │   ├── evidence-summary.js  # AI-friendly evidence index
│   │   ├── evidence-query.js    # Filter & query evidence
│   │   └── scope-set.js         # Set scope expansion data in context.json
│   └── hooks/                 # Lifecycle hooks (11 files)
│       ├── session-start-hook.js
│       ├── compact-recovery-hook.js
│       ├── session-context-hook.js
│       ├── agent-lifecycle-tracking.js
│       ├── post-tool-use-evidence.js
│       ├── gate-enforcement.js
│       ├── gate-status-notification.js
│       ├── subagent-start-tracking.js
│       ├── subagent-stop-tracking.js
│       ├── stop-hook.js
│       └── keyword-detector.js
├── agents/                    # Agent definitions
│   ├── explorer/
│   ├── planner/
│   ├── worker/
│   ├── verifier/
│   ├── reviewer/
│   └── scope-analyzer/
├── commands/                  # Command definitions
├── hooks/
│   └── hooks.json            # Hook configuration
├── skills/                    # Skill definitions
│   ├── overview-exploration/
│   ├── planning/
│   ├── scripts-path-usage/
│   └── ultrawork/
└── CLAUDE.md                 # This file
```

## Script Inventory

All scripts use Bun runtime with flag-based parameters.

| Script                    | Purpose                                                     | Key Parameters                                                                                                        |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **setup-ultrawork.js**    | Initialize session directory, create session.json           | `--session <ID>` `--goal "..."` `--max-workers N` `--auto`                                                            |
| **session-get.js**        | Read session data or extract specific field                 | `--session <ID>` `--field phase` `--file`                                                                             |
| **session-update.js**     | Update session phase, plan approval, exploration stage      | `--session <ID>` `--phase EXECUTION` `--plan-approved` `--exploration-stage complete`                                 |
| **scope-set.js**          | Set scope expansion data in context.json                    | `--session <ID>` `--data '<JSON>'`                                                                                    |
| **task-create.js**        | Create task JSON file with validation                       | `--session <ID>` `--id "1"` `--subject "..."` `--criteria "c1\|c2"` `--complexity standard\|complex` `--approach tdd` |
| **task-get.js**           | Read task details or extract specific field                 | `--session <ID>` `--task-id "1"` `--field status` (aliases: --task, --id)                                             |
| **task-list.js**          | List tasks with filtering                                   | `--session <ID>` `--status open\|resolved` `--format json\|table`                                                     |
| **task-update.js**        | Update task status and add evidence                         | `--session <ID>` `--task-id "1"` `--status resolved` `--add-evidence "..."` (aliases: --task, --id)                   |
| **context-init.js**       | Initialize context.json with expected explorers             | `--session <ID>` `--expected "overview,exp-1"`                                                                        |
| **context-add.js**        | Add explorer summary to context.json                        | `--session <ID>` `--explorer-id "exp-1"` `--summary "..."` `--key-files "f1,f2"`                                      |
| **context-get.js**        | Read context.json data with field extraction                | `--session <ID>` `--field explorers` `--summary` `--file`                                                             |
| **ultrawork-status.js**   | Display session status dashboard                            | `--session <ID>` `--all`                                                                                              |
| **ultrawork-clean.js**    | Clean current session or batch cleanup                      | `--session <ID>` (single) or `--all` `--completed` `--older-than N` (batch)                                           |
| **ultrawork-evidence.js** | View collected evidence log                                 | `--session <ID>`                                                                                                      |
| **session-field.js**      | Optimized single field extraction with dot notation support | `--session <ID>` `--field phase` `--field options.auto_mode` `--json`                                                 |
| **task-summary.js**       | Generate AI-friendly task markdown                          | `--session <ID>` `--task <ID>` `--save`                                                                               |
| **evidence-summary.js**   | Generate AI-friendly evidence index                         | `--session <ID>` `--save` `--format md\|json`                                                                         |
| **evidence-query.js**     | Query evidence with filters                                 | `--session <ID>` `--type test_result` `--last 5` `--search "npm"` `--task 1`                                          |
| **codex-verify.js**       | Run Codex CLI as auxiliary verifier (dual gate)             | `--mode check\|review\|exec\|full` `--working-dir <dir>` `--criteria "c1\|c2"` `--output <file>` `--enable <features>` |

**Supporting files:**
- `codex-output-schema.json` - JSON schema for Codex verification output format

## Data Access Guide

**Always use scripts for JSON data. Never use Read tool directly on JSON files.**

| Data              | Script                        | When to Use Read     |
| ----------------- | ----------------------------- | -------------------- |
| session.json      | `session-get.js`              | Never                |
| context.json      | `context-get.js`              | Never                |
| tasks/\*.json     | `task-get.js`, `task-list.js` | Never                |
| exploration/\*.md | -                             | Always (Markdown OK) |
| docs/plans/\*.md  | -                             | Always (Markdown OK) |

**Why scripts over direct Read?**

1. **Token efficiency**: JSON wastes tokens on structure (`{`, `"key":`, etc.)
2. **Field extraction**: Scripts return only needed data (`--field status`)
3. **AI-friendly output**: `--summary` generates markdown for better comprehension
4. **Error handling**: Consistent validation and error messages
5. **Abstraction**: Storage format changes don't affect agent code

**Example patterns:**

```bash
# BAD: Direct JSON read wastes tokens
Read("$SESSION_DIR/context.json")  # Returns full JSON with all structure

# GOOD: Script returns only what's needed
bun "$SCRIPTS/context-get.js" --session ${CLAUDE_SESSION_ID} --summary     # AI-friendly markdown
bun "$SCRIPTS/context-get.js" --session ${CLAUDE_SESSION_ID} --field key_files  # Just the array

# Markdown files are OK to read directly
Read("$SESSION_DIR/exploration/overview.md")  # OK
```

## Hook Inventory

All hooks run on `bun` runtime. Hooks are idempotent and non-blocking.

| Hook File                       | Event                   | Purpose                                         | Behavior                                                                                                                                                           |
| ------------------------------- | ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **session-start-hook.js**       | SessionStart            | Cleanup old sessions, provide session ID        | Deletes sessions >7 days old in terminal states (COMPLETE/CANCELLED/FAILED)                                                                                        |
| **compact-recovery-hook.js**    | SessionStart (compact)  | Inject procedural knowledge after compaction    | Reads session.json and tasks/\*.json, generates recovery message for active sessions with delegation rules, context variables, task status, and phase instructions |
| **session-context-hook.js**     | UserPromptSubmit        | Inject session variables into context           | Adds SESSION_ID and CLAUDE_PLUGIN_ROOT to agent prompts                                                                                                            |
| **agent-lifecycle-tracking.js** | PreToolUse              | Track agent execution for evidence              | Records which agents are active (for subagent tracking)                                                                                                            |
| **post-tool-use-evidence.js**   | PostToolUse             | Collect evidence from tool usage                | Records command execution (Bash), file operations (Write/Edit), test results                                                                                       |
| **gate-enforcement.js**         | PreToolUse (Edit/Write) | Enforce phase restrictions and TDD order        | Blocks code edits during PLANNING; blocks implementation before tests in TDD tasks                                                                                 |
| **gate-status-notification.js** | PostToolUse (Task)      | Notify about gate enforcement status            | Displays session phase and gate rules after Task tool usage                                                                                                        |
| **subagent-start-tracking.js**  | SubagentStart (ultrawork:.*) | Track subagent spawn                        | Records agent_id, agent_type to session.active_agents[]                                                                                                            |
| **subagent-stop-tracking.js**   | SubagentStop            | Track subagent completion                       | Uses agent_type for filtering, removes from active_agents[], records completion with agent_type in evidence                                                        |
| **stop-hook.js**                | Stop                    | Validate evidence on stop                       | Checks stop_hook_active to prevent loops, validates evidence sufficiency, enforces zero-tolerance rules                                                            |
| **keyword-detector.js**         | UserPromptSubmit        | Detect ultrawork keywords and transform prompts | Transforms "ultrawork X", "ulw X", "uw X" to /ultrawork commands; supports --auto and --plan-only modes                                                            |

## Agent Inventory

| Agent              | Model   | Role                 | Key Responsibilities                                                                                            |
| ------------------ | ------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **explorer**       | haiku   | Codebase discovery   | Fast exploration, write findings to `exploration/*.md`, update `context.json` with summary                      |
| **planner**        | inherit | Task decomposition   | Read explorer context, make design decisions (auto mode), create task graph, write design doc to `docs/plans/`  |
| **worker**         | inherit | Task implementation  | Execute ONE task, collect evidence, update task file. Supports standard and TDD approaches                      |
| **verifier**       | inherit | Quality gatekeeper   | Audit evidence, scan for blocked patterns, run final tests, PASS/FAIL determination, trigger Ralph loop on fail |
| **reviewer**       | inherit | Code review          | Deep verification, read actual code, check edge cases, detect security issues, provide specific feedback        |
| **scope-analyzer** | haiku   | Dependency detection | Analyze cross-layer deps, output to context.json scopeExpansion                                                 |

## State Management

### Directory Structure

```
~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}/
├── session.json           # Session state (minimal metadata)
├── context.json           # Exploration summary (lightweight index)
├── evidence/              # Evidence files (NEW: separated from session.json)
│   ├── log.jsonl          # Append-only evidence log
│   └── index.md           # AI-friendly summary (generated)
├── exploration/           # Detailed exploration files (*.md)
│   ├── overview.md
│   ├── exp-1.md
│   └── exp-2.md
└── tasks/                 # Task files (*.json + summary.md)
    ├── 1.json
    ├── 2.json
    ├── verify.json
    └── summary.md         # AI-friendly task overview (generated)
```

### Session State Format

**File**: `~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}/session.json`

```json
{
  "version": "6.1",
  "session_id": "abc-123",
  "working_dir": "/path/to/project",
  "original_dir": null,
  "goal": "Implement user authentication",
  "started_at": "2026-01-12T10:00:00Z",
  "updated_at": "2026-01-12T10:05:00Z",
  "phase": "PLANNING",
  "exploration_stage": "overview",
  "iteration": 1,
  "plan": {
    "approved_at": null
  },
  "options": {
    "max_workers": 0,
    "max_iterations": 5,
    "skip_verify": false,
    "plan_only": false,
    "auto_mode": false
  },
  "worktree": null,
  "evidence_log": [],
  "cancelled_at": null
}
```

**With worktree enabled** (`/ultrawork "goal" --worktree`):

```json
{
  "version": "6.1",
  "working_dir": "/project/.worktrees/user-auth-2026-01-17",
  "original_dir": "/project",
  "worktree": {
    "enabled": true,
    "branch": "ultrawork/user-auth-2026-01-17",
    "path": "/project/.worktrees/user-auth-2026-01-17",
    "created_at": "2026-01-17T10:00:00Z"
  }
}
```

**Phase values**: `PLANNING` | `EXECUTION` | `VERIFICATION` | `COMPLETE` | `CANCELLED` | `FAILED`

**Exploration stages**: `not_started` | `overview` | `analyzing` | `targeted` | `complete`

### Task State Format

**File**: `~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}/tasks/{TASK_ID}.json`

```json
{
  "id": "1",
  "subject": "Add user authentication middleware",
  "description": "Implement JWT-based auth middleware in src/middleware/auth.ts",
  "complexity": "standard",
  "status": "open",
  "blocked_by": [],
  "criteria": [
    "Middleware created in src/middleware/auth.ts",
    "Tests pass with 5/5 assertions",
    "Handles invalid tokens gracefully"
  ],
  "evidence": [
    "Created src/middleware/auth.ts",
    "npm test -- auth.test.ts: 5/5 passed, exit 0"
  ],
  "created_at": "2026-01-12T10:10:00Z",
  "updated_at": "2026-01-12T10:15:00Z",
  "approach": "standard",
  "test_file": null
}
```

**Task status values**: `open` | `in_progress` | `resolved` | `blocked`

**Complexity values**: `simple` | `standard` | `complex`

**Approach values**: `standard` | `tdd`

### TDD Task Format

```json
{
  "id": "2",
  "subject": "Validate user input",
  "description": "Add input validation with test-first approach",
  "complexity": "standard",
  "status": "in_progress",
  "blocked_by": [],
  "criteria": [
    "Test file created first",
    "Test failed (TDD-RED)",
    "Implementation passes test (TDD-GREEN)"
  ],
  "evidence": [
    "TDD-RED: Created test file tests/validation.test.ts",
    "TDD-RED: Test fails as expected (exit code 1)",
    "TDD-GREEN: Implemented src/validation.ts",
    "TDD-GREEN: Test passes (exit code 0)"
  ],
  "created_at": "2026-01-12T10:20:00Z",
  "updated_at": "2026-01-12T10:25:00Z",
  "approach": "tdd",
  "test_file": "tests/validation.test.ts"
}
```

### Context State Format

**File**: `~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}/context.json`

```json
{
  "version": "2.1",
  "expected_explorers": ["overview", "exp-auth"],
  "exploration_complete": true,
  "explorers": [
    {
      "id": "overview",
      "hint": "",
      "file": "exploration/overview.md",
      "summary": "Next.js 14 app with TypeScript, using App Router"
    },
    {
      "id": "exp-auth",
      "hint": "Find authentication files",
      "file": "exploration/exp-auth.md",
      "summary": "Found NextAuth.js setup in app/api/auth/[...nextauth]/route.ts"
    }
  ],
  "key_files": ["app/api/auth/[...nextauth]/route.ts", "src/lib/auth.ts"],
  "patterns": ["NextAuth.js", "JWT tokens"],
  "constraints": []
}
```

## Scope Expansion Detection

### Overview

Scope Analyzer detects when user's request requires work beyond explicit scope:

- FE request → BE API needed
- BE request → FE update needed
- Any change → Codegen required
- BE change → DB migration needed

### When It Runs

- **Timing**: After overview exploration, parallel with targeted exploration
- **Agent**: `scope-analyzer` (haiku model)
- **Output**: `context.json.scopeExpansion`

### context.json Extension

```json
{
  "scopeExpansion": {
    "originalRequest": "Add PPT options to Feed form",
    "detectedLayers": ["frontend", "backend", "database", "codegen"],
    "dependencies": [
      {
        "from": "FE Form",
        "to": "BE API DTO",
        "type": "blocking",
        "reason": "FE references types that don't exist in BE"
      }
    ],
    "suggestedTasks": [
      { "layer": "database", "description": "Add PPT fields to schema" },
      { "layer": "backend", "description": "Update Feed DTO" },
      { "layer": "codegen", "description": "Regenerate API client" },
      { "layer": "frontend", "description": "Add PPT options to form" }
    ],
    "blockingConstraints": ["BE API must exist before FE"],
    "confidence": "high"
  }
}
```

### Dependency Types

| Type        | Icon | Meaning                | Auto Mode      |
| ----------- | ---- | ---------------------- | -------------- |
| blocking    | 🔴    | Cannot proceed without | Always include |
| recommended | 🟡    | Should include         | Always include |
| optional    | 🟢    | Nice to have           | Skip           |

### Mode Behavior

| Mode        | Behavior                                                  |
| ----------- | --------------------------------------------------------- |
| Interactive | Display analysis, ask user preference (all/blocking/skip) |
| Auto        | Conservative inclusion (blocking + recommended)           |

### Task Ordering

When scope expansion suggests multiple layers:

1. Database first (schema must exist)
2. Backend second (API must exist for FE)
3. Codegen third (regenerate after BE)
4. Frontend fourth (depends on types)
5. Verify always last

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
2. **Agents** use `{SCRIPTS_PATH}` in bash commands:
   ```bash
   bun "{SCRIPTS_PATH}/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id 1 --status resolved
   ```

#### DO NOT

```bash
# WRONG - this will fail in agents
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"
bun "$SCRIPTS/task-update.js" ...
```

#### DO

```bash
# CORRECT - use SCRIPTS_PATH from prompt
bun "{SCRIPTS_PATH}/task-update.js" ...
```

### Agent Workflow Rules

| Agent        | Spawned By          | Input                   | Output                            | State Changes                         |
| ------------ | ------------------- | ----------------------- | --------------------------------- | ------------------------------------- |
| **explorer** | Orchestrator        | SESSION_ID, SEARCH_HINT | exploration/\*.md, context.json   | Updates context.json                  |
| **planner**  | Orchestrator        | SESSION_ID, goal        | tasks/_.json, docs/plans/_.md     | session.phase → EXECUTION             |
| **worker**   | Orchestrator        | SESSION_ID, TASK_ID     | Updated task.json                 | task.status → resolved                |
| **verifier** | Orchestrator        | SESSION_ID              | Updated verify task, session.json | session.phase → COMPLETE or EXECUTION |
| **reviewer** | Worker/Orchestrator | TASK_ID, files          | Review JSON                       | No state change                       |

### Phase Transition Rules

```
PLANNING → EXECUTION
  Trigger: Planner completes task graph
  Script: session-update.js --phase EXECUTION

EXECUTION → VERIFICATION
  Trigger: All non-verify tasks resolved
  Script: session-update.js --phase VERIFICATION

VERIFICATION → COMPLETE (success)
  Trigger: Verifier PASS verdict
  Script: session-update.js --phase COMPLETE

VERIFICATION → EXECUTION (failure - Ralph Loop)
  Trigger: Verifier FAIL verdict, creates fix tasks
  Script: session-update.js --phase EXECUTION
```

### Gate Enforcement Rules

**PLANNING Phase**:

- Allow: `design.md`, `session.json`, `context.json`, `exploration/*.md`, `docs/plans/*.md`
- Block: All other file edits (Edit/Write tools)

**EXECUTION Phase (TDD tasks)**:

- Allow: Test files first (_.test._, _.spec._, **tests**/\*)
- Block: Implementation files before TDD-RED evidence

**Evidence Required for TDD**:

1. TDD-RED: Test file created, test executed, exit code 1
2. TDD-GREEN: Implementation created, test executed, exit code 0
3. TDD-REFACTOR: (Optional) Improvements made, tests still pass

### Blocked Patterns

Verifier scans all evidence for these patterns. If found → instant FAIL:

- "should work"
- "probably works"
- "basic implementation"
- "you can extend"
- "TODO"
- "FIXME"
- "not implemented"
- "placeholder"

## Codex Dual Gate Verification

Ultrawork integrates with Codex CLI as an auxiliary verifier running in parallel during the VERIFICATION phase.

### How It Works

**Fork-Join Pattern:**
1. **Phase 0 (Fork)**: Verifier spawns background Codex process via `codex-verify.js`
2. **Phases 1-4**: Verifier performs primary checks (evidence audit, tests, blocked patterns)
3. **Phase 4.5 (Join)**: Verifier waits for Codex completion, reads results from output file
4. **Phase 5**: Combined verdict (both gates must pass)

**Graceful Degradation:**
- If Codex not installed: Verifier continues with primary checks only
- If Codex fails: Logged as warning, primary gate verdict takes precedence
- Script detects Codex availability via `which codex` check

**Verification Modes:**
- `check`: Quick lint-style checks
- `review`: Code quality review
- `exec`: Run tests and validation
- `full`: Complete verification (check + review + exec)

**Output Format:**
- Codex writes JSON to temporary file (schema: `codex-output-schema.json`)
- Verifier parses results and integrates into final verdict
- Both gate results included in evidence log

**Why Dual Gate?**
- Ultrawork verifier focuses on evidence completeness and test execution
- Codex provides code quality analysis and pattern detection
- Two independent verifiers increase confidence in PASS verdict

## Hook Configuration

**IMPORTANT**: hooks.json must use explicit `bun` prefix for cross-platform compatibility.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start-hook.js"
          }
        ]
      },
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/compact-recovery-hook.js"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/gate-enforcement.js"
          }
        ]
      }
    ]
  }
}
```

**Why explicit `bun`?**

- Shebang (`#!/usr/bin/env bun`) doesn't work on Windows
- Explicit runtime ensures cross-platform execution
- All hooks should follow this pattern

## Session Lifecycle

### 1. Session Start

```bash
/ultrawork "implement user authentication"
```

- Hook: session-start-hook.js (cleanup old sessions)
- Script: setup-ultrawork.js (create session directory)
- Creates: session.json, context.json, exploration/, tasks/

### 2. Exploration Phase

```bash
# Orchestrator spawns explorers
explorer -> overview exploration
explorer -> targeted exploration (if needed)
```

- Agents: explorer (haiku model)
- Output: exploration/overview.md, exploration/exp-\*.md
- Updates: context.json with summary

### 3. Planning Phase

```bash
# Orchestrator spawns planner
planner -> read context -> design tasks
```

- Agent: planner (inherit model)
- Output: tasks/\*.json, docs/plans/design.md
- Updates: session.phase → EXECUTION

### 4. Execution Phase

```bash
# Orchestrator spawns workers
worker -> execute task 1
worker -> execute task 2 (parallel if unblocked)
```

- Agent: worker (inherit model)
- Hooks: gate-enforcement.js (block if TDD violation)
- Hooks: post-tool-use-evidence.js (collect evidence)
- Updates: task.status → resolved

### 5. Verification Phase

```bash
# Orchestrator spawns verifier
verifier -> audit evidence -> run tests -> PASS/FAIL
```

- Agent: verifier (inherit model)
- Output: Updated verify task, session.json
- Updates: session.phase → COMPLETE (PASS) or EXECUTION (FAIL)

### 6. Session Complete

```bash
/ultrawork-status --session {ID}
```

- Display: Final dashboard with all evidence
- State: session.phase = COMPLETE

## No Build Step Required

Scripts run directly from source. No compilation needed.

## Testing

This plugin includes automated tests using Bun's built-in test runner.

### Running Tests

```bash
# Run all plugin tests
bun test tests/ultrawork/

# Run specific test file
bun test tests/ultrawork/session-get.test.js

# Run with coverage
bun test tests/ultrawork/ --coverage
```

### Test Structure

- `tests/ultrawork/*.test.js` - Script tests
- `tests/ultrawork/lib/*.test.js` - Lib module tests
- `tests/test-utils.js` - Shared utilities

### Writing New Tests

When adding new scripts or modifying existing ones:

1. **Create/update corresponding .test.js file**
   - Script: `src/scripts/task-get.js` → Test: `tests/ultrawork/task-get.test.js`
   - Lib: `src/lib/session-utils.js` → Test: `tests/ultrawork/lib/session-utils.test.js`

2. **Cover essential scenarios:**
   - Help flag (`--help`)
   - Success case with valid parameters
   - Required parameter validation
   - Edge cases (empty values, non-existent resources)

3. **Use test utilities:**
   - `mockSession()` - Creates isolated test session directories
   - Clean up test data in `afterEach` blocks

4. **Run tests before committing:**
   ```bash
   bun test tests/ultrawork/
   ```

### Updating Tests on Plugin Changes

| Change Type      | Test Action                                    |
| ---------------- | ---------------------------------------------- |
| New parameter    | Add test for parameter handling and validation |
| New output field | Update schema validation tests                 |
| Bug fix          | Add regression test to prevent reoccurrence    |
| New script       | Create new test file with full coverage        |

### Test Requirements

- All scripts should have corresponding test files
- Tests must verify actual behavior (not just pass)
- Mock external dependencies (file system, git)
- Use descriptive test names
- Include error path testing

### Test Isolation (CRITICAL)

**Tests MUST be isolated from real user data.** The `~/.claude/ultrawork/` directory contains real user sessions that must never be affected by tests.

#### How It Works

1. **Environment Variable**: `ULTRAWORK_TEST_BASE_DIR` overrides the base directory
2. **Preload Script**: `tests/ultrawork/preload.js` sets this before any test runs
3. **Safety Validation**: `validateSafeDelete()` blocks deletion of real paths

#### Test File Pattern

```javascript
// 1. Set env BEFORE importing session-utils
const {
  TEST_BASE_DIR,
  createMockSession,
  runScript,
} = require("./test-utils.js");
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR;

// 2. Now import session-utils (will use test path)
const {
  readSession,
} = require("../../plugins/ultrawork/src/lib/session-utils.js");

// 3. Use test utilities for mock sessions
const session = createMockSession("test-session");

// 4. Clean up in afterAll
afterAll(() => {
  cleanupAllTestSessions();
  delete process.env.ULTRAWORK_TEST_BASE_DIR;
});
```

#### Safety Mechanisms

| Mechanism                 | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `ULTRAWORK_TEST_BASE_DIR` | Redirects all paths to tmpdir             |
| `validateSafeDelete()`    | Throws error if deleting outside test dir |
| `bunfig.toml` preload     | Auto-sets env for all tests               |
| `test-isolation.test.js`  | Verifies isolation is working             |

#### DO NOT

```javascript
// WRONG: Imports session-utils before setting env
const { getSessionDir } = require("../lib/session-utils.js");
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR; // Too late!
```

#### If Tests Delete Real Data

1. Check if `ULTRAWORK_TEST_BASE_DIR` is set before import
2. Run `bun test tests/ultrawork/test-isolation.test.js` to verify setup
3. Check `bunfig.toml` has preload configured

## Usage Examples

### Create Session

```bash
bun src/scripts/setup-ultrawork.js --session abc-123 --goal "Add user auth"
```

### Get Session Info

```bash
bun src/scripts/session-get.js --session abc-123
bun src/scripts/session-get.js --session abc-123 --field phase

# Session directory (use direct path instead of script)
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}
```

### Create Task

```bash
bun src/scripts/task-create.js --session abc-123 \
  --id "1" \
  --subject "Add auth middleware" \
  --description "Implement JWT middleware" \
  --complexity standard \
  --criteria "Tests pass|Middleware created"
```

### Update Task

```bash
# Primary parameter: --task-id (aliases: --task, --id also accepted)
bun src/scripts/task-update.js --session abc-123 --task-id "1" \
  --status resolved \
  --add-evidence "npm test: 5/5 passed, exit 0"
```

### List Tasks

```bash
bun src/scripts/task-list.js --session abc-123 --format json
```

### Update Session Phase

```bash
bun src/scripts/session-update.js --session abc-123 --phase EXECUTION
```

### View Status

```bash
bun src/scripts/ultrawork-status.js --session abc-123
```

### Clean Sessions

```bash
# Clean current session (for fresh /ultrawork start)
bun src/scripts/ultrawork-clean.js --session ${CLAUDE_SESSION_ID}

# Batch: Delete sessions older than N days in terminal states
bun src/scripts/ultrawork-clean.js --older-than 30

# Batch: Delete all completed sessions (terminal states)
bun src/scripts/ultrawork-clean.js --completed

# Batch: Delete ALL sessions (including active ones)
bun src/scripts/ultrawork-clean.js --all
```

## Known Limitations

### Post-Compaction Delegation Compliance

**Issue**: After context compaction (when the conversation gets too long), the main agent may forget to delegate tasks to sub-agents and instead execute them directly.

**Why it happens**:
1. Claude Code hooks cannot distinguish between the "orchestrator" (main agent) and "worker" (sub-agent) contexts
2. Both share the same `session_id` and trigger the same hooks
3. Delegation rules are instruction-based, not enforcement-based
4. After compaction, many instructions compete for attention

**Mitigation**:
1. The `compact-recovery-hook.js` injects emphatic delegation reminders
2. The recovery message explicitly warns about this failure mode
3. The instructions include a "STOP" directive when about to Edit/Write directly

**If you notice the agent doing work directly**:
- Remind it: "You're the orchestrator. Use Task(subagent_type='ultrawork:worker', ...) to spawn workers."
- The agent should recognize the pattern and correct itself

**Technical limitation**: There's no way to implement hard enforcement without Claude Code providing an `agent_context` field in hook inputs that distinguishes orchestrator from worker contexts.

### Hook Input Fields (Verified 2026-02-07)

SubagentStop hook input includes fields not previously utilized:
- `agent_type`: Agent type identifier (format: `"ultrawork:worker"`, `"ultrawork:explorer"`, etc.)
- `agent_transcript_path`: Path to subagent's transcript file
- `stop_hook_active`: Boolean indicating if a stop hook already blocked

These fields enable agent_type-based filtering and lifecycle tracking. The `agent_type` format for plugin agents is `plugin:agent_name` (e.g., `"ultrawork:worker"`), confirmed via live testing.
