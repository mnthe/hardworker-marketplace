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
