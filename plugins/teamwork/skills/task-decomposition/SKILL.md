---
name: task-decomposition
description: Hybrid task decomposition strategy for teamwork projects. Covers plan-based and semantic decomposition, granularity rules, role assignment, dependency management, and complexity assessment.
user-invocable: false
---

# Task Decomposition Strategy

This skill provides comprehensive guidelines for breaking down project goals into actionable tasks. Use this when planning teamwork projects to ensure optimal task granularity, proper role assignment, and appropriate complexity assessment.

---

## Hybrid Decomposition Strategy

Use a combination of plan-based (Strategy A) and semantic (Strategy B) decomposition:

### Strategy A: Plan Document Based

Use when `plans` option is provided with detailed implementation documents.

1. **Extract Steps**: Parse plan documents for Markdown headers (## Step N, ### Phase N)
2. **Map to Tasks**: Each header section becomes a task candidate
3. **Sub-decompose**: If a step mentions multiple files (>3), split into sub-tasks
4. **Verify Atomicity**: Each task should be completable in one worker session

Example transformation:
```
Plan: "03.impl-workspace-setup.md"
|- Step 1: Root workspace -> Task: "Initialize pnpm monorepo workspace"
|- Step 2.1: Database package -> Task: "Create database package structure"
|- Step 2.2: items schema -> Task: "Implement items.schema.ts"
|- Step 2.3: item-features schema -> Task: "Implement item-features.schema.ts with pgvector"
+- Step 3: Docker -> Task: "Configure Docker Compose for dev environment"
```

### Strategy B: Semantic Decomposition

Use when no plan documents provided, or as sub-decomposition within Strategy A.

1. **File-based**: New file creation = separate task
2. **Complexity-based**: Complex file with multiple classes -> split by class
3. **Dependency-based**: Interface and implementation = separate tasks
4. **Test-based**: Each independently testable unit = candidate task

---

## Granularity Rules

- 1 task = 1-3 files changed (recommended)
- 1 task = 10-30 minutes work (recommended)
- 1 task = independently testable/verifiable

### Anti-patterns (Avoid)

- "Setup entire workspace" (too broad)
- "Implement backend" (too vague)
- "Create all schemas" (bundles multiple files)

### Good patterns (Recommended)

- "Create items.schema.ts with Item table"
- "Add SearchUseCase with keyword search"
- "Configure Docker Compose for PostgreSQL"

---

## Task Creation with Native API

Create tasks using the native `TaskCreate` API:

```python
# Create a task
TaskCreate(
    subject="Implement items.schema.ts",
    description="Create PostgreSQL schema for items table with id, name, description, price columns. Include proper indexes.",
    activeForm="Implementing items schema"
)  # Returns task with auto-assigned ID
```

### Setting Dependencies

Use `TaskUpdate` with `addBlockedBy` to define task dependencies:

```python
# Task 1: no dependencies (can start immediately)
TaskCreate(subject="Setup database schema", description="...")  # -> task 1

# Task 2: depends on task 1
TaskCreate(subject="Implement auth middleware", description="...")  # -> task 2
TaskUpdate(taskId="2", addBlockedBy=["1"])

# Task 3: depends on task 2
TaskCreate(subject="Create login/signup UI", description="...")  # -> task 3
TaskUpdate(taskId="3", addBlockedBy=["2"])

# Task 4: depends on both task 1 and task 2
TaskCreate(subject="Write integration tests", description="...")  # -> task 4
TaskUpdate(taskId="4", addBlockedBy=["1", "2"])
```

### Dependency Rules

- **Minimize dependencies**: Maximize parallelism by only adding necessary `blockedBy` links
- **No circular dependencies**: Task A blocks B blocks A is invalid
- **Blocked tasks auto-unblock**: When all `blockedBy` tasks complete, the task becomes available for workers
- **Independent tasks have no blockedBy**: They can be picked up by any idle worker immediately

### Example: Full Task Creation

```python
# Foundation tasks (no dependencies)
TaskCreate(subject="Initialize project structure", description="...")      # -> task 1
TaskCreate(subject="Configure TypeScript and ESLint", description="...")  # -> task 2

# Core implementation (depends on foundation)
TaskCreate(subject="Create database models", description="...")           # -> task 3
TaskUpdate(taskId="3", addBlockedBy=["1"])

TaskCreate(subject="Implement REST API endpoints", description="...")     # -> task 4
TaskUpdate(taskId="4", addBlockedBy=["1", "3"])

TaskCreate(subject="Build React components", description="...")           # -> task 5
TaskUpdate(taskId="5", addBlockedBy=["2"])

# Integration (depends on both API and UI)
TaskCreate(subject="Connect frontend to API", description="...")          # -> task 6
TaskUpdate(taskId="6", addBlockedBy=["4", "5"])

# Testing (depends on integration)
TaskCreate(subject="Write E2E tests", description="...")                  # -> task 7
TaskUpdate(taskId="7", addBlockedBy=["6"])
```

This creates a natural execution order where independent tasks run in parallel and dependent tasks wait for their prerequisites.

---

## Role Assignment

Assign each task to the appropriate role based on its primary focus:

| Role       | When to Use                                |
| ---------- | ------------------------------------------ |
| `frontend` | UI, components, styling, user interactions |
| `backend`  | API, services, database, business logic    |
| `test`     | Tests, fixtures, mocks                     |
| `devops`   | CI/CD, deployment, infrastructure          |
| `docs`     | Documentation, README, examples            |
| `security` | Auth, permissions, input validation        |
| `review`   | Code review, refactoring                   |
| `general`  | Miscellaneous, cross-cutting               |

---

## Complexity Assessment

Workers use different models based on task complexity. Assign complexity to optimize resource usage:

| Complexity | Model | Criteria | Examples |
| ---------- | ----- | -------- | -------- |
| `simple`   | haiku | Single file, <10 lines, minor changes | Config updates, typo fixes, simple docs |
| `standard` | sonnet | 1-3 files, typical CRUD, straightforward | API endpoints, UI components, tests |
| `complex`  | opus | 5+ files, architecture, security-critical | Auth systems, DB migrations, major refactors |

### Guidelines for Complexity Assessment

- **simple**: Task is obvious, minimal thinking required, low risk
- **standard**: Task requires moderate planning, some decision-making
- **complex**: Task requires deep analysis, multiple considerations, high impact

### Decision Rules

**Default to `standard`** when uncertain. Upgrade to `complex` if:
- Task involves authentication/authorization
- Task touches database schema
- Task spans 5+ files
- Task has architectural implications
- Task is security-sensitive

---

## Structured Description Convention

Tasks should use structured descriptions with markdown sections to provide clear guidance to workers.

### Description Template

```markdown
## Description
What needs to be done (clear, actionable explanation)

## Approach
standard | tdd

## Success Criteria
- Criterion 1
- Criterion 2
- Criterion 3

## Verification Commands
command1
command2
```

### Section Definitions

| Section | Required | Default | Purpose |
|---------|----------|---------|---------|
| `## Description` | Yes | - | What needs to be done |
| `## Approach` | No | standard | `standard` or `tdd` workflow |
| `## Success Criteria` | Recommended | General evidence | Checklist for verification |
| `## Verification Commands` | Recommended | Skip | Commands workers run to verify |

### Approach Selection

| Task Type | Recommended Approach | Rationale |
|-----------|---------------------|-----------|
| New feature with clear spec | tdd | Test-first ensures spec compliance |
| Bug fix | tdd | Test reproduces bug first |
| Refactoring | standard | Existing tests cover behavior |
| Configuration/docs | standard | Not testable |
| Security-critical code | tdd | Security tests first |
| API endpoints | tdd | Contract-driven development |
| Database schema | standard | Migrations not test-driven |
| UI components | standard | Visual testing preferred |

### Success Criteria Guidelines

**Good criteria are:**
- **Specific**: "Tests pass: npm test -- tests/auth.test.ts (exit code 0)" not "Tests pass"
- **Verifiable**: Include commands or file paths
- **Complete**: Cover all aspects of the task
- **Independent**: Each criterion can be checked separately

**Examples:**

❌ **Vague:**
```
- Code works
- Tests pass
- No errors
```

✅ **Specific:**
```
- Auth middleware in src/middleware/auth.ts
- Tests pass: npm test -- tests/auth.test.ts (exit code 0)
- Invalid tokens return 401 status
- Type check passes: npx tsc --noEmit src/middleware/auth.ts
```

### Verification Commands Guidelines

**Include commands that:**
- Run relevant tests (scoped, not full suite)
- Type check modified files
- Run build (if applicable)
- Verify runtime behavior

**Examples:**

```bash
# Test commands (scoped)
npm test -- tests/feature.test.ts
bun test tests/feature.test.ts

# Type checking
npx tsc --noEmit src/file.ts

# Build verification
npm run build
bun run build

# Runtime checks
docker-compose up -d && docker-compose ps
curl -X POST http://localhost:3000/api/endpoint
```

**Do NOT include:**
- Full test suite commands (`npm test` without scope)
- Deployment commands
- Commands requiring manual verification
- Commands with side effects (database resets, etc.)

### Example: Backend Task (TDD)

```python
TaskCreate(
    subject="Implement user registration endpoint",
    description="""## Description
POST /api/auth/register endpoint with email/password validation, password hashing, and duplicate email check.

## Approach
tdd

## Success Criteria
- Test file created first (TDD-RED)
- Endpoint in src/api/auth/register.ts
- Tests pass: npm test -- tests/auth-register.test.ts (exit code 0)
- Duplicate emails return 409
- Weak passwords rejected with 400

## Verification Commands
npm test -- tests/auth-register.test.ts
npx tsc --noEmit src/api/auth/register.ts
""",
    activeForm="Implementing user registration"
)
```

### Example: Frontend Task (Standard)

```python
TaskCreate(
    subject="Create market card component",
    description="""## Description
React component displaying market name, description, current odds, and bet buttons. Include loading states and error handling.

## Approach
standard

## Success Criteria
- Component in src/components/MarketCard.tsx
- Tests pass: npm test -- tests/MarketCard.test.ts (exit code 0)
- Accessible: proper ARIA labels
- Responsive design for mobile/desktop

## Verification Commands
npm test -- tests/MarketCard.test.ts
npm run build
""",
    activeForm="Creating market card component"
)
```

### Example: DevOps Task (Standard)

```python
TaskCreate(
    subject="Configure CI/CD pipeline",
    description="""## Description
GitHub Actions workflow for automated testing and deployment. Run on every push to main. Deploy to Vercel on success.

## Approach
standard

## Success Criteria
- .github/workflows/ci.yml created
- Workflow runs on push to main
- Tests run in CI environment
- Deployment to Vercel on success

## Verification Commands
gh workflow view ci
gh run list --workflow=ci
""",
    activeForm="Configuring CI/CD pipeline"
)
```

---

## Best Practices

1. **Be specific** - Vague tasks get vague results
2. **Include context** - Description should be self-contained
3. **Maximize parallelism** - Minimize unnecessary `addBlockedBy` dependencies
4. **Granular tasks** - Prefer more smaller tasks over fewer large ones
5. **Clear acceptance criteria** - Workers need to know when task is complete
6. **Use structured descriptions** - All tasks should follow the markdown section format
7. **Choose appropriate approach** - TDD for new features/bugs, standard for refactoring/config
8. **Provide verification commands** - Workers need concrete commands to verify completion
