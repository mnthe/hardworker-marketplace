# Interview Phase Reference

**Used by**: `ultrawork-plan.md` (interactive mode only)

**Purpose**: Turn ambiguous ideas into clear, validated designs through structured dialogue.

---

## Core Principle

Ask ONE question at a time with context-aware options. Wait for response. Record decision. Move to next question.

---

## Question Rules

| Rule | Description |
|------|-------------|
| **One at a time** | Never batch multiple questions in one message |
| **Multiple choice** | Prefer options over open-ended when possible |
| **Recommend** | Add "(Recommended)" to your suggested option |
| **Max 4 options** | Keep choices manageable |
| **Lead with why** | Briefly explain why you're asking |

---

## Question Template

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

---

## Question Priority Order

Ask in this order (skip if already clear):

1. **Purpose/Goal** - What problem does this solve? Core objective?
2. **Scope** - MVP / Full / Prototype?
3. **Constraints** - Performance, security, compatibility requirements?
4. **Architecture** - Follow existing patterns / New patterns / Hybrid?
5. **Libraries** - Which packages to use?

---

## Context-Aware Option Generation (CRITICAL)

**Options marked `[...]` in templates MUST be generated from exploration context, NOT generic templates.**

📖 **Detailed guide**: See [context-aware-options.md](../../skills/planning/references/context-aware-options.md)

### Generation Process

1. **Read Exploration Context**:
   ```bash
   # Read summary first
   context.json → patterns, key_files, tech_stack

   # Read detailed findings
   exploration/*.md → implementations, naming conventions, relationships
   ```

2. **Extract Patterns**:
   - Architecture: Repository pattern, layered architecture, microservices
   - Libraries: npm packages, framework versions
   - Data Models: Schema definitions, naming conventions
   - Error Handling: Error classes, response formats
   - Testing: Test frameworks, coverage tools
   - Security: Auth methods, validation libraries

3. **Generate Options**:
   - **Recommended** - Follows existing pattern (mark with "Recommended")
   - **Alternative 1** - Compatible but different approach
   - **Alternative 2** - New pattern (requires justification)
   - **Other** - Always include for freeform input

### Example: BAD (Generic)

```python
"options": [
  {"label": "Repository Pattern", "description": "Data access abstraction"},
  {"label": "Active Record", "description": "ORM pattern"},
  {"label": "Raw SQL", "description": "Direct queries"}
]
```

**Why bad**: Doesn't reflect actual codebase. User has to guess what fits.

### Example: GOOD (Context-Aware)

```python
# After reading: "Found src/repositories/UserRepository.ts using Prisma"
"options": [
  {"label": "Prisma Repository (Recommended)", "description": "Follows UserRepository pattern, creates src/repositories/ProductRepository"},
  {"label": "Prisma Direct", "description": "Direct use in app/api/products/route.ts without Repository"},
  {"label": "Introduce new pattern", "description": "Different approach (explain in Other)"}
]
```

**Why good**: References existing pattern, provides exact file paths, explains compatibility.

---

## Interview Rounds

📖 **Detailed templates**: See [interview-rounds.md](../../skills/planning/references/interview-rounds.md)

### Round 1: Intent & Scope (All complexities)

**Purpose**: Clarify core goal, define boundaries, establish success criteria.

**Questions**:
- Core goal direction (Y vs Z?)
- Scope (MVP / Standard / Complete)
- Integration (Independent / Extend / Modify existing)
- Success criteria (Tests / Manual / Both)

### Round 2: Technical Decisions (standard+)

**Purpose**: Architecture patterns, tech stack, data model, testing approach.

**Questions**:
- Architecture pattern? (Generate from context)
- Tech stack/libraries? (Generate from context, multi-select)
- Data model/schema? (Generate from context)
- Testing strategy? (TDD recommended)

### Round 3: Edge Cases & Error Handling (complex+)

**Purpose**: Error scenarios, concurrency, performance, security.

**Questions**:
- Error scenarios? (Generate from context, multi-select)
- Concurrency concerns? (Generate from context)
- Performance requirements? (Generate from context)
- Security considerations? (Generate from context, multi-select)

### Round 4: Polish & Integration (massive)

**Purpose**: UI/UX details, observability, documentation, deployment.

**Questions**:
- UI/UX details? (Generate from context)
- Logging/monitoring? (Generate from context, multi-select)
- Documentation scope? (Generate from context)
- Deployment strategy? (Generate from context)

### Round 5+: Freeform (User-requested)

**Purpose**: Additional topics based on user request.

**Flow**:
1. Ask what topics to explore (multi-select)
2. Ask questions specific to selected topics

---

## Adaptive Check (After Each Round)

After completing each round, ask if user wants to continue:

```python
AskUserQuestion(questions=[{
  "question": f"Round {n} complete. Continue?",
  "header": "Continue",
  "options": [
    {"label": "Enough", "description": "Proceed to write Plan"},
    {"label": "Continue", "description": "Proceed to next round"}
  ],
  "multiSelect": False
}])
```

**Behavior**:
- **"Enough"** → Exit interview, proceed to Design Document
- **"Continue"** → Next round (no upper limit)

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

This record will be included in the design document.

---

## Domain-Specific Questions

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

---

## Red Flags (Ask More Questions)

Stop and ask if you notice:

| Signal | Example | Action |
|--------|---------|--------|
| Vague scope | "Add login feature" | Ask about OAuth/email/both |
| Multiple approaches | REST vs GraphQL | Ask preference |
| Missing constraints | No perf requirements | Ask about scale |
| Ambiguous terms | "quickly", "simple" | Clarify meaning |

---

## Validation Checklist

Before presenting options to user, verify:

- [ ] Options reference actual files/patterns from exploration
- [ ] At least one option follows existing codebase pattern
- [ ] Option descriptions mention specific files or conventions
- [ ] Recommended option is marked clearly
- [ ] "Other" option is included for flexibility
