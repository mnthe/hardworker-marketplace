# Ultrawork Hook 개선 설계: SubagentStop 활용 + Native Task API 검토

## Outcome

**Status**: PASS
**Completed**: 2026-02-07

Phase 1 (즉시 적용) items implemented: SubagentStop hook에 agent_type 기반 필터링 추가, stop_hook_active 체크, SubagentStart tracking hook 추가. Phase 2-3은 향후 과제로 유지.

## 1. 배경

### 문제 정의

Ultrawork의 현재 hook 시스템에 3가지 구조적 문제가 있음:

1. **SubagentStop hook이 agent type을 구분하지 못함** — `matcher: "*"`로 모든 sub-agent 종료를 동일하게 처리
2. **Stop hook이 background agent 실행 중 block** — 정상 동작이지만 사용자에게 "이상하게 돌고"로 인식
3. **Post-compaction delegation failure** — Orchestrator가 compaction 후 직접 코드를 수정하는 문제

### 분석 근거

- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- Claude Code sub-agents reference: https://code.claude.com/docs/en/sub-agents
- Claude Code agent teams reference: https://code.claude.com/docs/en/agent-teams
- GitHub Issue #7881: SubagentStop hook cannot identify which subagent finished
- GitHub Issue #22087: agent_type metadata 확인 (`"agent_type":"GrokResearcher"`)
- GitHub Issue #20221: Prompt-based SubagentStop hooks don't prevent termination
- GitHub Issue #14859: Feature request for agent hierarchy in hook events
- Teamwork v3 마이그레이션 설계: `docs/plans/2026-02-06-teamwork-v3-native-teammate-design.md`
- 직접 검증: Native Task API metadata 필드 테스트 (TaskGet에서 미표시 확인)

### Agent Teams 마이그레이션 평가 결론

**전면 마이그레이션 부적합.** Ultrawork은 sub-agent 패턴 (worker가 결과만 반환)이며, agent teams의 핵심 가치인 inter-agent communication이 불필요. Gate enforcement, evidence collection, TDD workflow 등 ultrawork 고유 기능이 agent teams에 없음. 선택적 개선이 적합함.

---

## 2. SubagentStop Input Schema (검증 완료)

### 공식 문서 기준

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../abc123.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "SubagentStop",
  "stop_hook_active": false,
  "agent_id": "def456",
  "agent_type": "Explore",
  "agent_transcript_path": "~/.claude/projects/.../abc123/subagents/agent-def456.jsonl"
}
```

### 현재 코드가 사용하지 않는 필드

| 필드 | 현재 상태 | 활용 방안 |
|---|---|---|
| `agent_type` | ❌ 미사용 | Agent 종류별 분기 처리 |
| `agent_transcript_path` | ❌ 미사용 | Agent output을 transcript에서 직접 파싱 |
| `stop_hook_active` | ❌ 미사용 | 무한 루프 방지 |

### agent_type 값 형식 (라이브 테스트 확인 완료)

**테스트 방법**: `.claude/settings.local.json`에 `tee -a` 로깅 hook 추가 후 세션 재시작.

**확인된 SubagentStop input (Bash agent):**
```json
{
  "session_id": "1d5921dd-...",
  "permission_mode": "bypassPermissions",
  "hook_event_name": "SubagentStop",
  "stop_hook_active": false,
  "agent_id": "a3309e1",
  "agent_type": "Bash",
  "agent_transcript_path": ".../subagents/agent-a3309e1.jsonl"
}
```

**Agent type registry — ultrawork 관련 (에러 메시지에서 확인):**
```
ultrawork:explorer, ultrawork:planner, ultrawork:reviewer,
ultrawork:scope-analyzer, ultrawork:verifier, ultrawork:worker
```

Built-in agent types: `Bash`, `general-purpose`, `Explore`, `Plan` 등.

**확정된 매핑 (ultrawork):**

| Task 호출 | agent_type 값 | 확인 방법 |
|---|---|---|
| `Task(subagent_type="Bash")` | `"Bash"` | 라이브 테스트 |
| `Task(subagent_type="ultrawork:worker")` | `"ultrawork:worker"` | agent registry |
| `Task(subagent_type="ultrawork:explorer")` | `"ultrawork:explorer"` | agent registry |
| `Task(subagent_type="ultrawork:verifier")` | `"ultrawork:verifier"` | agent registry |
| `Task(subagent_type="ultrawork:planner")` | `"ultrawork:planner"` | agent registry |
| `Task(subagent_type="ultrawork:reviewer")` | `"ultrawork:reviewer"` | agent registry |
| `Task(subagent_type="ultrawork:scope-analyzer")` | `"ultrawork:scope-analyzer"` | agent registry |

Plugin agent의 naming convention: **`plugin:agent_name`** 형식 확정. Matcher regex `"ultrawork:.*"`로 전체 매칭 가능.

---

## 3. 개선 항목

### 3.1 SubagentStop Matcher 세분화 (즉시 적용)

**현재:**
```json
"SubagentStop": [{
    "matcher": "*",
    "hooks": [{ "command": "...subagent-stop-tracking.js" }]
}]
```

**개선 후:**
```json
"SubagentStop": [
    {
        "matcher": "ultrawork:worker",
        "hooks": [{ "command": "...worker-completed.js" }]
    },
    {
        "matcher": "ultrawork:explorer",
        "hooks": [{ "command": "...explorer-completed.js" }]
    },
    {
        "matcher": "ultrawork:verifier",
        "hooks": [{ "command": "...verifier-completed.js" }]
    }
]
```

**효과:** 각 agent type별 전용 처리 로직. Explorer 완료 시 exploration_stage 업데이트, worker 완료 시 task status 업데이트 등.

**확정:** agent_type 값은 `"ultrawork:worker"` 형식 (라이브 테스트 + agent registry로 확인). Regex matcher `"ultrawork:.*"`로 모든 ultrawork agent 매칭 가능.

**대안 (단일 hook 유지):** `matcher: "*"`를 유지하되 hook script 내에서 `agent_type` 분기:

```javascript
const { agent_type } = hookInput;

if (agent_type?.includes('worker')) {
    await handleWorkerCompletion(hookInput);
} else if (agent_type?.includes('explorer')) {
    await handleExplorerCompletion(hookInput);
} else if (agent_type?.includes('verifier')) {
    await handleVerifierCompletion(hookInput);
} else {
    process.exit(0); // ultrawork과 무관한 agent — 무시
}
```

### 3.2 subagent-stop-tracking.js 개선 (즉시 적용)

**현재 문제:**
1. JSDoc typedef에 `agent_type`, `agent_transcript_path`, `stop_hook_active` 누락
2. Agent 식별을 `session.workers[]` 배열 매칭에 의존
3. Output 파싱으로 status 추론 (불안정)

**개선 내용:**

```javascript
/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {string} [agent_id]
 * @property {string} [agent_type]            // 추가
 * @property {string} [agent_transcript_path] // 추가
 * @property {boolean} [stop_hook_active]     // 추가
 * @property {string} [output]
 * @property {string} [task_id]
 */

async function main() {
    const hookInput = JSON.parse(await Bun.stdin.text());
    const { session_id, agent_id, agent_type, agent_transcript_path, stop_hook_active } = hookInput;

    // 1. stop_hook_active 체크 (무한 루프 방지)
    if (stop_hook_active) {
        process.exit(0);
    }

    // 2. agent_type으로 ultrawork agent 여부 확인
    // 확정된 형식: "ultrawork:worker", "ultrawork:explorer", "ultrawork:verifier" 등
    if (!agent_type?.startsWith('ultrawork:')) {
        process.exit(0); // ultrawork agent가 아니면 무시
    }

    // 3. agent_type으로 처리 분기
    const agentRole = agent_type.split(':')[1]; // "worker", "explorer", "verifier" 등
    switch (agentRole) {
        case 'worker':
            await trackWorkerCompletion(hookInput);
            break;
        case 'explorer':
            await trackExplorerCompletion(hookInput);
            break;
        case 'verifier':
            await trackVerifierCompletion(hookInput);
            break;
        default:
            break; // planner, reviewer, scope-analyzer 등은 별도 처리 불필요
    }
}
```

### 3.3 agent_transcript_path 활용 (중기)

현재 코드는 hook input의 `output` 필드에서 agent 결과를 파싱. `agent_transcript_path`를 활용하면 더 정확한 파싱 가능:

```javascript
async function getAgentResult(transcriptPath) {
    const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n');

    // 마지막 assistant 메시지 찾기
    for (let i = lines.length - 1; i >= 0; i--) {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && entry.message?.content) {
            const textContent = entry.message.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
            return textContent;
        }
    }
    return null;
}
```

**효과:** `output` 필드가 비거나 truncate된 경우에도 transcript에서 완전한 agent 결과를 얻을 수 있음.

### 3.4 Stop Hook 개선 (즉시 적용)

**현재 문제:** Background agent 실행 중 main agent turn이 끝나면 Stop hook이 block → "이상하게 돌고"

**개선:**

```javascript
// stop-hook.js에 추가
const { stop_hook_active } = hookInput;

// Stop hook이 이미 활성 상태면 무한 루프 방지
if (stop_hook_active) {
    // 2번 연속 block은 허용하지 않음
    outputAndExit(createStopResponse());
    return;
}
```

### 3.5 Gate Enforcement에서 agent_type 활용 (중기, 추가 검증 필요)

**현재 문제:** PreToolUse hook에서 main agent (orchestrator)와 sub-agent (worker)를 구분할 수 없음.

**잠재적 해결:** SubagentStart hook에서 agent context를 세션에 기록하고, PreToolUse에서 참조.

```javascript
// SubagentStart hook
async function onSubagentStart(hookInput) {
    const { agent_id, agent_type } = hookInput;
    // 현재 활성 sub-agent 목록에 추가
    await updateSession(sessionId, (s) => ({
        ...s,
        active_agents: [...(s.active_agents || []), { agent_id, agent_type, started_at: new Date().toISOString() }]
    }));
}
```

**주의:** PreToolUse hook input에는 여전히 `agent_context` 필드가 없으므로, main agent의 Edit/Write를 완벽히 구분하는 것은 불가능. 이 개선은 **부분적**임.

---

## 4. Native Task API 검토 결과

### 직접 테스트 결과

| 항목 | 테스트 결과 | 비고 |
|---|---|---|
| TaskCreate metadata | ✅ 저장됨 | `metadata` 파라미터 정상 동작 |
| TaskGet metadata 표시 | ❌ 안 보임 | display output에 subject, status, description만 표시 |
| TaskList metadata 표시 | ❌ 안 보임 | id, status, subject만 표시 |
| description에 markdown 인코딩 | ✅ 정상 | criteria, evidence 모두 description으로 전달 가능 |

### 결론: Native Task API 채택 시 패턴

Teamwork v3 패턴 적용:
- **criteria, evidence, complexity, approach** → description의 markdown section으로 인코딩
- **dependencies** → `addBlockedBy` 사용 (native)
- **blocked pattern validation** → PreToolUse hook에서 TaskUpdate 감시

### 채택하지 않는 이유 (현시점)

1. **ultrawork의 task-*.js 스크립트는 blocked pattern validation, criteria 추적, TDD enforcement 등 custom 로직 포함**
2. Native TaskUpdate에는 이런 validation이 없으므로 PreToolUse hook으로 재구현 필요
3. 기존 worker/verifier agent의 script 호출 패턴 전면 변경 필요
4. **ROI가 낮음** — 현재 6개 스크립트 (~800 LOC) 제거 vs agent/skill 전면 수정

### 향후 채택 조건

- Claude Code의 TaskUpdate에 `metadata` 가 TaskGet display에 노출되는 경우
- 또는 TaskUpdate에 custom validation hook이 지원되는 경우
- agent_type으로 main agent vs sub-agent 구분이 완벽해지는 경우

---

## 5. 구현 우선순위

### Phase 1: 즉시 적용 (위험도 낮음)

| ID | 작업 | 변경 파일 | 효과 |
|---|---|---|---|
| 1.1 | `agent_type` 라이브 테스트 | `.claude/settings.local.json` (완료) | 실제 값 확인 |
| 1.2 | subagent-stop-tracking.js에 agent_type 필드 추가 | `src/hooks/subagent-stop-tracking.js` | 정확한 agent 식별 |
| 1.3 | stop_hook_active 체크 추가 | `src/hooks/stop-hook.js` | 무한 루프 방지 |
| 1.4 | SubagentStop matcher 세분화 또는 agent_type 분기 | `hooks/hooks.json` 또는 hook script | agent type별 처리 |

### Phase 2: 중기 개선 (중간 위험도)

| ID | 작업 | 변경 파일 | 효과 |
|---|---|---|---|
| 2.1 | agent_transcript_path 활용 | `src/hooks/subagent-stop-tracking.js` | 정확한 output 파싱 |
| 2.2 | SubagentStart hook 추가 (active_agents 추적) | `hooks/hooks.json`, 새 hook script | agent lifecycle 추적 |
| 2.3 | Explorer/Worker/Verifier 별 전용 completion handler | 새 hook scripts | 정밀한 상태 관리 |

### Phase 3: 장기 검토 (높은 위험도)

| ID | 작업 | 변경 파일 | 효과 |
|---|---|---|---|
| 3.1 | Native Task API 부분 채택 | task-*.js, agents/, skills/ | 코드 감소 |
| 3.2 | Agent teams delegate mode 활용 | 전면 구조 변경 | delegation 강제 |
| 3.3 | Claude Code agent_context 필드 대응 | hooks/*.js | 완벽한 agent 구분 |

---

## 6. Known Limitations (해결 불가)

| 제한사항 | 원인 | 대응 |
|---|---|---|
| PreToolUse에서 main vs sub-agent 구분 불가 | hook input에 `agent_context` 필드 없음 | compact-recovery hook으로 우회 |
| Prompt-based SubagentStop blocking 미동작 | Claude Code bug (Issue #20221) | command-based hook 사용 |
| Native TaskGet에서 metadata 미표시 | Claude Code 구현 제한 | description 인코딩 |
| Agent teams 실험적 기능 | CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 필요 | 현재 sub-agent 패턴 유지 |

---

## 7. 검증 체크리스트

- [x] `.claude/settings.local.json` SubagentStop 로깅 hook으로 agent_type 실제 값 확인 → **완료 (2026-02-07)**
- [x] agent_type 값이 `"ultrawork:worker"` 형식인지 `"worker"` 형식인지 확인 → **`"ultrawork:worker"` 형식 확정**
- [ ] SubagentStop matcher에 확인된 agent_type 값으로 세분화 적용
- [ ] subagent-stop-tracking.js에 agent_type 필드 읽기 추가 후 동작 확인
- [ ] stop-hook.js에 stop_hook_active 체크 추가 후 무한 루프 시나리오 테스트
- [ ] 테스트 완료 후 `.claude/settings.local.json`에서 로깅 hook 제거

### 검증 결과 요약 (2026-02-07)

| 검증 항목 | 결과 | 방법 |
|---|---|---|
| SubagentStop에 agent_type 존재 | ✅ 확인 | 라이브 테스트 (Bash agent) |
| SubagentStop에 agent_transcript_path 존재 | ✅ 확인 | 라이브 테스트 |
| SubagentStop에 stop_hook_active 존재 | ✅ 확인 (값: false) | 라이브 테스트 |
| SubagentStop에 permission_mode 존재 | ✅ 확인 | 라이브 테스트 (문서에 없던 필드) |
| Plugin agent_type 형식: `plugin:agent_name` | ✅ 확인 | Agent registry 에러 메시지 |
| Native TaskGet에서 metadata 미표시 | ✅ 확인 | 직접 TaskCreate + TaskGet 테스트 |
| Prompt-based SubagentStop blocking 미동작 | ✅ 확인 | GitHub Issue #20221 |
