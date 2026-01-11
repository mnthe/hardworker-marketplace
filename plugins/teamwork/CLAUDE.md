# teamwork

Multi-session collaboration plugin with role-based workers.

## File Structure

### Library Files
- src/lib/types.js - JSDoc type definitions (@typedef)
- src/lib/file-lock.js - Cross-platform file locking
- src/lib/project-utils.js - Project and task path utilities

### Scripts (10 total)
1. src/scripts/project-create.js - Create new teamwork project
2. src/scripts/project-get.js - Get project metadata
3. src/scripts/task-create.js - Create new task
4. src/scripts/task-get.js - Get single task details
5. src/scripts/task-list.js - List all tasks in project
6. src/scripts/task-claim.js - Atomically claim a task
7. src/scripts/task-update.js - Update task status/evidence
8. src/scripts/loop-state.js - Manage worker loop state
9. src/scripts/setup-teamwork.js - Initialize teamwork environment
10. src/scripts/worker-setup.js - Setup worker session context

### Hooks (1 total)
1. src/hooks/loop-detector.js - Detects __TEAMWORK_CONTINUE__ marker and triggers next worker iteration

### Agents (9 total)
1. agents/coordinator/AGENT.md - Main orchestration agent (planning phase)
2. agents/worker/AGENT.md - General purpose worker
3. agents/frontend/AGENT.md - Frontend development specialist
4. agents/backend/AGENT.md - Backend development specialist
5. agents/devops/AGENT.md - DevOps and infrastructure specialist
6. agents/test/AGENT.md - Testing specialist
7. agents/docs/AGENT.md - Documentation specialist
8. agents/security/AGENT.md - Security specialist
9. agents/review/AGENT.md - Code review specialist

## No Build Step Required

Scripts run directly from source. No compilation needed.

## Hook Configuration

**IMPORTANT**: hooks.json must use explicit `bun` prefix for cross-platform compatibility.

```json
// WRONG - shebang doesn't work on Windows
"command": "${CLAUDE_PLUGIN_ROOT}/src/hooks/loop-detector.js"

// CORRECT - explicit bun invocation
"command": "bun ${CLAUDE_PLUGIN_ROOT}/src/hooks/loop-detector.js"
```

Active hooks:
- Stop event: loop-detector.js (detects __TEAMWORK_CONTINUE__ marker)

## Multi-Session Coordination

### Shared State Management
- Tasks stored in `~/.claude/teamwork/{project}/{team}/tasks/{id}.json`
- Project state in `~/.claude/teamwork/{project}/{team}/project.json`
- Loop state per terminal in `~/.claude/teamwork/.loop-state/{terminal_id}.json`

### Concurrency Safety
- Workers must claim tasks atomically (file-based locking)
- Task status updates must be atomic operations
- Multiple workers can run in parallel without conflicts

### Worker Coordination
- Each worker runs in separate terminal/session
- Workers claim tasks based on role matching
- Workers communicate through shared task files
- Coordinator monitors progress through task status

## Development Rules

### Document Synchronization

**When modifying teamwork commands or agents, you MUST check and update the following files:**

| File                   | Location                      | Role                                                |
| ---------------------- | ----------------------------- | --------------------------------------------------- |
| `teamwork.md`          | `commands/teamwork.md`        | Coordination command (planning phase)               |
| `teamwork-worker.md`   | `commands/teamwork-worker.md` | Worker command (execution phase)                    |
| `teamwork-status.md`   | `commands/teamwork-status.md` | Status dashboard command                            |
| `coordinator/AGENT.md` | `agents/coordinator/AGENT.md` | Main orchestration agent                            |
| `worker/AGENT.md`      | `agents/worker/AGENT.md`      | General purpose worker agent                        |
| Role agents            | `agents/{role}/AGENT.md`      | Specialized worker agents (frontend, backend, etc.) |

### Task File Format

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "role": "frontend|backend|devops|test|docs|security|review|worker",
  "status": "open|in_progress|resolved",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "claimed_by": "session_id or null",
  "claimed_at": "ISO8601 or null (optional)",
  "completed_at": "ISO8601 (optional, set when status=resolved)",
  "evidence": ["string array"]
}
```

### Project State Format

File: `~/.claude/teamwork/{project}/{team}/project.json`

```json
{
  "project": "string",
  "team": "string",
  "goal": "string",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "stats": {
    "total": 0,
    "open": 0,
    "in_progress": 0,
    "resolved": 0
  }
}
```

### Loop State Format

File: `~/.claude/teamwork/.loop-state/{terminal_id}.json`

```json
{
  "pid": 12345,
  "project": "string",
  "team": "string",
  "role": "string or null",
  "started_at": "ISO8601",
  "updated_at": "ISO8601",
  "iterations": 0,
  "tasks_completed": 0
}
```
