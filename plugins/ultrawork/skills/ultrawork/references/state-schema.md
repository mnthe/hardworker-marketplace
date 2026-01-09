# Ultrawork State Schema

## Directory Structure

```
~/.claude/ultrawork/{team-name}/sessions/{session-id}/
├── session.json        # Session metadata (JSON)
├── context.json        # Explorer summaries (JSON)
├── design.md           # Design document (Markdown)
├── exploration/        # Detailed exploration (Markdown)
│   ├── overview.md     # Project overview (always first)
│   ├── exp-1.md        # Targeted exploration
│   └── exp-N.md        # (dynamic count based on goal)
└── tasks/              # Task files (JSON)
    ├── 1.json
    ├── 2.json
    └── verify.json
```

Team name derived from git repo root folder name.

## context.json Schema (v2.1)

```json
{
  "version": "2.1",
  "expected_explorers": ["overview", "exp-1", "exp-2"],
  "exploration_complete": false,
  "explorers": [
    {
      "id": "overview",
      "hint": "Project overview",
      "file": "exploration/overview.md",
      "summary": "..."
    }
  ],
  "key_files": ["src/index.ts", "package.json"],
  "patterns": ["auth", "api-routes"],
  "constraints": []
}
```

| Field | Description |
|-------|-------------|
| `expected_explorers` | IDs of explorers that should complete |
| `exploration_complete` | Auto-set to true when all expected explorers finish |
| `explorers` | Completed explorer summaries with links to markdown |
| `key_files` | Important files discovered during exploration |
| `patterns` | Code patterns identified |

## session.json Schema (v5.1)

```json
{
  "version": "5.1",
  "exploration_stage": "not_started",
  "session_task_id": "42",
  "goal": "Original user request",
  "phase": "PLANNING",
  "started_at": "2026-01-08T12:00:00Z",
  "updated_at": "2026-01-08T12:30:00Z",

  "planner": {
    "agent_id": "task-abc123",
    "status": "running",
    "started_at": "2026-01-08T12:00:05Z",
    "completed_at": null
  },

  "child_tasks": [
    {
      "id": "1",
      "subject": "Setup database",
      "status": "resolved",
      "worker_agent_id": "task-def456",
      "success_criteria": [
        "Migration runs without error",
        "Schema validates"
      ],
      "evidence": [
        {
          "criteria": "Migration runs without error",
          "command": "npx prisma migrate deploy",
          "output": "All migrations applied successfully",
          "verified": true,
          "timestamp": "2026-01-08T12:15:00Z"
        }
      ],
      "blocked_by": [],
      "started_at": "2026-01-08T12:05:00Z",
      "completed_at": "2026-01-08T12:15:00Z"
    }
  ],

  "evidence_log": [
    {
      "task_id": "1",
      "criteria": "Migration runs without error",
      "type": "command_output",
      "content": "All migrations applied successfully",
      "timestamp": "2026-01-08T12:15:00Z"
    }
  ],

  "verify_task_id": "5",

  "completed_at": null,
  "cancelled_at": null,
  "failure_reason": null
}
```

## Phase Values

| Phase | Description |
|-------|-------------|
| `EXPLORATION` | Explorer agents gathering context |
| `PLANNING` | Design and task decomposition |
| `EXECUTION` | Workers executing tasks |
| `VERIFICATION` | Verify task running |
| `COMPLETE` | All criteria met |
| `FAILED` | Unrecoverable failure |
| `CANCELLED` | User cancelled |

## Exploration Stage Values

| Stage | Description |
|-------|-------------|
| `not_started` | Exploration not begun |
| `overview` | Overview explorer running |
| `analyzing` | Analyzing overview, generating hints |
| `targeted` | Targeted explorers running |
| `complete` | All exploration finished |

## Task Status Values

| Status | Description |
|--------|-------------|
| `open` | Ready to start |
| `in_progress` | Worker assigned |
| `resolved` | Completed with evidence |
| `failed` | Could not complete |

## Evidence Types

| Type | Description |
|------|-------------|
| `command_output` | Shell command result |
| `test_result` | Test suite output |
| `api_response` | HTTP response |
| `file_content` | File diff or content |
| `screenshot` | Visual verification |
| `manual` | User-provided evidence |

## State Transitions

```
EXPLORATION → PLANNING    (explorers complete)
PLANNING → EXECUTION      (planner completes)
EXECUTION → VERIFICATION  (all impl tasks done)
VERIFICATION → COMPLETE   (verify passes)

Any → FAILED              (unrecoverable error)
Any → CANCELLED           (user cancels)
```
