# Ultrawork Planning Pipeline Redesign

## Overview

Ultrawork의 planning pipeline을 재설계하여 두 가지 문제를 해결한다:
1. **Auto-trigger 확장**: keyword-detector가 구현 키워드를 감지하여 `/ultrawork-plan` 사용을 제안 (advisory mode)
2. **Pipeline 순서 분리**: Design doc에서 Execution Strategy를 분리하여, Codex doc-review가 순수 설계만 검증한 후 task 분해

---

## Context Orientation

### Project
- **Repo**: hardworker-marketplace (JavaScript/Bun, Claude Code plugin marketplace)
- **Target plugin**: ultrawork — verification-first development with session isolation
- **Relevant modules**: `plugins/ultrawork/commands/`, `plugins/ultrawork/src/hooks/keyword-detector.js`, `plugins/ultrawork/agents/planner/`, `plugins/ultrawork/skills/planning/`
- **Entry points**: `/ultrawork` command → `keyword-detector.js` hook → `setup-ultrawork.js` → planner agent

### Current State
1. **Auto-trigger**: ultrawork은 명시적 `/ultrawork` 호출 필요. Superpowers:brainstorming이 더 넓은 범위("any creative work")로 먼저 트리거되어, 복잡한 구현 작업도 brainstorming이 잡음.
2. **Planning pipeline**: Planner가 design doc 작성 시 Execution Strategy(task 분해)를 포함한 후, Codex doc-review가 설계+분해를 동시에 검증. Doc-review 실패 시 설계 수정 + task 재분해가 동시에 필요.
3. **`/ultrawork --auto`**: plan + exec을 한번에 실행 (유지).

### What Changes
1. Ultrawork keyword-detector를 확장하여 구현 작업을 자동 감지하고 ultrawork planning으로 라우팅
2. Design doc에서 Execution Strategy 섹션을 분리 — doc-review가 순수 설계만 검증한 후 task 분해
3. 장기적으로 brainstorming 스킬을 ultrawork planning으로 대체하는 기반 마련

### Why
- Brainstorming → writing-plans → executing-plans 3단계 파이프라인은 ultrawork의 evidence-based verification과 중복
- Doc-review 실패 시 design + tasks를 동시에 수정하는 것은 비효율적 (이전 세션 분석에서 확인)
- 사용자가 매번 `/ultrawork`를 명시적으로 호출하는 것은 friction

---

## Problem Statement

### 현재 워크플로우 비효율

**Auto-trigger 부재:**
- `keyword-detector.js`는 "ultrawork", "ulw", "uw" 키워드만 감지
- "이 기능 구현해줘", "리팩토링 해줘" 같은 자연어 요청은 brainstorming이 잡음
- 결과: 사용자가 brainstorming → writing-plans → ultrawork-exec으로 수동 전환하거나, 처음부터 `/ultrawork` 명시 호출 필요

**Planning pipeline 순서 문제:**
- 현재: Write design (Execution Strategy 포함) → Doc-review (설계+분해 동시 검증) → task-create.js
- 문제: doc-review가 설계 수정을 요구하면, Execution Strategy도 같이 수정해야 함
- 이상적: Write spec → Doc-review (설계만 검증) → Verified spec 기반 task 분해

---

## Approach Selection

### 고려한 옵션

| Option | 설명 | 장점 | 단점 |
|--------|------|------|------|
| A. Keyword detector 확장만 | 더 많은 키워드/패턴 감지 | 빠른 적용 | Pipeline 구조 미개선 |
| **B. Detector 확장 + Pipeline 재설계** | Auto-trigger + Spec/Task 분리 | 두 문제 모두 해결 | 중간 규모 작업 |
| C. Brainstorming 완전 대체 | Superpowers 플러그인 수정 | 가장 완전한 해결 | 외부 플러그인 수정 불가 |

### 선택: Option B

Superpowers는 외부 플러그인이라 직접 수정 불가. CLAUDE.md 규칙 + keyword-detector 확장으로 라우팅하고, pipeline 구조도 함께 개선.

---

## Decisions

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| D1 | Auto-trigger 메커니즘 | keyword-detector.js 확장 + `~/.claude/rules/` 글로벌 규칙 추가 | Hook이 이미 UserPromptSubmit에서 동작, 확장 자연스러움 |
| D2 | 감지할 키워드 범위 | 구현 관련 한국어/영어 키워드 ("구현", "만들어", "리팩토링", "implement", "build", "refactor") | 너무 넓으면 false positive, 너무 좁으면 놓침 — 구현 동사에 집중 |
| D3 | Brainstorming과의 공존 | `~/.claude/rules/`에 글로벌 라우팅 규칙 추가 — "구현 작업은 ultrawork-plan 사용" | Brainstorming 스킬 자체를 수정할 수 없으므로 규칙으로 우회 |
| D4 | Design doc에서 Execution Strategy 분리 시점 | Doc-review 통과 후 Execution Strategy 작성 | Verified spec 기반 분해가 목적 |
| D5 | Design doc 구조 변경 | Execution Strategy를 "optional, post-review" 섹션으로 이동 | 기존 템플릿 하위 호환 유지 |
| D6 | `/ultrawork --auto` 동작 | plan + exec 한번에 유지 (현재 동작 유지) | 사용자 확인 |
| D7 | `/ultrawork-plan` 동작 | plan만 실행 유지 (현재 동작 유지) | 사용자 확인 |

---

## Architecture

### 변경 흐름

```
[현재]
User prompt → keyword-detector (ultrawork/ulw/uw만) → /ultrawork
                                                    ↓
              Planner → Write design (Execution Strategy 포함)
                                                    ↓
              Codex doc-review (설계+분해 동시 검증)
                                                    ↓
              task-create.js

[개선]
User prompt → keyword-detector (구현 키워드 확장) → /ultrawork-plan 제안
                                                    ↓
              ~/.claude/rules/ (brainstorming 대신 ultrawork 글로벌 라우팅)
                                                    ↓
              Planner → Write design (Execution Strategy 없이)
                                                    ↓
              Codex doc-review (순수 설계만 검증)
                                                    ↓
              [Doc-review PASS] → Planner가 Execution Strategy 작성 + task-create.js
```

### 컴포넌트 변경 매핑

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `plugins/ultrawork/src/hooks/keyword-detector.js` | 수정 | 구현 키워드 패턴 확장, `/ultrawork-plan` 제안 메시지 출력 |
| `~/.claude/rules/ultrawork-routing.md` | 신규 | "구현 작업은 brainstorming 대신 ultrawork-plan 사용" 글로벌 라우팅 규칙 |
| `plugins/ultrawork/skills/planning/SKILL.md` | 수정 | Phase 4 (Write Design)에서 Execution Strategy 분리, Phase 5 순서 변경 |
| `plugins/ultrawork/skills/planning/references/design-template.md` | 수정 | Execution Strategy를 "Post-Review" 섹션으로 이동, 선택적 표시 |
| `plugins/ultrawork/agents/planner/AGENT.md` | 수정 | PLANNING tier 워크플로우에서 분리된 순서 반영 |
| `plugins/ultrawork/commands/ultrawork-plan.md` | 수정 | Interactive mode에서 분리된 순서 반영 |
| `plugins/ultrawork/CLAUDE.md` | 수정 | Phase transition 규칙 업데이트 (doc-review → task decomposition 순서) |

---

## Impact Analysis

### Changed Files → Consumers

| Changed File | Consumers | Risk |
|---|---|---|
| `keyword-detector.js` | 모든 ultrawork 세션 (UserPromptSubmit hook) | False positive로 불필요한 ultrawork 제안 가능 |
| `design-template.md` | planner AGENT.md, planning SKILL.md | 1.8.0에서 방금 수정한 템플릿을 다시 수정 |
| `planning SKILL.md` | ultrawork-plan command (interactive mode) | Phase 순서 변경이 기존 세션 호환성에 영향 |
| `planner AGENT.md` | ultrawork-plan command (auto mode spawn) | Auto mode 워크플로우 변경 |
| `~/.claude/rules/` | 전체 사용자 환경 (글로벌) | 모든 프로젝트에 적용됨 |

### Pre-Work Verification
```bash
bun test tests/ultrawork/  # 기존 테스트 통과 확인
node plugins/ultrawork/src/hooks/keyword-detector.js < /dev/null  # hook 실행 확인
```

---

## Error Handling

### Keyword Detector False Positives
- "구현" 키워드가 대화 중 언급될 수 있음 (구현 질문 vs 구현 요청)
- 대응: detector가 `/ultrawork-plan` 을 **제안**만 하고 강제하지 않음 (advisory mode)
- 메시지: "💡 복잡한 구현 작업이 감지되었습니다. `/ultrawork-plan`을 사용하시겠습니까?"

### Pipeline 순서 변경 호환성
- 기존 세션 (1.7.0, 1.8.0): Execution Strategy가 design doc에 포함된 상태
- 신규 세션 (1.9.0+): Execution Strategy가 doc-review 후 별도 추가
- 대응: planner가 design doc에 Execution Strategy 존재 여부를 확인하고 적응

---

## Scope

### In Scope

1. `keyword-detector.js` — 구현 키워드 패턴 확장 (advisory mode)
2. `~/.claude/rules/ultrawork-routing.md` — brainstorming → ultrawork 글로벌 라우팅 규칙
3. `design-template.md` — Execution Strategy를 post-review 섹션으로 이동
4. `planning SKILL.md` — Phase 4/5 순서 변경 (Write spec → Doc-review → Task decompose)
5. `planner AGENT.md` — 분리된 순서 반영
6. `commands/ultrawork-plan.md` — Interactive mode 순서 반영
7. `CLAUDE.md` — Phase transition 규칙 업데이트

### Out of Scope

- Superpowers brainstorming 스킬 수정 (외부 플러그인)
- `/ultrawork --auto` 동작 변경 (plan + exec 한번에 유지)
- `/ultrawork-plan` 동작 변경 (plan만 유지)
- Codex doc-review 스크립트 수정
- Gate enforcement hook 수정

---

## Verification Strategy

### Criterion → Verification Mapping

| # | Criterion | Command | Expected Output |
|---|-----------|---------|-----------------|
| V1 | keyword-detector.js에 구현 키워드 패턴 존재 | `grep -c "구현\|만들어\|리팩토링\|implement\|build\|refactor" plugins/ultrawork/src/hooks/keyword-detector.js` | 1+ |
| V2 | keyword-detector.js가 advisory mode | `grep -c "제안\|suggest\|advisory" plugins/ultrawork/src/hooks/keyword-detector.js` | 1+ |
| V3 | ultrawork-routing.md 글로벌 규칙 파일 존재 | `test -f ~/.claude/rules/ultrawork-routing.md && echo "exists"` | exists |
| V4 | design-template.md에서 Execution Strategy가 post-review 표시 | `grep -c "Post-Review\|post-review\|after.*doc-review" plugins/ultrawork/skills/planning/references/design-template.md` | 1+ |
| V5 | planning SKILL.md에서 Phase 순서 변경 반영 | `grep -B2 -A2 "Decompose Tasks" plugins/ultrawork/skills/planning/SKILL.md` | doc-review 이후에 위치 |
| V6 | planner AGENT.md에서 분리된 순서 반영 | `grep -c "doc-review.*before.*task\|verify.*before.*decompos" plugins/ultrawork/agents/planner/AGENT.md` | 1+ |
| V7 | CLAUDE.md Phase transition 규칙 업데이트 | `grep -c "doc-review.*task decomposition\|verified.*spec.*task" plugins/ultrawork/CLAUDE.md` | 1+ |
| V8 | 기존 keyword-detector 테스트 통과 | `bun test tests/ultrawork/` | PASS, exit 0 |
| V9 | keyword-detector.js 실행 오류 없음 | `echo '{}' \| bun plugins/ultrawork/src/hooks/keyword-detector.js` | exit 0 |

### Banned Criterion Patterns
- ❌ "정상 동작" → ✅ 위 V1-V9 참조
- ❌ "기능 동일" → ✅ 구체적 grep/test 명령 사용

## Testing Strategy

이 변경은 문서/설정 수정이 주를 이루므로 런타임 테스트보다 정적 검증에 중점:

| 테스트 유형 | 대상 | 방법 |
|-------------|------|------|
| 기존 테스트 회귀 | ultrawork 전체 | `bun test tests/ultrawork/` — 기존 테스트 모두 통과 (V8) |
| Hook 실행 검증 | keyword-detector.js | `echo '{}' \| bun plugins/ultrawork/src/hooks/keyword-detector.js` — exit 0 (V9) |
| 패턴 존재 검증 | 모든 변경 파일 | V1-V7 grep/test 명령으로 정적 확인 |

---

## Execution Strategy

### Task Overview

| ID | Subject | Complexity | Blocked By |
|----|---------|------------|------------|
| 1 | keyword-detector.js 구현 키워드 확장 | standard | - |
| 2 | ultrawork-routing.md 규칙 생성 | standard | - |
| 3 | design-template.md Execution Strategy 분리 | standard | - |
| 4 | planning SKILL.md Phase 순서 변경 | standard | 3 |
| 5 | planner AGENT.md 순서 반영 | standard | 4 |
| 6 | ultrawork-plan.md 순서 반영 | standard | 4 |
| 7 | CLAUDE.md Phase transition 업데이트 | standard | 4 |
| verify | 최종 검증 (V1-V9) | complex | 1-7 |

### Execution Waves

```
Wave 1 (parallel): Task 1, 2, 3
Wave 2 (parallel): Task 4, 5, 6, 7  (depend on Task 3)
Wave 3: Verify
```

---

## Assumptions & Risks

### Assumptions
- keyword-detector.js의 UserPromptSubmit hook이 brainstorming 스킬 트리거보다 먼저 실행됨
- `.claude/rules/` 파일이 brainstorming 스킬의 auto-trigger를 override할 수 있음
- 기존 design doc 형식으로 작성된 세션이 새 planner와 호환됨

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Keyword detector false positive | Medium | Advisory mode (제안만, 강제 아님) |
| Rules 파일이 brainstorming을 override 못함 | High | 글로벌 rules로 배치 후 검증; 실패 시 keyword-detector에서 직접 brainstorming 차단 메시지 추가 |
| Design template 연속 수정 (1.8.0 → 1.9.0) | Low | 변경 최소화, 섹션 위치 이동만 |
| 기존 세션 호환성 | Low | Planner가 Execution Strategy 존재 여부 적응적 처리 |

---

## Self-Containedness Checklist

- [x] Context Orientation만 읽고 이 프로젝트/변경이 뭔지 알 수 있는가?
- [x] 모든 Criterion에 실행 명령과 기대 출력이 있는가? (V1-V9)
- [x] Impact Analysis의 모든 소비자에 대한 처리 방안이 있는가?
- [x] 문서에 없는 결정을 worker가 내려야 하는 상황이 있는가? → keyword 목록 확장 시 worker가 판단 필요하나 D2에서 범위 정의됨
- [x] "기능 동일", "정상 동작" 같은 주관적 표현이 없는가? → 없음
