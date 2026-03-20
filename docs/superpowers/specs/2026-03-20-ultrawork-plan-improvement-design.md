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
| Verifier FAIL로 인한 fix task 발생 | 발생함 (정확한 비율 미측정) | 감소 |
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
| D5 | Self-containedness check 위치 | Codex doc-review에 통합 | 별도 단계 시 파이프라인 복잡도 증가 | Yes |
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
| `agents/planner/references/success-criteria.md` | 수정 | 금지 표현 목록 확대, Criterion → Command → Output 패턴 필수화 |
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
| `explorer AGENT.md` | ultrawork-plan command (spawn), ultrawork command (spawn) | 탐색 출력 형식 변경 시 planner의 context parsing 영향 |
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
   - 금지 표현 목록 확대 ("기능 동일", "정상 동작", "코드 정리", "import 정리")
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
| V5 | design-template.md에서 Testing Strategy 섹션 제거됨 | `grep -c "## Testing Strategy" plugins/ultrawork/skills/planning/references/design-template.md` | 0 |
| V6 | design-template.md에서 Documentation 섹션 제거됨 | `grep -c "## Documentation" plugins/ultrawork/skills/planning/references/design-template.md` | 0 |
| V7 | success-criteria.md에 금지 표현 목록 확대됨 | `grep -c "기능 동일" plugins/ultrawork/agents/planner/references/success-criteria.md` | 1+ (금지 목록에 포함) |
| V8 | success-criteria.md에 Command → Output 패턴 존재 | `grep -c "Command" plugins/ultrawork/agents/planner/references/success-criteria.md` | 1+ |
| V9 | explorer AGENT.md에 Quantitative Collection 존재 | `grep -c "Quantitative" plugins/ultrawork/agents/explorer/AGENT.md` | 1+ |
| V10 | planning SKILL.md에 Data-driven interview 규칙 존재 | `grep -c "Data-driven\|데이터 기반" plugins/ultrawork/skills/planning/SKILL.md` | 1+ |
| V11 | planning SKILL.md에 Self-containedness 가이드 존재 | `grep -c "Self-[Cc]ontainedness\|self-containedness" plugins/ultrawork/skills/planning/SKILL.md` | 1+ |
| V12 | 기존 테스트 통과 | `bun test tests/ultrawork/` | PASS, exit 0 |

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
1. 모든 신규 섹션이 design-template.md에 존재 (V1-V6)
2. 금지 표현 목록이 success-criteria.md에 포함 (V7-V8)
3. 기존 테스트 regression 없음 (V12)

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
- [x] 모든 Criterion에 실행 명령과 기대 출력이 있는가? (V1-V12)
- [x] Impact Analysis의 모든 소비자에 대한 처리 방안이 있는가?
- [x] 문서에 없는 결정을 worker가 내려야 하는 상황이 있는가? → 없음
- [x] "기능 동일", "정상 동작" 같은 주관적 표현이 없는가? → 없음
