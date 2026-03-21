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

Read session files in order:
1. `session.json` - goal and metadata
2. `context.json` - summary, key files, patterns from explorers
3. `exploration/*.md` - detailed findings as needed

---

## Phase 2: Complexity Analysis

Analyze goal and context to determine interview depth:

| Complexity | Files | Keywords | Impact | Rounds |
|------------|-------|----------|--------|--------|
| trivial | 1-2 | fix, typo, add | None | 1 (4-5 Q) |
| standard | 3-5 | implement, create | Single module | 2 (8-10 Q) |
| complex | 6-10 | refactor, redesign | Multi-module | 3 (12-15 Q) |
| massive | 10+ | migrate, rewrite | Entire system | 4 (16-20 Q) |

**Note**: User can request more rounds via adaptive check. No upper limit.

---

## Phase 3: Deep Interview (Interactive Mode)

**Skip if**: `--auto` or `--skip-interview` flag set

### Interview Structure

Each round asks 4-5 questions using AskUserQuestion (max 4 questions per call).

### Context-Aware Options (CRITICAL)

**Options marked `[...]` MUST be generated from exploration context, NOT generic templates.**

See `references/context-aware-options.md` for:
- Generation process from context.json and exploration/*.md
- Option generation rules by question type
- Context-aware vs generic examples
- Validation checklist

### Data-Driven Interview Questions

Interview questions must be generated from exploration data, not generic templates.

#### Question Generation Rules

**BAD (generic):** "어떤 아키텍처 패턴을 사용할까요?"
**GOOD (data-driven):** "graph/service.go가 2곳에서 사용됩니다. 두 곳 모두 동시에 변경할까요?"

**Formula:** [탐색에서 발견한 사실] + [그로 인한 설계 선택지] + [각 선택지의 trade-off]

#### Interview Question → Design Section Mapping

| Question Category | Design Section |
|---|---|
| "어떤 접근법?" | Approach Selection, Decisions |
| "영향 범위는?" | Impact Analysis |
| "성공 기준은?" | Verification Strategy |
| "위험 요소는?" | Assumptions & Risks |
| "테스트 방법은?" | Verification Strategy |

### Interview Rounds

Rounds are adjusted based on complexity assessment:

| Complexity | Rounds | Focus Areas |
|------------|--------|-------------|
| trivial | 1 | Intent, Scope, Success criteria |
| standard | 2 | + Technical decisions (arch, tech stack, testing) |
| complex | 3 | + Edge cases, errors, concurrency, performance |
| massive | 4 | + UI/UX, observability, documentation, deployment |

**Note**: User can request additional rounds via adaptive check. No upper limit.

See `references/interview-rounds.md` for:
- Detailed question templates for each round
- Domain-specific question templates
- Adaptive check pattern
- Decision recording format

---

## Phase 4: Document Design

**IMPORTANT: Design documents go to PROJECT directory.**

```bash
WORKING_DIR=$(bun $SCRIPTS/session-get.js --session ${CLAUDE_SESSION_ID} --field working_dir)
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

### Self-Containedness Check

After writing the design document, the planner performs a self-containedness check:

- [ ] Context Orientation만 읽고 이 프로젝트가 뭔지 알 수 있는가?
- [ ] 모든 Criterion에 실행 명령과 기대 출력이 있는가?
- [ ] Impact Analysis의 모든 소비자에 대한 처리 방안이 있는가?
- [ ] 문서에 없는 결정을 worker가 내려야 하는 상황이 있는가?
- [ ] "기능 동일", "정상 동작" 같은 주관적 표현이 없는가?

If any check fails, fix the design document before proceeding to Codex doc-review.

---

## Phase 4.5: Codex Doc-Review

After writing the design document, validate it via Codex doc-review.

```bash
bun $SCRIPTS/codex-verify.js \
  --mode doc-review \
  --design "$DESIGN_PATH" \
  --goal "${GOAL}" \
  --output /tmp/codex-doc-${CLAUDE_SESSION_ID}.json
```

**Result Handling:**

| Verdict | Action |
|---------|--------|
| PASS | Continue to Phase 5 (Task Decomposition) |
| SKIP | Codex not installed — continue (graceful degradation) |
| FAIL | Fix loop based on mode |

**Interactive Mode (default):**
1. Show `doc_issues` to user via AskUserQuestion
2. User confirms fix direction
3. Edit design document
4. Delete result file, re-run doc-review
5. Repeat until PASS or user skips

**Auto Mode (--auto):**
1. Read `doc_issues` from result
2. Auto-fix design document
3. Delete result file, re-run doc-review
4. Repeat (max 3 attempts)
5. If still FAIL → leave session in PLANNING, report

**CLI Error:** Retry once on execution failure. On repeated failure, report to user.

**Note:** A PreToolUse gate blocks `session-update.js --phase EXECUTION` without a passing Codex doc-review result at `/tmp/codex-doc-${CLAUDE_SESSION_ID}.json`.

---

## Phase 5: Decompose Tasks

### Write Execution Strategy (Post-Review)

After doc-review passes, add the Execution Strategy section to the design document.
This section was intentionally excluded from the initial design to allow doc-review to validate the pure design first.

See `references/design-template.md` for the Execution Strategy (Post-Review) template.

### Task Guidelines

| Aspect | Rule |
|--------|------|
| **Granularity** | One deliverable, ~30 min work, testable |
| **Complexity** | `standard` (sonnet) for CRUD/simple; `complex` (opus) for architecture/security |
| **Dependencies** | Independent `[]`, Sequential `["1"]`, Multi `["1","2"]`, Verify `[all]` |

### Create Tasks with Scripts

Use `task-create.js` for each task. Always include a final verify task.

See `references/task-examples.md` for:
- Complete script command examples
- Task decomposition patterns by feature type
- Dependency graph examples

---

## Output Summary

Return planning summary with:
- Complexity assessment and interview rounds completed
- Key decisions from interview (table format)
- Task graph showing IDs, subjects, dependencies, complexity
- Files created (design doc, task files)

---

## Flag Reference

| Flag | Effect on Interview |
|------|---------------------|
| (default) | Full Deep Interview based on complexity |
| `--skip-interview` | Skip interview, use ad-hoc AskUserQuestion as needed |
| `--auto` | Skip interview, auto-decide all choices |

## Additional Resources

### Reference Files

- **`references/brainstorm-protocol.md`** - Interactive question flow and approach exploration
- **`references/context-aware-options.md`** - Context-aware option generation rules and examples
- **`references/design-template.md`** - Complete design document template
- **`references/interview-rounds.md`** - Detailed interview round templates for all complexity levels
- **`references/task-examples.md`** - Task decomposition examples with script commands
