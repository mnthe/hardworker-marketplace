# Ultrawork Plan Document Improvement

## Context Orientation

### Project
- **Repo**: hardworker-marketplace (JavaScript/Bun, Claude Code plugin marketplace)
- **Target plugin**: ultrawork — verification-first development with session isolation
- **Relevant modules**: `plugins/ultrawork/agents/planner/`, `plugins/ultrawork/skills/planning/`, `plugins/ultrawork/agents/explorer/`
- **Design template**: `plugins/ultrawork/skills/planning/references/design-template.md`

### Current State
Ultrawork의 planner agent는 exploration 결과를 기반으로 design document를 생성하고, task로 분해하여 worker agent에게 전달한다. Design document는 `docs/plans/YYYY-MM-DD-{slug}-design.md` 형태로 프로젝트 디렉토리에 저장된다.

### What Changes
Plan document의 **템플릿 구조**와 **생성 프로세스** 두 축을 개선하여, worker agent가 plan만으로 구현할 수 있는 수준의 문서 품질을 달성한다.

### Why
14개 기존 plan 문서 분석 결과, 3가지 약점이 반복적으로 나타남:
1. **Criteria specificity 부족** — "기능 동일", "정상 동작" 같은 주관적 기준 → verifier FAIL → 재작업
2. **Context orientation 부족** — 코드베이스 사전 지식을 전제 → worker가 추가 탐색 필요
3. **Cross-module impact 미기술** — 변경 파일의 소비자 미명시 → props 변경 시 7개 테스트 regression

품질 추이: Early 3.8 → Mid 4.1 → Recent 4.3 → Spec 문서 4.8 (6차원 5점 척도 평균). Gold standard인 Evidence v1.0.0 Spec(5.0/5.0)의 패턴을 일반화하는 것이 목표.

---

## Problem Statement

### 측정 데이터

| 지표 | 현재 | 목표 |
|------|------|------|
| Plan 문서 품질 평균 (6차원) | 4.3/5.0 (Recent) | 4.7+ |
| Criteria specificity 평균 | 3.4/5.0 | 4.5+ |
| Context orientation 평균 | 3.7/5.0 | 4.5+ |
| 주관적 criteria 포함 plan 문서 비율 | ~50% (14개 중 7개) | 0% (신규 세션부터) |
| 주관적 criteria 사용 | 허용됨 | 금지 (검증 명령 필수) |

### 데이터 출처
- 14개 plan 문서 분석 (2025-11 ~ 2026-03, 4개 프로젝트)
- 6개 완료 세션의 task evidence 분석
- Anthropic, Cursor, Vercel, OpenAI 공식 블로그/문서 트렌드 리서치

### 참조한 업계 트렌드

| 출처 | 핵심 패턴 | 적용 방식 |
|------|----------|----------|
| OpenAI ExecPlan | Self-containedness, Observable verification, Idempotency | Context Orientation 섹션, Verification Strategy |
| Anthropic Interview Pattern | 데이터 기반 질문, Clean context 분리 | Data-driven interview 가이드라인 |
| GitHub Spec Kit | Specify → Plan → Tasks 분리 | Design doc 내 논리적 분리 |
| Addy Osmani SDD | Criteria 구체화, Boundary system | 금지 표현 목록, Verification 매핑 |
| Vercel EDD | Eval-driven development | Criterion → Command → Expected Output 패턴 |

---

## Approach Selection

### 고려한 옵션

| Option | 설명 | 장점 | 단점 |
|--------|------|------|------|
| A. Criteria-First | 기존 템플릿에서 약한 3개 차원만 보강 | 빠른 적용 | 근본 구조 미개선 |
| **B. SDD-Informed Redesign** | 템플릿 재설계 + 생성 프로세스 개선 | 근본 원인 해결, Evidence Spec 패턴 일반화 | 중간 규모 작업 |
| C. Full SDD Pipeline | Spec/Plan 물리 분리 + 전용 agent 추가 | 이론적 완전성 | tasks/*.json 이미 존재하므로 B와 실질 차이 없음 |

### 선택: Option B

tasks/*.json이 이미 실행 단위로 존재하므로, 물리적 파일 분리(Option C)는 design.md를 쪼개는 것뿐이며 추가 가치가 낮다. Option B가 최적의 ROI를 제공한다.

---

## Decisions

| # | 결정 | 선택 | 근거 | Asked User |
|---|------|------|------|:---:|
| D1 | Spec/Plan 파일 분리 | 논리적 분리 (한 문서 내) | tasks/*.json 존재로 물리 분리 불필요 | Yes |
| D2 | Context Orientation 위치 | 문서 첫 섹션 | Worker가 가장 먼저 읽어야 할 정보 | No |
| D3 | 주관적 criteria 처리 | 금지 + 대안 패턴 제시 | 세션 분석에서 verifier FAIL의 주요 원인 | No |
| D4 | Impact Analysis 데이터 소스 | Explorer가 수집 | Planner가 직접 수집하면 context 비효율 | No |
| D5 | Self-containedness check 위치 | Design template 하단에 체크리스트 포함 + planning SKILL.md에 "doc-review 전 self-check 수행" 가이드 추가. Planner가 문서 작성 완료 후 체크리스트를 자체 검증하고, Codex doc-review가 동일 체크리스트를 재검증 | Yes |
| D6 | Data Collection 단계 | 탐색 단계에 통합 (별도 단계 X) | Explorer가 이미 코드베이스 탐색 중, 추가 단계는 overhead | No |
| D7 | Living document 패턴 | 미도입 | Documentation phase가 이미 존재, replan 루프 구조 변경 필요 | Yes |
| D8 | Verification Strategy 형식 | Criterion → Command → Expected Output 테이블 | Vercel EDD + OpenAI ExecPlan에서 검증된 패턴 | No |

---

## Architecture

### 변경 범위

두 가지 축의 변경이 독립적으로 적용됨:

```
Axis 1: Template (문서 구조)
  ├── design-template.md 재설계
  └── success-criteria.md 강화

Axis 2: Process (생성 과정)
  ├── explorer AGENT.md — 정량 데이터 수집 항목 추가
  ├── overview-exploration SKILL.md — 정량 수집 가이드 추가
  ├── planning SKILL.md — interview 가이드라인 + self-containedness 통합
  ├── planner AGENT.md — 프로세스 단계 반영
  └── task-decomposition.md — criteria 검증 규칙 추가
```

### 컴포넌트 변경 매핑

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `skills/planning/references/design-template.md` | 대폭 수정 | Context Orientation, Impact Analysis, Verification Strategy 섹션 추가; Testing Strategy → Verification Strategy 대체; Documentation 섹션 제거; Assumptions+Risks 통합 |
| `agents/planner/references/success-criteria.md` | 수정 | 금지 표현 목록에 한국어 패턴 추가, Criterion → Command → Output 패턴 필수화 |
| `agents/planner/references/task-decomposition.md` | 수정 | criteria가 Verification Strategy에서 추출되는 흐름 추가 |
| `agents/explorer/AGENT.md` | 수정 | Quantitative Collection 섹션 추가 (소비자 추적, 테스트 현황) |
| `skills/overview-exploration/SKILL.md` | 수정 | 정량 데이터 수집 항목 추가 |
| `skills/planning/SKILL.md` | 수정 | Data-driven interview 규칙, Self-containedness check 추가 |
| `agents/planner/AGENT.md` | 수정 | 프로세스 단계 반영 (Data Collection → Interview → Write → Check) |

### 변경하지 않는 것

| 파일/영역 | 이유 |
|----------|------|
| 세션 구조 (session.json) | 스키마 변경 불필요 |
| Task 구조 (tasks/*.json) | criteria 필드 형식은 유지, 내용 품질만 개선 |
| Hook 시스템 | 게이트 로직 변경 불필요 |
| Script 파일들 | 기존 인터페이스 유지 |
| Codex doc-review 스크립트 | 리뷰 criteria는 design template에 내장 |
| 파이프라인 단계 수 | 추가 단계 없음 (기존 단계 내 강화) |

---

## Impact Analysis

### Changed Files → Consumers

| Changed File | Consumers | Risk |
|---|---|---|
| `design-template.md` | planner AGENT.md (참조), planning SKILL.md (참조) | 템플릿 변경 시 planner가 새 섹션을 인식해야 함 |
| `success-criteria.md` | planner AGENT.md (참조), task-decomposition.md (참조) | criteria 패턴 변경이 planner 행동에 직접 영향 |
| `explorer AGENT.md` | ultrawork-plan command (spawn), ultrawork command (spawn), planner (exploration/*.md 소비) | 탐색 출력 형식 변경 시 planner의 context parsing 영향 |
| `overview-exploration SKILL.md` | ultrawork-plan command (direct execution) | 수집 항목 추가가 실행 시간에 영향 가능 |
| `planning SKILL.md` | ultrawork-plan command (interactive mode 참조) | interview 규칙 변경이 대화 흐름에 영향 |
| `planner AGENT.md` | ultrawork-plan command (auto mode spawn) | 프로세스 단계 변경이 auto mode 행동에 직접 영향 |

### Pre-Work Verification

변경 전 baseline 확인:
```bash
bun test tests/ultrawork/  # 기존 테스트 모두 통과 확인
```

참고: 이번 변경은 모두 markdown 문서(agent/skill/template)이므로 코드 테스트 regression 위험은 낮음. 단, planner 행동 변화에 대한 functional verification 필요.

---

## Scope

### In Scope

1. **design-template.md** 재설계
   - Context Orientation 섹션 (6요소 필수)
   - Impact Analysis 섹션 (Changed Files → Consumers 테이블 + Pre-Work Verification)
   - Verification Strategy 섹션 (Criterion → Command → Expected Output 테이블)
   - Self-Containedness Checklist (문서 하단)
   - Testing Strategy → Verification Strategy 대체
   - Documentation 섹션 제거
   - Assumptions + Risks 통합

2. **success-criteria.md** 강화
   - 금지 표현 목록에 한국어 패턴 추가 ("기능 동일", "정상 동작", "코드 정리", "import 정리")
   - Criterion → Command → Output 필수 패턴
   - Good/Bad 예시 확대

3. **task-decomposition.md** 보강
   - Verification Strategy에서 criteria 추출 흐름
   - Worker에게 전달할 criteria 형식 규칙

4. **explorer AGENT.md** 수정
   - Quantitative Collection 섹션 추가
   - 수집 항목: 파일별 소비자 목록, 테스트 현황, 인터페이스 시그니처

5. **overview-exploration SKILL.md** 수정
   - 정량 데이터 수집 가이드 추가

6. **planning SKILL.md** 수정
   - Data-driven interview 질문 생성 규칙
   - Interview 질문 → 반영 섹션 매핑 테이블
   - Self-containedness check를 doc-review에 통합하는 가이드

7. **planner AGENT.md** 수정
   - 프로세스 단계 업데이트 반영

### Out of Scope

- session.json 스키마 변경
- tasks/*.json 구조 변경
- Hook 로직 수정
- Script 파일 수정
- Codex doc-review 스크립트 수정
- Living document 패턴 도입
- Spec/Plan 물리적 파일 분리
- 새로운 agent 추가
- 파이프라인 단계 수 변경

---

## Verification Strategy

### Criterion → Verification 매핑

| # | Criterion | Command | Expected Output |
|---|-----------|---------|-----------------|
| V1 | design-template.md에 Context Orientation 섹션 존재 | `grep -c "## Context Orientation" plugins/ultrawork/skills/planning/references/design-template.md` | 1 |
| V2 | design-template.md에 Impact Analysis 섹션 존재 | `grep -c "## Impact Analysis" plugins/ultrawork/skills/planning/references/design-template.md` | 1 |
| V3 | design-template.md에 Verification Strategy 섹션 존재 | `grep -c "## Verification Strategy" plugins/ultrawork/skills/planning/references/design-template.md` | 1 |
| V4 | design-template.md에 Self-Containedness Checklist 존재 | `grep -c "Self-Containedness Checklist" plugins/ultrawork/skills/planning/references/design-template.md` | 1 |
| V5 | design-template.md에서 Testing Strategy 헤더 제거됨 | `grep -c "^## Testing Strategy$" plugins/ultrawork/skills/planning/references/design-template.md` | 0 |
| V6 | design-template.md에서 Documentation 헤더 제거됨 | `grep -c "^## Documentation$" plugins/ultrawork/skills/planning/references/design-template.md` | 0 |
| V7 | design-template.md에서 Assumptions+Risks가 통합됨 | `grep -c "^## Assumptions & Risks$" plugins/ultrawork/skills/planning/references/design-template.md` | 1 |
| V8 | success-criteria.md에 한국어 금지 표현 추가됨 | `grep -c "기능 동일" plugins/ultrawork/agents/planner/references/success-criteria.md` | 1+ |
| V9 | success-criteria.md에 Command → Output 패턴 존재 | `grep -c "Command" plugins/ultrawork/agents/planner/references/success-criteria.md` | 1+ |
| V10 | task-decomposition.md에 Verification Strategy 참조 존재 | `grep -c "Verification Strategy" plugins/ultrawork/agents/planner/references/task-decomposition.md` | 1+ |
| V11 | explorer AGENT.md에 Quantitative Collection 존재 | `grep -c "Quantitative" plugins/ultrawork/agents/explorer/AGENT.md` | 1+ |
| V12 | planning SKILL.md에 Data-driven interview 규칙 존재 | `grep -c "Data-driven\|데이터 기반" plugins/ultrawork/skills/planning/SKILL.md` | 1+ |
| V13 | planning SKILL.md에 Self-containedness 가이드 존재 | `grep -c "Self-[Cc]ontainedness\|self-containedness" plugins/ultrawork/skills/planning/SKILL.md` | 1+ |
| V14 | planner AGENT.md에 개선된 프로세스 단계 존재 | `grep -c "Data Collection\|Quantitative\|Self-[Cc]ontainedness" plugins/ultrawork/agents/planner/AGENT.md` | 1+ |
| V15 | 기존 테스트 통과 | `bun test tests/ultrawork/` | PASS, exit 0 |

---

## Execution Strategy

### Task Overview

| ID | Subject | Complexity | Blocked By | Est. Files |
|----|---------|------------|------------|------------|
| 1 | design-template.md 재설계 | standard | - | 1 |
| 2 | success-criteria.md 강화 | standard | - | 1 |
| 3 | task-decomposition.md 보강 | standard | 2 | 1 |
| 4 | explorer AGENT.md 수정 | standard | - | 1 |
| 5 | overview-exploration SKILL.md 수정 | standard | 4 | 1 |
| 6 | planning SKILL.md 수정 | standard | 1, 2 | 1 |
| 7 | planner AGENT.md 수정 | standard | 6 | 1 |
| verify | 최종 검증 | complex | 1-7 | - |

### Execution Waves

```
Wave 1 (parallel): Task 1, 2, 4
Wave 2 (parallel): Task 3, 5, 6
Wave 3: Task 7
Wave 4: Verify
```

### Key Criteria
1. 모든 신규 섹션이 design-template.md에 존재 (V1-V7)
2. 금지 표현 + Command-Output 패턴이 success-criteria.md에 포함 (V8-V9)
3. 모든 프로세스 파일에 개선사항 반영됨 (V10-V14)
4. 기존 테스트 regression 없음 (V15)

---

## Assumptions & Risks

### Assumptions
- Planner agent는 markdown template의 섹션 구조를 읽고 따름 (별도 코드 변경 불필요)
- Explorer agent는 추가 수집 지시를 자연어 가이드로 수행 가능
- Codex doc-review는 design template 내 체크리스트를 자동으로 참조 가능

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Template 변경 후 planner가 새 섹션을 무시 | Medium | Planner AGENT.md에 섹션 목록 명시 + 필수 표시 |
| Explorer 정량 수집으로 탐색 시간 증가 | Low | 수집 항목을 essential로 제한 (3-4개), 시간 예산 유지 |
| 기존 plan 문서와 신규 템플릿 불일치 | Low | 기존 문서는 수정하지 않음 (새 세션부터 적용) |
| Criteria 강제가 너무 엄격하여 trivial 작업에 overhead | Low | NO_PLANNING tier에서는 간소화된 criteria 허용 |

---

## Self-Containedness Checklist

- [x] Context Orientation만 읽고 이 프로젝트/변경이 뭔지 알 수 있는가?
- [x] 모든 Criterion에 실행 명령과 기대 출력이 있는가? (V1-V15)
- [x] Impact Analysis의 모든 소비자에 대한 처리 방안이 있는가?
- [x] 문서에 없는 결정을 worker가 내려야 하는 상황이 있는가? → 없음
- [x] "기능 동일", "정상 동작" 같은 주관적 표현이 없는가? → 없음

---

## Appendix A: New Design Template (Full Content)

아래는 Task 1에서 `design-template.md`를 대체할 전체 템플릿이다. Worker는 이 내용을 그대로 적용한다.

````markdown
# Design Document Template

## File Location

**IMPORTANT: Design documents go to PROJECT directory (NOT session directory).**

```bash
# Get working directory from session
WORKING_DIR=$(bun $SCRIPTS/session-get.js --session ${CLAUDE_SESSION_ID} --field working_dir)

# Design document path
# Format: {working_dir}/docs/plans/YYYY-MM-DD-{goal-slug}-design.md
DESIGN_PATH="$WORKING_DIR/docs/plans/$(date +%Y-%m-%d)-{goal-slug}-design.md"

# Create directory if needed
mkdir -p "$WORKING_DIR/docs/plans"
```

---

## Template

```markdown
# Design: {Goal}

## Context Orientation

### Project
- **Repo**: [repo name] ([language/framework], [repo type])
- **Relevant modules**: [list of directories/modules involved]
- **Entry points**: [main files or functions that connect to the change]

### Current State
[2-3 sentences: what the system currently does in the area being changed.
Include specific file paths, function names, and behavior.]

### What Changes
[1-2 sentences: what will be different after this work is done.]

### Why
[1-2 sentences: the problem or need driving this change.
Include measurable data when available (error rates, performance numbers, user reports).]

## Problem Statement

[Data-driven description of the problem. Include measured values, counts, or concrete observations.
Avoid speculation — state facts from exploration.]

## Approach Selection

### Considered Options
| Option              | Pros | Cons | Fit               |
| ------------------- | ---- | ---- | ----------------- |
| Option A (Selected) | ...  | ...  | Best for our case |
| Option B            | ...  | ...  | ...               |
| Option C            | ...  | ...  | ...               |

### Selected: Option A
**Rationale**: [Why this approach was chosen]

## Decisions

### {Decision Topic 1}
- **Choice**: [Selected option]
- **Rationale**: [Why this was chosen]
- **Alternatives Considered**: [Other options]
- **Asked User**: Yes/No

## Architecture

### Components

#### 1. {Component Name}
- **Files**: `path/to/file.ts`
- **Dependencies**: package-name
- **Description**: What this component does

### Data Flow
```
[Diagram or description of data flow]
```

## Impact Analysis

### Changed Files → Consumers

| Changed File | Consumers | Risk |
|---|---|---|
| `path/to/changed-file.ts` | `consumer1.ts`, `consumer2.ts` | [Risk description] |
| `path/to/another.ts` | `test.spec.ts` | [Risk description] |

### Pre-Work Verification
Worker는 각 task 시작 전 아래 명령을 실행하여 baseline 확보:
```bash
[project-specific test/typecheck command]  # 현재 상태에서 모두 통과 확인
```

## Error Handling

### Error Categories
| Category   | Example            | Handling Strategy             |
| ---------- | ------------------ | ----------------------------- |
| Validation | Invalid input      | Return 400 with details       |
| Auth       | Invalid token      | Return 401, redirect to login |
| Not Found  | Resource missing   | Return 404                    |
| Server     | DB connection fail | Return 500, log, alert        |

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "User-friendly message",
    "details": [...]
  }
}
```

### Fallback Strategies
- [Graceful degradation approach]
- [Retry logic if applicable]
- [Circuit breaker if applicable]

## Scope

### In Scope
- Feature 1
- Feature 2

### Out of Scope
- Future feature 1
- Future feature 2

## Verification Strategy

### Criterion → Verification Mapping

| # | Criterion | Command | Expected Output |
|---|-----------|---------|-----------------|
| V1 | [Specific, measurable criterion] | `[exact command to verify]` | [expected result] |
| V2 | [File exists at path] | `test -f path/to/file.ts && echo "exists"` | exists |
| V3 | [Pattern removed from code] | `grep -c "old_pattern" path/to/file.ts` | 0 |
| V4 | [Tests pass] | `bun test path/to/test.ts` | PASS, exit 0 |

### Banned Criterion Patterns
These MUST NOT appear as criteria. Use the command+output alternative instead:
- ❌ "기능 동일" → ✅ `bun test path/to/test.ts`: N/N PASS, exit 0
- ❌ "정상 동작" → ✅ `curl localhost:3000/api/x` → HTTP 200, body contains {field}
- ❌ "코드 정리" → ✅ `grep -c "old_pattern" path/to/file.ts` → 0 matches
- ❌ "import 정리" → ✅ `grep -c "unused_import" path/to/file.ts` → 0 matches

## Execution Strategy

### Task Overview
| ID | Task | Complexity | Approach | Blocked By |
|----|------|-----------|----------|------------|
| 1  | [Task subject] | standard | standard | - |
| 2  | [Task subject] | standard | tdd | 1 |
| verify | [Verification] | complex | - | 1, 2 |

### Task Criteria Derivation Rule
Each task's criteria MUST be derived from the Verification Strategy table above.
For Task N, extract rows Vx that correspond to that task's deliverable.

### Execution Waves
- **Wave 1**: [1] — [Brief rationale]
- **Wave 2**: [2] — [Brief rationale]
- **Wave 3**: [verify] — Final verification

### Key Criteria
[List 2-3 most critical success criteria across all tasks]
- [ ] [Critical criterion 1]
- [ ] [Critical criterion 2]

## Assumptions & Risks

### Assumptions
1. [Assumption 1]
2. [Assumption 2]

### Risks
| Risk     | Impact       | Mitigation        |
| -------- | ------------ | ----------------- |
| [Risk 1] | High/Med/Low | [How to mitigate] |
| [Risk 2] | High/Med/Low | [How to mitigate] |
```

---

## Checklist Before Finalizing

### YAGNI Checklist

- [ ] No features beyond stated goal
- [ ] No "future-proofing" abstractions
- [ ] No optional enhancements
- [ ] Minimum viable scope only

### Self-Containedness Checklist

- [ ] Context Orientation만 읽고 이 프로젝트가 뭔지 알 수 있는가?
- [ ] 모든 Criterion에 실행 명령과 기대 출력이 있는가?
- [ ] Impact Analysis의 모든 소비자에 대한 처리 방안이 있는가?
- [ ] 문서에 없는 결정을 worker가 내려야 하는 상황이 있는가?
- [ ] "기능 동일", "정상 동작" 같은 주관적 표현이 없는가?
````

### Key Changes from Current Template

| Section | Change | Rationale |
|---------|--------|-----------|
| Context Orientation | **NEW** — 6요소 (Project, Relevant modules, Entry points, Current State, What Changes, Why) | Worker에게 zero-context 오리엔테이션 제공 |
| Problem Statement | **NEW** — 데이터 기반 문제 정의 | Evidence Spec 패턴 일반화 |
| Impact Analysis | **NEW** — Changed Files → Consumers 테이블 + Pre-Work Verification | Cross-module regression 방지 |
| Verification Strategy | **REPLACE** Testing Strategy → Criterion-Command-Output 테이블 + 금지 패턴 목록 | 주관적 criteria 원천 차단 |
| Task Criteria Derivation | **NEW** — Verification Strategy에서 task criteria 추출 규칙 | Design doc ↔ task criteria 연결 보장 |
| Documentation | **REMOVED** | Worker가 참조하지 않는 섹션; 필요 시 Scope에 포함 |
| Assumptions + Risks | **MERGED** | 두 섹션이 항상 짧아 통합이 자연스러움 |
| Self-Containedness Checklist | **NEW** — 5개 항목 | 문서 완성도 자체 검증 |
