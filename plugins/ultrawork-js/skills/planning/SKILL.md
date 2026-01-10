---
name: planning
description: "Design exploration and task decomposition protocol. Used by orchestrator (interactive) and planner agent (auto)."
---

# Planning Protocol

## Overview

This skill defines how to analyze context, make design decisions, and decompose work into tasks.

**Two modes:**
- **Interactive**: Orchestrator uses AskUserQuestion for decisions
- **Auto**: Planner agent makes decisions based on context alone

---

## Phase 1: Read Context

### Required Files
```
{SESSION_DIR}/
├── session.json        # Goal and metadata (JSON)
├── context.json        # Summary/links from explorers (JSON)
└── exploration/        # Detailed findings (Markdown)
    ├── exp-1.md
    └── ...
```

### Read Order
1. `session.json` - understand the goal
2. `context.json` - get summary, key files, patterns, links to details
3. `exploration/*.md` - read detailed markdown as needed

```bash
# Read session
cat {SESSION_DIR}/session.json

# Read context summary (lightweight)
cat {SESSION_DIR}/context.json

# List available explorations
ls {SESSION_DIR}/exploration/

# Read detailed exploration as needed
cat {SESSION_DIR}/exploration/exp-1.md
```

---

## Phase 2: Identify Decisions

Analyze the goal against context to find:

### Decision Categories

| Category | Examples | Priority |
|----------|----------|----------|
| **Ambiguous Requirements** | "auth" → OAuth? Email? Both? | High |
| **Architecture Choices** | DB type, framework, patterns | High |
| **Library Selection** | Which packages to use | Medium |
| **Scope Boundaries** | What's in/out of scope | Medium |
| **Priority/Order** | Which features first | Low |

### Decision Template
```json
{
  "topic": "Authentication method",
  "options": [
    {"label": "OAuth only", "description": "Google/GitHub login"},
    {"label": "Email/Password", "description": "Traditional credentials"},
    {"label": "Both", "description": "OAuth + credentials"}
  ],
  "recommendation": "Both",
  "rationale": "Flexibility for users without social accounts"
}
```

---

## Phase 3: Make Decisions (Brainstorm Protocol)

### Interactive Mode (Orchestrator)

**Core Principle: Turn ambiguous ideas into clear, validated designs through dialogue.**

#### The Flow

```
For each decision point:
  1. Present brief context (what you found)
  2. Ask ONE question with options
  3. Wait for response
  4. Record decision
  5. Move to next question
```

#### Question Rules

| Rule | Description |
|------|-------------|
| **One at a time** | Never batch multiple questions in one message |
| **Multiple choice** | Prefer options over open-ended when possible |
| **Recommend** | Add "(Recommended)" to your suggested option |
| **Max 4 options** | Keep choices manageable |
| **Lead with why** | Briefly explain why you're asking |

#### Question Template

```python
# Before asking, provide brief context
"""
Based on exploration, the project uses Next.js App Router
and has no existing auth implementation.
"""

AskUserQuestion(questions=[{
  "question": "Which authentication method should we implement?",
  "header": "Auth",  # Short label (max 12 chars)
  "options": [
    {"label": "OAuth + Email (Recommended)", "description": "Most flexible, supports both"},
    {"label": "OAuth only", "description": "Simpler, relies on social providers"},
    {"label": "Email only", "description": "Traditional, no third-party deps"}
  ],
  "multiSelect": False
}])
```

#### Question Priority Order

Ask in this order (skip if already clear):

1. **Purpose/Goal** - What problem does this solve? Core objective?
2. **Scope** - MVP / Full / Prototype?
3. **Constraints** - Performance, security, compatibility requirements?
4. **Architecture** - Follow existing patterns / New patterns / Hybrid?
5. **Libraries** - Which packages to use?

#### Exploring Approaches (Critical)

**Before settling on a design, ALWAYS propose 2-3 approaches:**

```markdown
## Approach Options

### Option A: NextAuth.js (Recommended)
- **Pros**: Next.js standard, built-in OAuth, active community
- **Cons**: Limited customization, learning curve
- **Best for**: Quick implementation, standard auth flows

### Option B: Passport.js
- **Pros**: Flexible strategy pattern, many providers
- **Cons**: Complex setup, separate Next.js integration needed
- **Best for**: Complex custom requirements

### Option C: Custom Implementation
- **Pros**: Full control, minimal dependencies
- **Cons**: Security risks, development time
- **Best for**: Very specialized requirements

**Recommendation**: Option A - Project is Next.js based, standard auth flow is sufficient
```

Then ask:
```python
AskUserQuestion(questions=[{
  "question": "Which approach should we use?",
  "header": "Approach",
  "options": [
    {"label": "Option A (Recommended)", "description": "NextAuth.js - fast, standard"},
    {"label": "Option B", "description": "Passport.js - flexible customization"},
    {"label": "Option C", "description": "Custom - full control"}
  ],
  "multiSelect": False
}])
```

#### Red Flags (Ask More Questions)

Stop and ask if you notice:

| Signal | Example | Action |
|--------|---------|--------|
| Vague scope | "Add login feature" | Ask about OAuth/email/both |
| Multiple approaches | REST vs GraphQL | Ask preference |
| Missing constraints | No perf requirements | Ask about scale |
| Ambiguous terms | "quickly", "simple" | Clarify meaning |

#### Incremental Design Presentation

After decisions are made, present design in small sections:

```
Section 1: Overview (200-300 words)
  → Ask: "Does the overview look correct?"

Section 2: Architecture (200-300 words)
  → Ask: "Is the architecture appropriate?"

Section 3: Scope (200-300 words)
  → Ask: "Is the scope correct?"
```

**After each section:**
```python
AskUserQuestion(questions=[{
  "question": "Does this section look correct?",
  "header": "Review",
  "options": [
    {"label": "Yes, continue", "description": "Move to next section"},
    {"label": "Needs changes", "description": "I have feedback"}
  ],
  "multiSelect": False
}])
```

If "Needs changes" → get feedback, adjust, re-present that section.

---

### Auto Mode (Planner Agent)

Make decisions automatically (no user interaction available):

```
For each decision:
  1. Analyze context for signals
  2. Choose based on:
     - Existing patterns in codebase
     - Dependencies already present
     - Common best practices
  3. Record choice with rationale
  4. Mark asked_user: false
```

**Auto Decision Heuristics:**
- If existing pattern exists → follow it
- If dependency present → use it
- If multiple valid options → choose most common/standard
- When unsure → prefer simpler, reversible choices

---

## Phase 4: Document Design

**IMPORTANT: Design documents go to PROJECT directory (NOT session directory).**

```bash
# Get working directory from session
WORKING_DIR=$($SCRIPTS/session-get.js --session {SESSION_ID} --field working_dir)

# Design document path
# Format: {working_dir}/docs/plans/YYYY-MM-DD-{goal-slug}-design.md
DESIGN_PATH="$WORKING_DIR/docs/plans/$(date +%Y-%m-%d)-{goal-slug}-design.md"

# Create directory if needed
mkdir -p "$WORKING_DIR/docs/plans"
```

Write design.md to **project directory** using Write tool.

Be thorough and detailed - this document guides all implementation work.

### design.md Template

```markdown
# Design: {Goal}

## Overview
[High-level description of what will be built]

## Approach Selection

### Considered Options
| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| Option A (Selected) | ... | ... | Best for our case |
| Option B | ... | ... | ... |
| Option C | ... | ... | ... |

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

## Error Handling

### Error Categories
| Category | Example | Handling Strategy |
|----------|---------|-------------------|
| Validation | Invalid input | Return 400 with details |
| Auth | Invalid token | Return 401, redirect to login |
| Not Found | Resource missing | Return 404 |
| Server | DB connection fail | Return 500, log, alert |

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

## Testing Strategy

### Test Levels
| Level | Coverage | Tools |
|-------|----------|-------|
| Unit | Business logic, utils | Jest/Vitest |
| Integration | API endpoints, DB | Supertest |
| E2E | Critical user flows | Playwright/Cypress |

### Key Test Cases
- [ ] Happy path: [describe]
- [ ] Edge case: [describe]
- [ ] Error case: [describe]
- [ ] Auth: [describe]

### Test Data
- Fixtures location: `__tests__/fixtures/`
- Mock strategy: [describe]

## Documentation

### Code Documentation
- JSDoc for public APIs
- README for each module (if complex)
- Inline comments for non-obvious logic only

### API Documentation
- OpenAPI/Swagger spec location: `docs/api/`
- Auto-generated from code annotations

### User Documentation
- [ ] Feature guide in docs/
- [ ] Changelog entry
- [ ] Migration guide (if breaking changes)

## Scope

### In Scope
- Feature 1
- Feature 2

### Out of Scope
- Future feature 1
- Future feature 2

## Assumptions
1. [Assumption 1]
2. [Assumption 2]

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk 1] | High/Med/Low | [How to mitigate] |
| [Risk 2] | High/Med/Low | [How to mitigate] |
```

---

## Phase 5: Decompose Tasks

### Task Granularity Rules
- One task = one discrete deliverable
- Max ~30 minutes of focused work
- Can be completed by single worker
- Has testable success criteria

### Task Template
```json
{
  "id": "1",
  "subject": "Clear, actionable title",
  "description": "Specific deliverable with context",
  "complexity": "standard|complex",
  "blockedBy": [],
  "criteria": [
    "Testable condition 1",
    "Testable condition 2"
  ]
}
```

### Complexity Guidelines
| Complexity | Model | When |
|------------|-------|------|
| `standard` | sonnet | CRUD, simple features, tests, straightforward changes |
| `complex` | opus | Architecture, security, algorithms, 5+ files |

### Dependency Patterns
```
Independent tasks      → blockedBy: []     (parallel)
Sequential dependency  → blockedBy: ["1"]  (after task 1)
Multi-dependency      → blockedBy: ["1","2"] (after both)
Verify task           → blockedBy: [all]   (after everything)
```

---

## Task Decomposition Examples

### Example 1: OAuth Authentication Feature

**Goal**: "Add OAuth authentication with Google"

**Task Breakdown**:

```
Wave 1 (Parallel - no dependencies):
├─ Task 1: Setup NextAuth.js [standard]
│  └─ Install nextauth, create config, add env vars
│
└─ Task 2: Create user database schema [standard]
   └─ Add User model with OAuth fields

Wave 2 (After Wave 1):
├─ Task 3: Implement auth API routes [standard]
│  └─ Depends on: [1]
│  └─ /api/auth/[...nextauth]/route.ts
│
├─ Task 4: Add session provider [standard]
│  └─ Depends on: [1]
│  └─ Wrap app with SessionProvider in layout.tsx
│
└─ Task 5: Create login UI [standard]
   └─ Depends on: [1, 4]
   └─ Login button, callback page

Wave 3 (Verification):
└─ Task 6: [VERIFY] Auth integration [complex]
   └─ Depends on: [1, 2, 3, 4, 5]
   └─ Test OAuth flow, session persistence, logout
```

**Script Commands**:
```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/dist/scripts"

# Wave 1 - Independent
$SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "1" \
  --subject "Setup NextAuth.js configuration" \
  --description "Install next-auth@5, create auth config with Google provider, add environment variables" \
  --complexity standard \
  --criteria "next-auth installed|auth.ts config created|GOOGLE_CLIENT_ID in .env"

$SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "2" \
  --subject "Create user database schema" \
  --description "Add User model to Prisma schema with OAuth fields (id, email, name, image, provider)" \
  --complexity standard \
  --criteria "Schema updated|Migration created|Types generated"

# Wave 2 - Sequential
$SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "3" \
  --subject "Implement auth API routes" \
  --description "Create /api/auth/[...nextauth]/route.ts with NextAuth handler" \
  --blocked-by "1" \
  --complexity standard \
  --criteria "Route file created|Auth endpoints respond 200"

$SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "4" \
  --subject "Add session provider to app" \
  --description "Wrap root layout with SessionProvider from next-auth/react" \
  --blocked-by "1" \
  --complexity standard \
  --criteria "SessionProvider added|useSession hook works"

$SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "5" \
  --subject "Create login UI components" \
  --description "Add login button, callback page, user menu with signOut" \
  --blocked-by "1,4" \
  --complexity standard \
  --criteria "Login button works|Callback page created|User menu functional"

# Wave 3 - Verification
$SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "verify" \
  --subject "[VERIFY] OAuth authentication integration" \
  --description "Verify complete OAuth flow: login, session persistence, user data storage, logout" \
  --blocked-by "1,2,3,4,5" \
  --complexity complex \
  --criteria "OAuth login succeeds|Session persists across refreshes|User data in DB|Logout works"
```

### Example 2: Database Migration (Prisma)

**Goal**: "Migrate from direct SQL to Prisma ORM"

**Task Breakdown**:

```
Wave 1 (Foundation):
└─ Task 1: Setup Prisma and define schema [standard]
   └─ Install prisma, create schema from existing tables

Wave 2 (Migration):
├─ Task 2: Migrate user queries [standard]
│  └─ Depends on: [1]
│  └─ Replace SQL in user.service.ts
│
├─ Task 3: Migrate post queries [standard]
│  └─ Depends on: [1]
│  └─ Replace SQL in post.service.ts
│
└─ Task 4: Migrate auth queries [standard]
   └─ Depends on: [1]
   └─ Replace SQL in auth.service.ts

Wave 3 (Testing):
├─ Task 5: Update unit tests [standard]
│  └─ Depends on: [2, 3, 4]
│  └─ Mock Prisma client in tests
│
└─ Task 6: Update integration tests [standard]
   └─ Depends on: [2, 3, 4]
   └─ Use test database with Prisma

Wave 4 (Verification):
└─ Task 7: [VERIFY] Migration complete [complex]
   └─ Depends on: [all]
   └─ All queries work, tests pass, no SQL strings remain
```

**Key Considerations**:
- Task 1 must complete first (foundation)
- Tasks 2-4 can run in parallel (independent services)
- Tasks 5-6 can run in parallel (different test types)
- Task 7 verifies everything together

---

### Create Tasks
```bash
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/dist/scripts"

# Create each task (see examples above for realistic scenarios)
$SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "1" \
  --subject "Setup NextAuth.js provider" \
  --description "Configure NextAuth with Google OAuth" \
  --complexity standard \
  --criteria "Auth routes respond|OAuth flow works"

# Always include verify task
$SCRIPTS/task-create.js --session {SESSION_ID} \
  --id "verify" \
  --subject "[VERIFY] Integration verification" \
  --description "Verify all auth flows work end-to-end" \
  --blocked-by "1,2,3" \
  --complexity complex \
  --criteria "All tests pass|Manual login works"
```

---

## Output Summary

Return planning summary:

```markdown
# Planning Complete

## Design Decisions
| Topic | Choice | User Asked |
|-------|--------|------------|
| Auth method | OAuth + Credentials | Yes |
| Session storage | JWT | No (auto) |

## Task Graph
| ID | Subject | Blocked By | Complexity |
|----|---------|------------|------------|
| 1 | Setup NextAuth | - | standard |
| 2 | User model | 1 | standard |
| 3 | Login UI | 1 | standard |
| verify | Verification | 1,2,3 | complex |

## Parallel Waves
1. **Wave 1**: [1] - start immediately
2. **Wave 2**: [2, 3] - after wave 1
3. **Wave 3**: [verify] - after all

## Files Created
- {WORKING_DIR}/docs/plans/YYYY-MM-DD-{goal-slug}-design.md  # Project directory
- {SESSION_DIR}/tasks/1.json                                  # Session directory
- {SESSION_DIR}/tasks/2.json
- {SESSION_DIR}/tasks/3.json
- {SESSION_DIR}/tasks/verify.json
```

---

## YAGNI Checklist

Before finalizing, verify:

- [ ] No features beyond stated goal
- [ ] No "future-proofing" abstractions
- [ ] No optional enhancements
- [ ] Minimum viable scope only
