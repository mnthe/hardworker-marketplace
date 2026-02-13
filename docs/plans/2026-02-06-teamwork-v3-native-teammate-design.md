# Teamwork v3: Native Teammate 기반 리라이트

## 1. Overview

### Background

Teamwork v2는 자체 coordination infrastructure를 구축하여 multi-session collaboration을 구현합니다:
- File-based task management (~6 scripts)
- File-based mailbox system (~3 scripts + lib)
- tmux-based swarm worker spawning (~5 scripts)
- mkdir-based file locks + optimistic concurrency control (~2 libs)
- Polling-based monitoring loop
- Wave-based DAG execution + verification

Claude Code 2.1.32-2.1.34에서 도입된 **native teammate API**가 이 인프라의 대부분을 대체합니다.

### Goal

teamwork v3는 Claude native teammate API를 기반으로 전면 리라이트하여:
1. **코드 ~90% 감소**: custom infrastructure 전체 제거
2. **Event-driven 아키텍처**: TeammateIdle/TaskCompleted hooks 활용
3. **의존성 제거**: tmux, file locks, mailbox, wave system 모두 native로 대체
4. **핵심 가치 유지**: task decomposition, role specialization, final verification

### Architecture Decision

- **Task Management**: Native Only (TaskCreate/List/Update/Get)
- **Wave System**: 제거 → Native `addBlockedBy` 기반 dependency resolution
- **Verification**: Wave-level 제거 → Final verification only
- **Breaking Changes**: v2와 비호환. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 필요

### Reference

- [Agent Teams 공식 문서](https://code.claude.com/docs/en/agent-teams)
- Claude Code 2.1.32 (agent teams), 2.1.33 (TeammateIdle/TaskCompleted hooks), 2.1.34 (fix)

---

## Outcome

**Status**: PASS
**Completed**: 2026-02-07

This design was fully implemented as teamwork v3.0.0 → v3.3.3. All v2 infrastructure was removed and replaced with native Claude Code teammate API.

---

## 2. Architecture

### Component Map: v2 → v3

| v2 Component | v3 Replacement | Status |
|---|---|---|
| `task-create/list/get/update/claim/delete.js` (6 scripts) | `TaskCreate/List/Get/Update` (native) | **삭제** |
| `mailbox-send/read/poll.js` (3 scripts) + `mailbox.js` | `SendMessage` (native, auto-delivery) | **삭제** |
| `swarm-spawn/status/stop/merge/sync/monitor.js` (6 scripts) | `Task(team_name)` (native) | **삭제** |
| `worktree-create/remove.js` (2 scripts) | 선택적 유지 (worktree mode) | **조건부 유지** |
| `file-lock.js` + `optimistic-lock.js` (2 libs) | Native task ownership + file locking | **삭제** |
| `mailbox.js` + `swarm-state.js` + `hook-utils.js` (3 libs) | Native messaging | **삭제** |
| `loop-detector.js` + `evidence-capture.js` (2 hooks) | `TeammateIdle` + `TaskCompleted` hooks | **대체** |
| `wave-calculate/status/update.js` (3 scripts) | Native `addBlockedBy` | **삭제** |
| `wave-verifier` agent | 제거 (final-verifier만 유지) | **삭제** |
| `coordinator` agent | 이미 deprecated → 삭제 | **삭제** |
| `worker-setup.js` + `loop-state.js` (2 scripts) | Not needed | **삭제** |

**총 삭제**: ~22 scripts, ~7 libs, ~2 hooks, 2 agents
**유지/수정**: ~3-4 scripts, 2 new hooks, ~10 agents, 3-4 skills

### v3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    /teamwork "goal"                       │
│                           │                               │
│              ┌────────────▼────────────┐                  │
│              │   Orchestrator (Lead)   │                  │
│              │   [delegate mode]       │                  │
│              │                         │                  │
│              │   1. TaskCreate (tasks) │                  │
│              │   2. Task() (spawn      │                  │
│              │      teammates)         │                  │
│              │   3. SendMessage        │                  │
│              │      (coordinate)       │                  │
│              │   4. TaskUpdate         │                  │
│              │      (assign tasks)     │                  │
│              └────────────┬────────────┘                  │
│                           │                               │
│           ┌───────────────┼───────────────┐               │
│           ▼               ▼               ▼               │
│     ┌──────────┐   ┌──────────┐   ┌──────────┐          │
│     │ Worker   │   │ Worker   │   │ Worker   │          │
│     │ backend  │   │ frontend │   │ test     │          │
│     ├──────────┤   ├──────────┤   ├──────────┤          │
│     │TaskList  │   │TaskList  │   │TaskList  │          │
│     │TaskUpdate│   │TaskUpdate│   │TaskUpdate│          │
│     │SendMsg   │   │SendMsg   │   │SendMsg   │          │
│     │Read/Write│   │Read/Write│   │Read/Write│          │
│     └──────────┘   └──────────┘   └──────────┘          │
│                                                          │
│     ┌────────────────────────────────────────┐           │
│     │        Native Infrastructure           │           │
│     │  ┌──────────┐  ┌────────────────┐      │           │
│     │  │Task List │  │Auto Message    │      │           │
│     │  │(shared)  │  │Delivery        │      │           │
│     │  │blockedBy │  │                │      │           │
│     │  │ownership │  │TeammateIdle    │      │           │
│     │  │locking   │  │TaskCompleted   │      │           │
│     │  └──────────┘  └────────────────┘      │           │
│     └────────────────────────────────────────┘           │
│                                                          │
│     ┌────────────────────────────────────────┐           │
│     │     Plugin Hooks (event-driven)         │           │
│     │  ┌──────────────┐ ┌──────────────┐     │           │
│     │  │project-      │ │teammate-     │     │           │
│     │  │progress.js   │ │idle.js       │     │           │
│     │  │(TaskComplete)│ │(TeammateIdle)│     │           │
│     │  └──────────────┘ └──────────────┘     │           │
│     └────────────────────────────────────────┘           │
│                                                          │
│     ┌────────────────────────────────────────┐           │
│     │     Plugin Scripts (minimal)            │           │
│     │  setup-teamwork.js                     │           │
│     │  project-create.js (metadata only)     │           │
│     │  project-status.js (dashboard)         │           │
│     │  project-clean.js  (cleanup)           │           │
│     └────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Native API Usage

### 3.1 Team & Task Management

```python
# 1. Create team
TeamCreate(team_name="auth-system", description="Build authentication")

# 2. Create tasks with dependencies
TaskCreate(
    subject="Setup database schema",
    description="Create PostgreSQL tables for users, sessions, tokens",
    activeForm="Setting up database schema"
)  # → task 1

TaskCreate(
    subject="Implement auth middleware",
    description="JWT-based auth middleware with token validation and refresh",
    activeForm="Implementing auth middleware"
)  # → task 2
TaskUpdate(taskId="2", addBlockedBy=["1"])

TaskCreate(
    subject="Create login/signup UI",
    description="React forms with validation, error handling",
    activeForm="Creating login/signup UI"
)  # → task 3
TaskUpdate(taskId="3", addBlockedBy=["2"])

# 3. Spawn workers as teammates
Task(
    subagent_type="teamwork:backend",
    team_name="auth-system",
    name="worker-backend",
    prompt="You are a backend specialist..."
)

Task(
    subagent_type="teamwork:frontend",
    team_name="auth-system",
    name="worker-frontend",
    prompt="You are a frontend specialist..."
)
```

### 3.2 Worker Workflow (Pure Native)

```python
# Worker checks for available tasks
tasks = TaskList()

# Worker claims task
TaskUpdate(taskId="1", owner="worker-backend", status="in_progress",
           activeForm="Implementing database schema")

# Worker implements...
# ... Read, Write, Edit, Bash ...

# Worker reports evidence in description
TaskUpdate(taskId="1", description="""
(original description)

## Evidence
- Created src/db/schema.ts (85 lines)
- npm run db:migrate: exit code 0
- npm test -- schema.test.ts: 8/8 passed, exit code 0
""")

# Worker marks complete
TaskUpdate(taskId="1", status="completed")

# Worker messages orchestrator
SendMessage(
    type="message",
    recipient="orchestrator",
    content="Task 1 complete. DB schema created and tested.",
    summary="Task 1 completed"
)
```

### 3.3 Orchestrator Coordination

```python
# Orchestrator receives auto-delivered messages
# → TaskCompleted hook fires
# → Hook checks: all tasks done? → outputs context

# If all tasks done → spawn final verifier
Task(
    subagent_type="teamwork:final-verifier",
    team_name="auth-system",
    name="verifier",
    prompt="Verify project completion: run build, tests, check evidence..."
)

# Shutdown teammates when done
SendMessage(type="shutdown_request", recipient="worker-backend",
            content="All tasks complete")
SendMessage(type="shutdown_request", recipient="worker-frontend",
            content="All tasks complete")

# Cleanup
TeamDelete()
```

---

## 4. Hook Design

### 4.1 hooks.json

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
    }]
  }
}
```

### 4.2 project-progress.js (TaskCompleted)

Purpose: Task 완료 시 전체 프로젝트 진행 상황을 orchestrator에게 알림

```javascript
#!/usr/bin/env bun

// Read hook input (exact schema TBD - defensive parsing)
let input = {};
try {
    input = JSON.parse(await Bun.stdin.text());
} catch {
    process.exit(0); // No input, skip
}

// Read project metadata to determine team name
const projectDir = findProjectDir(); // from project metadata
if (!projectDir) process.exit(0);

// Count task states (read from native task directory)
const tasksDir = `${process.env.HOME}/.claude/tasks/${teamName}`;
const tasks = await readTaskFiles(tasksDir);

const total = tasks.length;
const completed = tasks.filter(t => t.status === 'completed').length;
const inProgress = tasks.filter(t => t.status === 'in_progress').length;
const pending = total - completed - inProgress;

if (completed === total) {
    // All tasks done → trigger final verification
    console.log(`All ${total} tasks completed. Ready for final verification.`);
} else {
    // Progress update
    console.log(`Progress: ${completed}/${total} completed, ${inProgress} in progress, ${pending} pending.`);
}
```

### 4.3 teammate-idle.js (TeammateIdle)

Purpose: Teammate가 idle일 때 orchestrator에게 상태 알림

```javascript
#!/usr/bin/env bun

let input = {};
try {
    input = JSON.parse(await Bun.stdin.text());
} catch {
    process.exit(0);
}

const { teammate_name, team_name } = input;

// Check for unassigned, unblocked tasks
const tasksDir = `${process.env.HOME}/.claude/tasks/${team_name}`;
const tasks = await readTaskFiles(tasksDir);

const available = tasks.filter(t =>
    t.status === 'pending' &&
    !t.owner &&
    (!t.blockedBy || t.blockedBy.length === 0 ||
     t.blockedBy.every(dep => tasks.find(d => d.id === dep)?.status === 'completed'))
);

if (available.length > 0) {
    console.log(`${teammate_name} idle. ${available.length} unassigned tasks available.`);
} else {
    console.log(`${teammate_name} idle. No tasks available.`);
}
```

---

## 5. Agent Definitions

### 5.1 Orchestrator (Team Lead)

**Key changes from v2:**
- Native TeamCreate/TaskCreate instead of scripts
- Delegate mode (no code editing)
- SendMessage instead of mailbox scripts
- Task(team_name) instead of swarm-spawn.js
- No wave management

```yaml
---
name: orchestrator
model: opus
color: purple
memory:
  scope: project
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - TeamCreate
  - TeamDelete
  - TaskCreate
  - TaskList
  - TaskUpdate
  - TaskGet
  - SendMessage
  - Task(teamwork:final-verifier)
  - Task(teamwork:worker)
  - Task(teamwork:backend)
  - Task(teamwork:frontend)
  - Task(teamwork:test)
  - Task(teamwork:docs)
  - Task(teamwork:devops)
  - Task(teamwork:security)
  - Task(teamwork:review)
  - Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/project-*.js:*)
  - mcp__plugin_serena_serena__get_symbols_overview
  - mcp__plugin_serena_serena__find_symbol
  - mcp__plugin_serena_serena__search_for_pattern
---
```

### 5.2 Worker (Generic)

```yaml
---
name: worker
model: inherit
color: cyan
memory:
  scope: project
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - TaskList
  - TaskGet
  - TaskUpdate
  - SendMessage
  - mcp__plugin_serena_serena__replace_symbol_body
  - mcp__plugin_serena_serena__insert_after_symbol
  - mcp__plugin_serena_serena__find_symbol
---
```

### 5.3 Final Verifier

```yaml
---
name: final-verifier
model: opus
color: red
tools:
  - Read
  - Bash
  - Glob
  - Grep
  - TaskList
  - TaskGet
  - SendMessage
  - mcp__plugin_playwright_playwright__browser_navigate
  - mcp__plugin_playwright_playwright__browser_snapshot
  - mcp__plugin_playwright_playwright__browser_take_screenshot
---
```

---

## 6. Plugin Structure (v3)

```
plugins/teamwork/
├── .claude-plugin/
│   └── plugin.json              # version: "3.0.0"
├── commands/
│   ├── teamwork.md              # 메인 커맨드 (간소화)
│   ├── teamwork-status.md       # 상태 대시보드
│   ├── teamwork-clean.md        # 프로젝트 정리
│   ├── teamwork-worker.md       # 워커 커맨드 (간소화)
│   └── teamwork-verify.md       # 수동 검증
├── agents/
│   ├── orchestrator/AGENT.md    # Team lead (리라이트)
│   ├── final-verifier/AGENT.md  # Final verification (수정)
│   ├── worker/AGENT.md          # Generic worker (리라이트)
│   ├── backend/AGENT.md         # Role workers (리라이트)
│   ├── frontend/AGENT.md
│   ├── test/AGENT.md
│   ├── devops/AGENT.md
│   ├── docs/AGENT.md
│   ├── security/AGENT.md
│   └── review/AGENT.md
├── skills/
│   ├── task-decomposition/SKILL.md  # 유지 (minor updates)
│   ├── worker-workflow/SKILL.md     # 리라이트 (native API)
│   ├── event-coordination/SKILL.md  # NEW (replaces monitoring-loop)
│   └── teamwork-clean/SKILL.md     # 수정
├── hooks/
│   └── hooks.json                   # TeammateIdle, TaskCompleted
├── src/
│   ├── hooks/
│   │   ├── project-progress.js      # TaskCompleted handler
│   │   └── teammate-idle.js         # TeammateIdle handler
│   ├── scripts/
│   │   ├── setup-teamwork.js        # 환경변수 체크, project metadata
│   │   ├── project-create.js        # 경량 metadata
│   │   ├── project-status.js        # Dashboard (native TaskList 기반)
│   │   └── project-clean.js         # TeamDelete + cleanup
│   └── lib/
│       ├── args.js                  # 유지
│       ├── types.js                 # 업데이트
│       └── blocked-patterns.js      # 유지
├── CLAUDE.md                        # 전면 리라이트
└── README.md                        # 전면 리라이트
```

### 삭제 대상 (v2 파일)

```
DELETE (scripts - 18 files):
  task-create.js, task-list.js, task-get.js, task-update.js,
  task-claim.js, task-delete.js,
  mailbox-send.js, mailbox-read.js, mailbox-poll.js,
  swarm-spawn.js, swarm-status.js, swarm-stop.js,
  swarm-merge.js, swarm-sync.js, swarm-monitor.js,
  worktree-create.js, worktree-remove.js,
  worker-setup.js, loop-state.js

DELETE (libs - 5 files):
  file-lock.js, optimistic-lock.js, mailbox.js,
  swarm-state.js, hook-utils.js

DELETE (hooks - 2 files):
  loop-detector.js, evidence-capture.js

DELETE (agents - 2 dirs):
  coordinator/AGENT.md, wave-verifier/AGENT.md

DELETE (skills - 3 dirs):
  swarm-workflow/, scripts-path-usage/, utility-scripts/

DELETE (tests - most files):
  All existing tests (new tests needed)
```

---

## 7. Execution Summary

### Phase 1: Hook Foundation
1. `hooks/hooks.json` 작성 완료 (TeammateIdle, TaskCompleted events)
2. `src/hooks/project-progress.js` 구현 완료
3. `src/hooks/teammate-idle.js` 구현 완료

### Phase 2: Scripts (Minimal)
4. `src/scripts/setup-teamwork.js` 수정 완료 (AGENT_TEAMS env 체크)
5. `src/scripts/project-create.js` 경량화 완료
6. `src/scripts/project-status.js` 수정 완료 (native TaskList 기반)
7. `src/scripts/project-clean.js` 수정 완료 (TeamDelete 통합)

### Phase 3: Agent Rewrite
8. `agents/orchestrator/AGENT.md` 리라이트 완료 (team lead 패턴)
9. `agents/worker/AGENT.md` 리라이트 완료 (pure native API)
10. `agents/final-verifier/AGENT.md` 수정 완료
11. Role-specific agents (backend, frontend, test, docs, devops, security, review) 리라이트 완료

### Phase 4: Command & Skill Rewrite
12. `commands/teamwork.md` 리라이트 완료
13. `commands/teamwork-worker.md` 리라이트 완료
14. `commands/teamwork-status.md` 수정 완료
15. `skills/worker-workflow/SKILL.md` 리라이트 완료 (native API)
16. `skills/event-coordination/SKILL.md` 신규 작성 완료 (replaces monitoring-loop)

### Phase 5: Cleanup & Documentation
17. v2 코드 삭제 완료 (위 삭제 목록)
18. `CLAUDE.md` 전면 리라이트 완료
19. `plugin.json` version → 3.0.0 업데이트 완료
20. `README.md` 업데이트 완료

### Phase 6: Verification
21. Hook event 동작 테스트 완료
22. Team lifecycle 전체 테스트 완료 (create → tasks → workers → verify → cleanup)

---

## 8. Trade-offs

| 항목 | Gain | Cost |
|---|---|---|
| 코드 ~90% 삭제 | 유지보수 대폭 감소 | 새 코드 학습 |
| tmux 의존성 제거 | 설치 요구사항 감소 | split-pane은 native 설정에 위임 |
| Wave 시스템 제거 | 복잡도 대폭 감소 | 중간 검증 포인트 상실 |
| Native task locking | file lock 코드 제거 | "task status lag" 가능성 |
| Event-driven hooks | polling loop 제거 | hook input format undocumented |
| Agent memory | 세션 간 학습 | 실험적 기능 |
| **가장 큰 risk** | — | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (실험적) |

---

## 9. Limitations & Mitigations

| 제한사항 | 영향 | 대응 |
|----------|------|------|
| 실험 기능 의존 | 기능 비활성화 가능 | env 체크 + 에러 메시지 |
| 세션 재개 불가 | teammate 유실 | project metadata로 상태 복원 가능 |
| One team per session | 동시 다중 프로젝트 불가 | 한 세션 = 한 프로젝트 |
| No nested teams | worker 제한 | worker는 단일 task 집중 |
| Task status lag | task 완료 누락 | hook + 수동 체크 이중화 |
| Hook format undocumented | schema 불일치 | defensive parsing + 로깅 |
| Wave 제거 | 중간 검증 없음 | final verification 강화 |
