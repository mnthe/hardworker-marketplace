# ultrawork

Strict verification-first development mode for Claude Code.

## Features

- Session isolation with unique IDs
- Mandatory planning with success criteria
- Evidence-based completion (no "should work" claims)
- Execute→Verify loop (ralph-loop style auto-retry)
- Zero tolerance for partial implementation

## Installation

```bash
claude plugin marketplace add mnthe/hardworker-marketplace
claude plugin install ultrawork@hardworker-marketplace
```

## Usage

```bash
# Start ultrawork session
/ultrawork "implement user authentication"

# With limited retry iterations
/ultrawork --max-iterations 3 "add unit tests"

# Auto mode (no confirmation prompts)
/ultrawork --auto "fix login bug"

# Check status
/ultrawork-status

# View collected evidence
/ultrawork-evidence

# Execute existing plan
/ultrawork-exec

# Cancel session
/ultrawork-cancel
```

## Commands

| Command | Description |
|---------|-------------|
| `/ultrawork "goal"` | Start new session |
| `/ultrawork-status` | Check current session state |
| `/ultrawork-evidence` | List collected evidence |
| `/ultrawork-exec` | Execute plan document |
| `/ultrawork-plan` | Plan interactively |
| `/ultrawork-cancel` | Cancel session |
| `/ultrawork-help` | Show help |

## Options

| Option | Description |
|--------|-------------|
| `--auto` | Skip plan confirmation |
| `--max-workers N` | Limit concurrent workers |
| `--max-iterations N` | Max execute→verify loops (default: 5) |
| `--skip-verify` | Skip verification phase |
| `--plan-only` | Stop after planning |

## Agents

- **planner** - Creates task graph with dependencies
- **explorer** - Gathers codebase context
- **worker** - Executes individual tasks
- **reviewer** - Reviews implementation quality
- **verifier** - Validates all criteria met

## How It Works

```
PLANNING → EXECUTION → VERIFICATION ──→ COMPLETE
               ↑            │
               └────────────┘
            (retry on failure)
```

1. **Planning**: Planner creates task graph with success criteria
2. **Execution**: Workers implement tasks in parallel
3. **Verification**: Verifier checks all criteria with evidence
4. **Retry Loop**: If verification fails, auto-retry up to max_iterations
5. **Complete**: All criteria met with evidence

## License

MIT
