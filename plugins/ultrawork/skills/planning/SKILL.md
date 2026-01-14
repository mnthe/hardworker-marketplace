---
name: planning
description: "This skill should be used when designing implementation plans, decomposing complex work into tasks, or making architectural decisions during ultrawork sessions. Used by orchestrator (interactive mode) and planner agent (auto mode)."
---

# Planning Protocol

## Overview

Define how to analyze context, make design decisions, and decompose work into tasks.

**Two modes:**
- **Interactive**: Orchestrator conducts Deep Interview for decisions
- **Auto**: Planner agent makes decisions based on context alone (--auto or --skip-interview)

---

## Phase 1: Read Context

### Required Files

```
{SESSION_DIR}/
├── session.json        # Goal and metadata
├── context.json        # Summary/links from explorers
└── exploration/        # Detailed findings
    └── *.md
```

### Read Order

1. `session.json` - understand the goal
2. `context.json` - get summary, key files, patterns
3. `exploration/*.md` - read detailed markdown as needed

---

## Phase 2: Complexity Analysis

Analyze goal and context to determine interview depth.

### Complexity Signals

| Signal | trivial | standard | complex | massive |
|--------|---------|----------|---------|---------|
| File count | 1-2 | 3-5 | 6-10 | 10+ |
| Keywords | fix, typo, add | implement, create | refactor, redesign | migrate, rewrite |
| System impact | None | Single module | Multi-module | Entire system |
| Dependencies | None | Internal only | External 1-2 | External many |

### Suggested Interview Rounds

| Complexity | Rounds | Total Questions |
|------------|--------|-----------------|
| trivial | 1 | 4-5 |
| standard | 2 | 8-10 |
| complex | 3 | 12-15 |
| massive | 4 | 16-20 |

**Note**: User can always request more rounds via adaptive check. No upper limit.

---

## Phase 3: Deep Interview (Interactive Mode)

**Skip if**: `--auto` or `--skip-interview` flag set

### Interview Structure

Each round asks 4-5 questions using AskUserQuestion (max 4 questions per call).

### Context-Aware Option Generation

**CRITICAL**: Options marked `[...]` MUST be generated from exploration context, NOT generic templates.

#### Generation Process

1. **Read context.json** → Extract patterns, key_files, tech stack
2. **Read exploration/*.md** → Find specific implementations, naming conventions
3. **Generate options** that reflect actual codebase discoveries

#### Option Generation Rules

| Question Type | Generate Options From |
|--------------|----------------------|
| Architecture | Existing patterns in codebase (e.g., "Repository pattern like UserRepository") |
| Tech Stack | Already used libraries + compatible alternatives |
| Data Model | Existing schemas, naming conventions, relationships |
| Error Handling | Current error patterns, existing error classes |
| Concurrency | Existing async patterns, locks, queues found |
| Security | Current auth methods, validation patterns |
| UI/UX | Existing component styles, design system |
| Observability | Current logging setup, metrics if any |

#### Example: Context-Aware vs Generic

**BAD (Generic)**:
```python
"options": [
  {"label": "Repository Pattern", "description": "Data access abstraction"},
  {"label": "Active Record", "description": "ORM pattern"},
  {"label": "Raw SQL", "description": "Direct queries"}
]
```

**GOOD (Context-Aware)**:
```python
# After reading: "Found src/repositories/UserRepository.ts using Prisma"
"options": [
  {"label": "Prisma Repository (Recommended)", "description": "UserRepository 패턴 따름, src/repositories/에 생성"},
  {"label": "Prisma Direct", "description": "Repository 없이 직접 prisma client 사용"},
  {"label": "새 패턴 도입", "description": "다른 방식 제안 (Other에서 설명)"}
]
```

#### Domain-Specific Question Templates

Based on goal keywords, add relevant questions:

| Goal Contains | Add Questions About |
|--------------|---------------------|
| API, endpoint | Request/Response format, versioning, rate limiting |
| auth, login | Session vs JWT, OAuth providers, MFA |
| database, schema | Migration strategy, indexing, relationships |
| UI, frontend | Component library, state management, routing |
| test, coverage | Unit vs integration, mocking strategy, CI |
| refactor | Breaking changes, migration path, rollback |
| performance | Metrics baseline, caching, lazy loading |
| security | OWASP concerns, audit logging, encryption |

### Round Categories

#### Round 1: Intent & Scope (All complexities)

```python
AskUserQuestion(questions=[
  {
    "question": "핵심 목표가 X인데, Y와 Z 중 어느 방향에 가깝나요?",
    "header": "Intent",
    "options": [
      {"label": "Y 방향", "description": "..."},
      {"label": "Z 방향", "description": "..."},
      {"label": "둘 다", "description": "..."}
    ],
    "multiSelect": False
  },
  {
    "question": "이 기능의 범위는 어디까지인가요?",
    "header": "Scope",
    "options": [
      {"label": "최소 구현 (MVP)", "description": "핵심 기능만"},
      {"label": "표준 구현", "description": "일반적인 수준"},
      {"label": "완전 구현", "description": "모든 엣지케이스 포함"}
    ],
    "multiSelect": False
  },
  {
    "question": "기존 코드/시스템과의 관계는?",
    "header": "Integration",
    "options": [
      {"label": "독립적", "description": "기존 코드 영향 없음"},
      {"label": "확장", "description": "기존 코드에 추가"},
      {"label": "수정", "description": "기존 코드 변경 필요"}
    ],
    "multiSelect": False
  },
  {
    "question": "성공 기준은 무엇인가요?",
    "header": "Success",
    "options": [
      {"label": "테스트 통과", "description": "자동화 테스트 기준"},
      {"label": "수동 검증", "description": "직접 확인"},
      {"label": "둘 다", "description": "테스트 + 수동 검증"}
    ],
    "multiSelect": False
  }
])
```

#### Round 2: Technical Decisions (standard+)

```python
AskUserQuestion(questions=[
  {
    "question": "아키텍처 패턴은 어떻게 할까요?",
    "header": "Architecture",
    "options": [...],
    "multiSelect": False
  },
  {
    "question": "사용할 라이브러리/기술 스택은?",
    "header": "Tech Stack",
    "options": [...],
    "multiSelect": True  # 다중 선택 가능
  },
  {
    "question": "데이터 모델/스키마 방향은?",
    "header": "Data Model",
    "options": [...],
    "multiSelect": False
  },
  {
    "question": "테스트 전략은? (TDD 권장)",
    "header": "Testing",
    "options": [
      {"label": "TDD (Recommended)", "description": "테스트 먼저 작성"},
      {"label": "Standard", "description": "구현 후 테스트"},
      {"label": "Mixed", "description": "핵심 로직만 TDD"}
    ],
    "multiSelect": False
  }
])
```

#### Round 3: Edge Cases & Error Handling (complex+)

```python
AskUserQuestion(questions=[
  {
    "question": "예상되는 에러 시나리오와 처리 방식은?",
    "header": "Errors",
    "options": [...],
    "multiSelect": True
  },
  {
    "question": "동시성/경쟁 조건 고려가 필요한가요?",
    "header": "Concurrency",
    "options": [...],
    "multiSelect": False
  },
  {
    "question": "성능 요구사항이 있나요?",
    "header": "Performance",
    "options": [...],
    "multiSelect": False
  },
  {
    "question": "보안 고려사항은?",
    "header": "Security",
    "options": [...],
    "multiSelect": True
  }
])
```

#### Round 4: Polish & Integration (massive)

```python
AskUserQuestion(questions=[
  {
    "question": "UI/UX 세부사항은?",
    "header": "UI/UX",
    "options": [...],
    "multiSelect": False
  },
  {
    "question": "로깅/모니터링 요구사항은?",
    "header": "Observability",
    "options": [...],
    "multiSelect": True
  },
  {
    "question": "문서화 범위는?",
    "header": "Documentation",
    "options": [...],
    "multiSelect": False
  },
  {
    "question": "배포/롤백 전략은?",
    "header": "Deployment",
    "options": [...],
    "multiSelect": False
  }
])
```

#### Round 5+: Freeform (User-requested)

If user requests additional rounds:

```python
AskUserQuestion(questions=[
  {
    "question": "추가로 논의하고 싶은 영역을 선택해주세요",
    "header": "Topics",
    "options": [
      {"label": "기술 세부사항", "description": "구현 방식 심화"},
      {"label": "엣지케이스", "description": "예외 상황 추가"},
      {"label": "성능 최적화", "description": "성능 관련 결정"},
      {"label": "기타", "description": "다른 주제"}
    ],
    "multiSelect": True
  }
])
```

Then ask questions specific to selected topics.

### Adaptive Check (After Each Round)

```python
AskUserQuestion(questions=[{
  "question": f"Round {n} 완료. 계속할까요?",
  "header": "Continue",
  "options": [
    {"label": "충분함", "description": "Plan 작성으로 진행"},
    {"label": "계속", "description": "다음 라운드 진행"}
  ],
  "multiSelect": False
}])
```

- **"충분함"** → Exit interview, proceed to Phase 4
- **"계속"** → Next round (no upper limit)

### Recording Decisions

After each round, record decisions:

```markdown
## Interview Round {n}: {Category}

| Question | Answer | Notes |
|----------|--------|-------|
| Intent direction | Y approach | User prefers simplicity |
| Scope | MVP | Phase 2 for extras |
```

---

## Phase 4: Document Design

**IMPORTANT: Design documents go to PROJECT directory.**

```bash
WORKING_DIR=$(bun $SCRIPTS/session-get.js --session {SESSION_ID} --field working_dir)
DESIGN_PATH="$WORKING_DIR/docs/plans/$(date +%Y-%m-%d)-{goal-slug}-design.md"
```

Write comprehensive design.md including:
- Overview and approach selection
- **Interview decisions with rationale** (from Phase 3)
- Architecture and components
- Error handling strategy
- Testing strategy
- Scope (in/out)

See `references/design-template.md` for complete template.

---

## Phase 5: Decompose Tasks

### Task Granularity

| Rule | Guideline |
|------|-----------|
| One task = one deliverable | Single focused outcome |
| Max time | ~30 minutes of work |
| Testable | Has clear success criteria |

### Complexity Guidelines

| Complexity | Model | When |
|------------|-------|------|
| `standard` | sonnet | CRUD, simple features, tests |
| `complex` | opus | Architecture, security, 5+ files |

### Dependency Patterns

```
Independent      → blockedBy: []
Sequential       → blockedBy: ["1"]
Multi-dependency → blockedBy: ["1","2"]
Verify task      → blockedBy: [all]
```

### Create Tasks

```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

# Standard task
bun $SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "1" \
  --subject "Task title" \
  --description "Detailed description" \
  --complexity standard \
  --criteria "criterion1|criterion2"

# TDD task - requires test-first evidence
bun $SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "2" \
  --subject "Add validateUser function" \
  --description "Create validation function with TDD approach" \
  --complexity standard \
  --approach tdd \
  --test-file "tests/validateUser.test.ts" \
  --criteria "TDD-RED: Test fails initially|TDD-GREEN: Test passes after implementation"

# Always include verify task
bun $SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "verify" \
  --subject "[VERIFY] Integration verification" \
  --description "Verify all flows work end-to-end" \
  --blocked-by "1,2,3" \
  --complexity complex \
  --criteria "All tests pass|Manual verification works"
```

---

## Output Summary

Return planning summary:

```markdown
# Planning Complete

## Complexity Assessment
- **Detected**: {complexity}
- **Interview Rounds**: {n} rounds completed
- **Mode**: Interactive / Auto

## Interview Decisions
| Round | Topic | Decision | Notes |
|-------|-------|----------|-------|
| 1 | Intent | Y approach | User preference |
| 1 | Scope | MVP | Phase 2 later |
| 2 | Testing | TDD | Core logic only |

## Task Graph
| ID | Subject | Blocked By | Complexity | Approach |
|----|---------|------------|------------|----------|
| 1 | Setup auth | - | standard | standard |
| 2 | User model | 1 | standard | tdd |
| verify | Verification | 1,2 | complex | standard |

## Files Created
- {WORKING_DIR}/docs/plans/YYYY-MM-DD-design.md
- {SESSION_DIR}/tasks/*.json
```

---

## Flag Reference

| Flag | Effect on Interview |
|------|---------------------|
| (default) | Full Deep Interview based on complexity |
| `--skip-interview` | Skip interview, use ad-hoc AskUserQuestion as needed |
| `--auto` | Skip interview, auto-decide all choices |

---

## Additional Resources

### Reference Files

- **`references/brainstorm-protocol.md`** - Interactive question flow and approach exploration
- **`references/design-template.md`** - Complete design document template
- **`references/task-examples.md`** - Task decomposition examples with script commands
