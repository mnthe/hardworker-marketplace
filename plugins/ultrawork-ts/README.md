# ultrawork-ts

Cross-platform TypeScript/Node.js version of the ultrawork plugin for Claude Code.

## Features

- Session isolation with unique IDs
- Mandatory planning with success criteria
- Evidence-based completion (no "should work" claims)
- Execute→Verify loop (ralph-loop style auto-retry)
- Zero tolerance for partial implementation
- **Cross-platform**: Works on Windows, MacOS, and Linux

## Installation

```bash
claude plugin marketplace add mnthe/hardworker-marketplace
claude plugin install ultrawork-ts@hardworker-marketplace
```

## Usage

Same as the bash version:

```bash
/ultrawork "implement user authentication"
/ultrawork --auto "fix login bug"
/ultrawork-status
/ultrawork-cancel
```

## Requirements

- Node.js 18+ (bundled with Claude Code)
- No external dependencies

## License

MIT
