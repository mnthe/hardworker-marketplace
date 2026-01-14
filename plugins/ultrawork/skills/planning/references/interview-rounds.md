# Deep Interview Round Templates

## Overview

This document provides detailed templates for each interview round. The planner adjusts depth based on complexity analysis.

## Round Categories

### Round 1: Intent & Scope (All complexities)

**Purpose**: Clarify core goal, define boundaries, and establish success criteria.

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

---

### Round 2: Technical Decisions (standard+)

**Purpose**: Architecture patterns, tech stack, data model, and testing approach.

```python
AskUserQuestion(questions=[
  {
    "question": "아키텍처 패턴은 어떻게 할까요?",
    "header": "Architecture",
    "options": [...],  # Generate from context
    "multiSelect": False
  },
  {
    "question": "사용할 라이브러리/기술 스택은?",
    "header": "Tech Stack",
    "options": [...],  # Generate from context
    "multiSelect": True  # 다중 선택 가능
  },
  {
    "question": "데이터 모델/스키마 방향은?",
    "header": "Data Model",
    "options": [...],  # Generate from context
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

---

### Round 3: Edge Cases & Error Handling (complex+)

**Purpose**: Error scenarios, concurrency, performance, and security considerations.

```python
AskUserQuestion(questions=[
  {
    "question": "예상되는 에러 시나리오와 처리 방식은?",
    "header": "Errors",
    "options": [...],  # Generate from context
    "multiSelect": True
  },
  {
    "question": "동시성/경쟁 조건 고려가 필요한가요?",
    "header": "Concurrency",
    "options": [...],  # Generate from context
    "multiSelect": False
  },
  {
    "question": "성능 요구사항이 있나요?",
    "header": "Performance",
    "options": [...],  # Generate from context
    "multiSelect": False
  },
  {
    "question": "보안 고려사항은?",
    "header": "Security",
    "options": [...],  # Generate from context
    "multiSelect": True
  }
])
```

---

### Round 4: Polish & Integration (massive)

**Purpose**: UI/UX details, observability, documentation, and deployment.

```python
AskUserQuestion(questions=[
  {
    "question": "UI/UX 세부사항은?",
    "header": "UI/UX",
    "options": [...],  # Generate from context
    "multiSelect": False
  },
  {
    "question": "로깅/모니터링 요구사항은?",
    "header": "Observability",
    "options": [...],  # Generate from context
    "multiSelect": True
  },
  {
    "question": "문서화 범위는?",
    "header": "Documentation",
    "options": [...],  # Generate from context
    "multiSelect": False
  },
  {
    "question": "배포/롤백 전략은?",
    "header": "Deployment",
    "options": [...],  # Generate from context
    "multiSelect": False
  }
])
```

---

### Round 5+: Freeform (User-requested)

**Purpose**: Additional topics based on user request via adaptive check.

```python
# First, ask what topics to explore
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

# Then ask questions specific to selected topics
```

---

## Adaptive Check (After Each Round)

After completing each round, ask if user wants to continue:

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

**Behavior**:
- **"충분함"** → Exit interview, proceed to Phase 4 (Document Design)
- **"계속"** → Next round (no upper limit)

---

## Recording Decisions

After each round, record decisions in markdown format for design document:

```markdown
## Interview Round {n}: {Category}

| Question | Answer | Notes |
|----------|--------|-------|
| Intent direction | Y approach | User prefers simplicity |
| Scope | MVP | Phase 2 for extras |
| Testing | TDD | Core logic only |
```

This record will be included in the design document created in Phase 4.

---

## Domain-Specific Question Templates

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
