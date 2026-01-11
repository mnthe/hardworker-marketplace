# Knowledge Extraction Plugin

Collect insights from Claude sessions and extract them into reusable components (Skills, Commands, Agents, CLAUDE.md).

## Overview

This plugin automatically captures valuable insights generated during Claude sessions and converts them into permanent, reusable knowledge. When Claude generates `★ Insight` markers or discovers useful patterns, they're saved to session files and can later be extracted into appropriate components.

## Features

- **Automatic Collection**: Captures insights using the `★ Insight` format
- **Session Isolation**: Each session's insights stored separately
- **Smart Classification**: Categorizes insights by type (code-pattern, workflow, debugging, etc.)
- **Threshold Alerts**: Notifies when insight count reaches configurable threshold
- **Multi-target Extraction**: Converts insights to Skills, Commands, Agents, or CLAUDE.md

## Installation

### From Marketplace

```bash
claude plugin install hardworker-marketplace/knowledge-extraction
```

### Local Development

```bash
claude --plugin-dir /path/to/knowledge-extraction
```

## Usage

### Automatic Collection

When using Claude in explanatory mode, insights are automatically saved:

```
★ Insight ─────────────────────────────────────
JWT tokens should include minimal claims. Store sensitive data server-side.
─────────────────────────────────────────────────
```

The skill saves these to `.claude/knowledge-extraction/sessions/{session-id}.md`.

### Commands

| Command | Description |
|---------|-------------|
| `/insights` | View current session's insights |
| `/insights extract` | Extract insights to reusable components |
| `/insights clear` | Clear current session's insights |
| `/insights all` | View all sessions' insights |

### Extraction Workflow

1. Insights are collected during normal Claude usage
2. When threshold reached (default: 5), hook recommends extraction
3. Run `/insights extract` to launch the extractor agent
4. Agent analyzes and proposes extraction targets
5. Approve proposals to create components
6. Session file is cleaned up after extraction

## Components

### Skill: insight-awareness

Guides Claude to recognize and save insights. Triggers when:
- Generating `★ Insight` markers
- Discovering code patterns
- Finding debugging solutions
- Making architectural decisions

### Command: /insights

User-facing command for managing insights.

### Agent: insight-extractor

Autonomous agent that:
- Analyzes collected insights
- Classifies by type and extraction target
- Proposes component creation
- Executes approved extractions

### Hooks

- **Stop Hook**: Reminds about insights at session end
- **PostToolUse Hook**: Notifies when threshold reached

## Configuration

Create `.claude/knowledge-extraction/config.local.md` to customize:

```yaml
---
threshold: 5
auto_recommend: true
output_dir: ".claude"
---

# Knowledge Extraction Configuration

Customize insight collection and extraction behavior.
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `threshold` | 5 | Insights before recommending extraction |
| `auto_recommend` | true | Show extraction recommendations |
| `output_dir` | ".claude" | Where to create extracted components |

## Storage

Insights are stored at:

```
.claude/knowledge-extraction/
├── config.local.md              # Configuration (optional)
└── sessions/
    └── {session-id}.md          # Per-session insights
```

### Insight Format

```markdown
## 2026-01-11T22:10:30+09:00

- **Type**: code-pattern
- **Context**: TypeScript, React hooks
- **Content**:
  When managing complex form state, prefer useReducer over multiple useState.
```

## Extraction Targets

| Insight Type | Primary Target | Criteria |
|--------------|----------------|----------|
| `code-pattern` | Skill | Reusable patterns across projects |
| `workflow` | Command | Automatable step-by-step procedures |
| `debugging` | Skill | Troubleshooting techniques |
| `architecture` | CLAUDE.md | Project-specific decisions |
| `tool-usage` | Skill | Effective tool combinations |

## Requirements

- Claude Code CLI
- Node.js (for hooks)

## License

MIT
