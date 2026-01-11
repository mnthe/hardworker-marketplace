# ultrawork

Strict verification-first development mode with Session ID-based isolation.

## Overview

Ultrawork enforces rigorous development practices through automated planning, evidence-based completion, and zero tolerance for partial implementations. Every task requires success criteria defined BEFORE implementation, and completion is only accepted when backed by concrete evidence (test results, command outputs, exit codes).

The plugin operates in isolated sessions, where each development goal goes through structured phases:
1. **Exploration**: Automated codebase discovery via explorer agents
2. **Planning**: Task decomposition with dependency graphs
3. **Execution**: Parallel worker execution with evidence collection
4. **Verification**: Strict validation of all success criteria

## Features

- **Mandatory Planning**: Every goal requires upfront planning with success criteria
- **Evidence-Based Completion**: No speculative language allowed ("should work", "probably works")
- **Session Isolation**: Each goal runs in isolated session with unique UUID
- **Automated Exploration**: Explorer agents discover codebase patterns before planning
- **Parallel Execution**: Workers run concurrently with configurable limits
- **Execute-Verify Loop**: Automatic retry on verification failure (Ralph loop pattern)
- **TDD Support**: Built-in Test-Driven Development workflow enforcement
- **Zero Tolerance**: Blocked patterns ("TODO", "FIXME", "basic implementation") fail verification
- **Cross-Platform**: JavaScript/Bun implementation works on Windows, MacOS, Linux
- **Interactive Mode**: User approval at decision points (authentication method, architecture choices)
- **Auto Mode**: Fully autonomous operation for CI/CD and well-defined tasks

## Installation

### From Marketplace

```bash
claude plugin marketplace add mnthe/hardworker-marketplace
claude plugin install ultrawork@hardworker-marketplace
```

### Local Development

```bash
claude --plugin-dir /path/to/hardworker-marketplace/plugins/ultrawork
```

## Usage

### Basic Commands

```bash
# Full workflow (plan + execute)
/ultrawork "implement user authentication"

# Auto mode (no user interaction)
/ultrawork --auto "fix login bug"

# Plan only (review before execution)
/ultrawork-plan "add payment processing"

# Execute existing plan
/ultrawork-exec

# Check session status
/ultrawork-status

# Show collected evidence
/ultrawork-evidence

# Cancel current session
/ultrawork-cancel

# Show help
/ultrawork-help
```

### Command Options

#### /ultrawork

```bash
/ultrawork [options] <goal>

Options:
  --auto              Skip user interaction, auto-decide everything
  --max-workers N     Limit concurrent workers (default: unlimited)
  --max-iterations N  Max execute-verify retry loops (default: 5)
  --skip-verify       Skip verification phase (fast mode)
  --plan-only         Stop after planning, don't execute
```

Examples:

```bash
# Feature implementation with user interaction
/ultrawork "implement JWT authentication"

# Auto mode for well-defined tasks
/ultrawork --auto "add unit tests for auth module"

# Limit parallel workers
/ultrawork --max-workers 3 "refactor database layer"

# Plan only (dry run)
/ultrawork --plan-only "migrate to TypeScript"

# Fast mode (skip verification)
/ultrawork --skip-verify "fix typo in documentation"
```

#### /ultrawork-plan

```bash
/ultrawork-plan [options] <goal>

Options:
  --auto    Auto-decide during planning (no user questions)
```

Creates planning documents without execution. Outputs:
- `docs/plans/YYYY-MM-DD-{goal-slug}-design.md` (design document)
- `~/.claude/ultrawork/sessions/{session-id}/tasks/*.json` (task files)

#### /ultrawork-exec

```bash
/ultrawork-exec [options]

Options:
  --max-iterations N  Override max retry iterations
  --skip-verify       Skip verification phase
```

Executes plan created by `/ultrawork-plan`. Includes automatic retry loop for failed tasks.

#### /ultrawork-status

```bash
# Current session status
/ultrawork-status

# All sessions
/ultrawork-status --all
```

Displays:
- Current phase (PLANNING/EXECUTION/VERIFICATION/COMPLETE)
- Exploration stage
- Task progress (completed/total)
- Evidence collection status

#### /ultrawork-evidence

```bash
/ultrawork-evidence
```

Shows collected evidence for all tasks with verification status.

#### /ultrawork-cancel

```bash
/ultrawork-cancel
```

Cancels current session, preserves all history and evidence.

## Commands

| Command                  | Description                    | Options                                                                           |
| ------------------------ | ------------------------------ | --------------------------------------------------------------------------------- |
| `/ultrawork <goal>`      | Full workflow (plan + execute) | `--auto`, `--max-workers N`, `--max-iterations N`, `--skip-verify`, `--plan-only` |
| `/ultrawork-plan <goal>` | Interactive planning only      | `--auto`                                                                          |
| `/ultrawork-exec`        | Execute existing plan          | `--max-iterations N`, `--skip-verify`                                             |
| `/ultrawork-status`      | Check session status           | `--all`                                                                           |
| `/ultrawork-evidence`    | Show collected evidence        | -                                                                                 |
| `/ultrawork-cancel`      | Cancel current session         | -                                                                                 |
| `/ultrawork-help`        | Show help documentation        | -                                                                                 |

## Agents

| Agent        | Model       | Purpose                       | Key Responsibilities                                                                                                              |
| ------------ | ----------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **planner**  | opus        | Task decomposition and design | Reads exploration context, makes architecture decisions (auto mode), creates task graph with dependencies, writes design document |
| **explorer** | haiku       | Codebase discovery            | Finds patterns and structures, writes detailed findings to exploration/*.md, updates context.json summary                         |
| **worker**   | sonnet/opus | Task implementation           | Executes single task, collects evidence for success criteria, updates task status, supports TDD workflow                          |
| **verifier** | opus        | Quality gatekeeper            | Validates evidence completeness, scans for blocked patterns, runs final tests, makes PASS/FAIL determination                      |
| **reviewer** | sonnet      | Code quality review           | Deep code verification, security vulnerability detection, edge case identification, performance analysis (optional)               |

### Agent Execution Flow

```
/ultrawork "goal"
    │
    ├─→ explorer (overview)     │ Codebase discovery
    ├─→ explorer (targeted)     │
    │                           │
    ├─→ planner                 │ Task decomposition
    │                           │
    ├─→ worker (task 1)         │ Parallel execution
    ├─→ worker (task 2)         │ with evidence
    ├─→ worker (task 3)         │ collection
    │                           │
    └─→ verifier                │ Final validation
```

## How It Works

### Workflow Diagram

```
┌─────────────────────────────────────────────────────┐
│ 1. EXPLORATION                                      │
│    ├─ Overview: Quick project scan (Skill)          │
│    └─ Targeted: Deep area exploration (Agents)      │
│    Output: exploration/*.md, context.json           │
└─────────────────┬───────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│ 2. PLANNING                                         │
│    ├─ Interactive: User clarifications via UI       │
│    └─ Auto: Planner agent decides autonomously      │
│    Output: design.md, tasks/*.json                  │
└─────────────────┬───────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│ 3. EXECUTION                                        │
│    ├─ Workers run tasks in parallel                 │
│    ├─ Dependency resolution (task graph)            │
│    └─ Evidence collected per task                   │
│    Loop: Retry failed tasks up to max_iterations    │
└─────────────────┬───────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│ 4. VERIFICATION                                     │
│    ├─ Validate evidence completeness                │
│    ├─ Scan for blocked patterns                     │
│    ├─ Run final tests                               │
│    └─ PASS → COMPLETE / FAIL → EXECUTION (retry)    │
└─────────────────────────────────────────────────────┘
```

### Session Phases

| Phase          | Description                             | Next Phase                              |
| -------------- | --------------------------------------- | --------------------------------------- |
| `EXPLORATION`  | Explorer agents gather codebase context | `PLANNING`                              |
| `PLANNING`     | Create design document and task graph   | `EXECUTION`                             |
| `EXECUTION`    | Workers implement tasks in parallel     | `VERIFICATION`                          |
| `VERIFICATION` | Verifier checks evidence and criteria   | `COMPLETE` (pass) or `EXECUTION` (fail) |
| `COMPLETE`     | All criteria verified with evidence     | End                                     |
| `FAILED`       | Max iterations reached without pass     | End                                     |
| `CANCELLED`    | User cancelled session                  | End                                     |

### Exploration Stages

| Stage         | Description                                  |
| ------------- | -------------------------------------------- |
| `not_started` | Fresh session, no exploration yet            |
| `overview`    | Quick project scan running/complete          |
| `analyzing`   | Overview done, planning targeted exploration |
| `targeted`    | Targeted explorers running                   |
| `complete`    | All exploration finished                     |

## Configuration

### Session Options

Configured via command-line flags:

| Option           | Default       | Description                        |
| ---------------- | ------------- | ---------------------------------- |
| `auto`           | false         | Skip user interaction              |
| `max_workers`    | 0 (unlimited) | Limit concurrent worker agents     |
| `max_iterations` | 5             | Maximum execute-verify retry loops |
| `skip_verify`    | false         | Skip verification phase            |
| `plan_only`      | false         | Stop after planning                |

### Task Complexity

Determines model selection:

| Complexity | Model  | Use Cases                                                       |
| ---------- | ------ | --------------------------------------------------------------- |
| `standard` | sonnet | CRUD operations, simple features, tests, documentation          |
| `complex`  | opus   | Architecture changes, security features, multi-file refactoring |

### TDD Workflow

Tasks can specify `approach: "tdd"` to enforce Test-Driven Development:

```
Phase 1: RED   - Write failing test first
Phase 2: GREEN - Minimal implementation to pass
Phase 3: REFACTOR - Improve code quality
```

Gate hooks block out-of-order operations (implementation before test).

## Storage

### Session Directory Structure

```
~/.claude/ultrawork/sessions/{session-id}/
├── session.json           # Session metadata (goal, phase, options)
├── context.json           # Exploration summary (lightweight index)
├── exploration/           # Detailed findings
│   ├── overview.md        # Project overview
│   ├── exp-1.md           # Targeted exploration 1
│   ├── exp-2.md           # Targeted exploration 2
│   └── exp-3.md           # Targeted exploration 3
└── tasks/                 # Task files with evidence
    ├── 1.json             # Task metadata, status, evidence
    ├── 2.json
    ├── 3.json
    └── verify.json        # Verification task
```

### Project Directory Structure

Design documents are written to the project directory:

```
{working-directory}/
└── docs/
    └── plans/
        └── YYYY-MM-DD-{goal-slug}-design.md
```

### Session State Format

```json
{
  "session_id": "uuid",
  "team": "default",
  "working_dir": "/path/to/project",
  "goal": "implement user authentication",
  "phase": "EXECUTION",
  "exploration_stage": "complete",
  "options": {
    "auto_mode": false,
    "max_workers": 0,
    "max_iterations": 5,
    "skip_verify": false,
    "plan_only": false
  },
  "iteration": 1,
  "created_at": "2026-01-11T12:00:00.000Z",
  "updated_at": "2026-01-11T12:30:00.000Z"
}
```

### Task File Format

```json
{
  "id": "1",
  "subject": "Setup NextAuth provider",
  "description": "Configure NextAuth with credentials",
  "complexity": "standard",
  "status": "resolved",
  "blocked_by": [],
  "criteria": [
    "Auth routes respond",
    "Login flow works"
  ],
  "evidence": [
    "Created src/auth/next-auth.ts",
    "npm test: 15/15 passed, exit 0"
  ],
  "approach": "standard",
  "created_at": "2026-01-11T12:00:00.000Z",
  "updated_at": "2026-01-11T12:15:00.000Z"
}
```

## Workflows

### Interactive Workflow

```bash
# 1. Start planning
/ultrawork-plan "implement user authentication"

# 2. Exploration (automatic)
#    - Overview skill gathers project structure
#    - Targeted explorers investigate auth patterns

# 3. Planning (interactive)
#    - Agent asks: "Which auth method?" (OAuth, JWT, etc.)
#    - User selects option
#    - Agent presents design in sections
#    - User approves each section

# 4. Plan review
#    - Agent shows task breakdown
#    - User approves or requests changes

# 5. Execute
/ultrawork-exec

# 6. Monitor progress
/ultrawork-status
/ultrawork-evidence
```

### Auto Workflow

```bash
# Single command for autonomous operation
/ultrawork --auto "add unit tests for payment module"

# System automatically:
# 1. Explores codebase
# 2. Creates plan (no user input)
# 3. Executes tasks
# 4. Verifies completion
# 5. Reports results
```

### TDD Workflow

```bash
# Task with TDD approach enforced
# 1. Worker creates test file FIRST
# 2. Runs test, VERIFIES IT FAILS (RED)
# 3. Implements minimal code (GREEN)
# 4. Refactors while keeping tests passing
# 5. Evidence chain proves TDD sequence
```

## Zero Tolerance Rules

### Blocked Patterns

These phrases cause immediate verification FAIL:

```
- "should work"
- "probably works"
- "basic implementation"
- "you can extend"
- "TODO"
- "FIXME"
- "not implemented"
- "placeholder"
```

### Evidence Requirements

Every success criterion MUST have:

| Element     | Example                | Required |
| ----------- | ---------------------- | -------- |
| Command     | `npm test`             | Yes      |
| Full output | Complete stdout/stderr | Yes      |
| Exit code   | `Exit code: 0`         | Yes      |

Invalid evidence:
- "I ran the tests and they passed" (no proof)
- "The API works correctly" (no request/response)
- "Implementation looks good" (subjective)

## Troubleshooting

### Session Not Found

```bash
# List all sessions
/ultrawork-status --all

# Session ID provided by hook in system-reminder
# Look for: CLAUDE_SESSION_ID: {uuid}
```

### Tasks Not Executing

```bash
# Check task dependencies
/ultrawork-status

# Tasks blocked by dependencies won't run until blockers resolve
```

### Verification Failing

```bash
# Review evidence
/ultrawork-evidence

# Check for:
# - Missing evidence for criteria
# - Blocked patterns in output
# - Failed test commands

# Fix issues and execution will retry automatically
```

### Worker Pool Exhaustion

```bash
# Limit concurrent workers
/ultrawork --max-workers 2 "goal"

# Useful for:
# - Resource-constrained environments
# - Debugging worker failures
# - Rate-limited external services
```

## Requirements

- **Claude Code CLI**: Latest version with plugin support
- **Bun**: 1.3+ for script execution
- **Git**: For version control operations
- **Platform**: Windows, MacOS, or Linux

## License

MIT
