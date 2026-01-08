# Ultrawork State Schema

## Directory Structure

```
~/.claude/ultrawork/{team-name}/sessions/{session-id}/
├── session.json        # Session metadata (JSON)
├── context.json        # Explorer summaries (JSON)
├── design.md           # Design document (Markdown)
├── exploration/        # Detailed exploration (Markdown)
│   ├── exp-1.md
│   ├── exp-2.md
│   └── exp-3.md
└── tasks/              # Task files (JSON)
    ├── 1.json
    ├── 2.json
    └── verify.json
```

Team name derived from git repo root folder name.

## Schema

```json
{
  "version": "1.0",
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
| `PLANNING` | Planner agent running |
| `EXECUTION` | Workers executing tasks |
| `VERIFICATION` | Verify task running |
| `COMPLETE` | All criteria met |
| `FAILED` | Unrecoverable failure |
| `CANCELLED` | User cancelled |

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
PLANNING → EXECUTION    (planner completes)
EXECUTION → VERIFICATION (all impl tasks done)
VERIFICATION → COMPLETE (verify passes)

Any → FAILED          (unrecoverable error)
Any → CANCELLED       (user cancels)
```
