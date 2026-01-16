# Getting Started with Hardworker Marketplace

This guide introduces you to the hardworker-marketplace plugin ecosystem for Claude Code. You will learn how to install plugins, run your first workflow, and understand the core concepts.

For advanced topics, see [Plugin Development Guide](plugin-development.md) and [Workflow Guide](workflow-guide.md).

## Prerequisites

Before starting, verify you have:

- Claude Code CLI installed and running
- Bun installed (for script execution)
- Git installed (for version control features)

Verify your setup:

```bash
claude --version
bun --version
git --version
```

## Installing Plugins

### Add the Marketplace

Add the hardworker-marketplace to your Claude Code instance:

```bash
claude plugin marketplace add mnthe/hardworker-marketplace
```

This command downloads the marketplace configuration from GitHub and makes plugins available for installation.

### Install a Plugin

Install the ultrawork plugin:

```bash
claude plugin install ultrawork@hardworker-marketplace
```

### Verify Installation

List installed plugins to confirm:

```bash
claude plugin list
```

Output includes installed plugins with their versions and descriptions.

## Your First Workflow

### Starting an Ultrawork Session

The ultrawork plugin provides verification-first development with strict evidence collection.

Start a session:

```bash
claude
# Inside Claude Code session:
/ultrawork "create a user registration function with email validation"
```

The workflow follows these phases:

1. **Planning**: Planner agent analyzes your goal and creates tasks with success criteria
2. **Review**: You review the plan (in interactive mode)
3. **Execution**: Worker agents execute tasks in dependency order
4. **Verification**: Verifier agent checks all criteria with evidence
5. **Completion**: Session ends when all criteria pass

### Understanding the Output

The planner creates tasks in this format:

```
Task 1: Create validation function
- Criterion: Function validates email format using regex
- Criterion: Function rejects emails without @ symbol
- Criterion: Tests pass for valid and invalid emails
```

Each criterion requires concrete evidence (test output, file creation, command exit codes).

### Checking Status

Monitor session progress:

```bash
/ultrawork-status
```

Output shows:

- Current phase (planning, executing, verifying, complete)
- Task completion status (resolved/open/blocked)
- Evidence collected per task
- Time elapsed since session start

### Session Files

Ultrawork stores session data in:

```
~/.claude/ultrawork/sessions/{session-id}/
├── session.json           # Session state (minimal metadata)
├── context.json           # Exploration summary (lightweight index)
├── evidence/              # Evidence files
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
    └── summary.md
```

You can inspect these files to understand session state.

## Core Concepts

### Session Isolation

Each workflow runs in an isolated session with a unique ID. Sessions do not interfere with each other.

Session IDs are UUIDs (e.g., `6bd3e4a0-eb03-429a-a8f0-32b46c2fd285`).

### Evidence-Based Completion

Ultrawork requires proof for every success criterion. Evidence includes:

- Test results with pass/fail counts
- Command output with exit codes
- File paths with creation timestamps
- Build logs with error counts

Claims without evidence are not accepted. For example:

- REJECTED: "Function works correctly"
- ACCEPTED: "npm test: 15/15 passed, exit code 0"

See [Workflow Guide](workflow-guide.md) for evidence collection best practices.

### Execute-Verify Loop

If verification fails, ultrawork retries execution automatically:

```
EXECUTION → VERIFICATION → (fail) → EXECUTION → VERIFICATION → (pass) → COMPLETE
```

Default maximum: 5 iterations. Configure with `--max-iterations`:

```bash
/ultrawork --max-iterations 3 "fix authentication bug"
```

### Task Dependencies

The planner creates a task graph with dependencies. Tasks execute when dependencies resolve:

```
Task 1: Create database schema
Task 2: Implement user model (depends on Task 1)
Task 3: Write unit tests (depends on Task 2)
```

Workers execute tasks in parallel when possible.

## Available Plugins

### ultrawork

Verification-first development with strict evidence requirements. Cross-platform compatible (Windows, MacOS, Linux).

### teamwork

Multi-session collaboration with role-based workers. Enables parallel development across multiple sessions with specialized agents for frontend, backend, DevOps, testing, documentation, security, and review tasks.

## Common Commands

### Ultrawork Commands

```bash
/ultrawork "goal"              # Start new session
/ultrawork --auto "goal"       # Skip plan confirmation
/ultrawork-status              # Check session state
/ultrawork-evidence            # List collected evidence
/ultrawork-exec                # Execute existing plan
/ultrawork-cancel              # Cancel current session
```

### Getting Help

```bash
/ultrawork-help                # Show ultrawork documentation
```

## Next Steps

1. **Explore workflows**: Read [Workflow Guide](workflow-guide.md) for common development patterns
2. **Create plugins**: Learn plugin development in [Plugin Development Guide](plugin-development.md)
3. **Customize behavior**: Modify plugin configurations in `~/.claude/plugins/`

## Troubleshooting

### "Session already active" Error

Cancel the existing session:

```bash
/ultrawork-cancel
```

Then start a new session.

### "Planning failed" Error

Ensure your goal description is specific. Vague goals cause planning failures.

VAGUE: "make the app better"
SPECIFIC: "add password strength validation to user registration"

### Missing Evidence

Verifier requires concrete proof. If verification fails with "missing evidence", check:

1. Tests executed and passed
2. Build completed successfully
3. Files created at expected paths

## Additional Resources

- Repository: https://github.com/mnthe/hardworker-marketplace
- License: MIT
- Plugin structure: See [Plugin Development Guide](plugin-development.md)
