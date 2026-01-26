---
name: ultrawork-quiz
description: "Interactive quiz on session learnings and discoveries"
argument-hint: "[--count N] [--session ID]"
allowed-tools: [
  "Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js:*)",
  "Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js:*)",
  "Read",
  "AskUserQuestion",
  "Glob"
]
---

# Ultrawork Quiz Command

## Overview

Test knowledge gained during ultrawork sessions. Quiz focuses on **learnings and discoveries** from codebase exploration, design decisions, and technical patterns, NOT mechanical facts the user already knows.

## Session ID Handling

The session_id is provided by the hook via systemMessage as `CLAUDE_SESSION_ID`.
You MUST pass it to scripts via `--session` flag.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--count N` | 5 | Number of quiz questions |
| `--session ID` | current | Session to quiz on (uses `CLAUDE_SESSION_ID` if omitted) |

## Quiz Data Sources

### Priority Order

1. **exploration/*.md** (High priority)
   - Tech stack discoveries
   - Architecture patterns
   - Naming conventions
   - Framework/library usage

2. **docs/plans/*.md** (High priority)
   - Design rationale
   - Approach comparisons
   - Decision reasoning
   - Trade-off analysis

3. **tasks/*.json criteria** (Medium priority)
   - Verification methods
   - Test commands
   - Success patterns

4. **evidence_log** (Low priority)
   - Tools/commands actually used
   - Test execution patterns

### What to Include

✅ **Focus on learnings:**
- "What scripting runtime was discovered?" (Bun)
- "Why was approach X chosen over Y?" (Design rationale)
- "What naming convention is used for components?" (Pattern)
- "Which framework does this project use?" (Tech stack)

❌ **Exclude mechanical facts:**
- Session goal (user already knows)
- Task names/completion status (not a learning)
- "Was file X modified?" (not discovery)

## Workflow

### Phase 1: Parse Arguments

```bash
# Parse --count and --session from user input
# Default count: 5
# Default session: CLAUDE_SESSION_ID
```

### Phase 2: Read Session Data

```bash
# Get session metadata
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${SESSION_ID} --field working_dir

# Get session directory
SESSION_DIR=~/.claude/ultrawork/sessions/${SESSION_ID}
```

### Phase 3: Collect Quiz Content

```bash
# Find exploration files
Glob("${SESSION_DIR}/exploration/*.md")

# Read exploration content
Read("${SESSION_DIR}/exploration/overview.md")
Read("${SESSION_DIR}/exploration/exp-*.md")

# Find design documents
Glob("${SESSION_DIR}/docs/plans/*.md")

# Read design content
Read("${SESSION_DIR}/docs/plans/*.md")

# Get task criteria
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" --session ${SESSION_ID} --format json
```

### Phase 4: Generate Questions

Parse collected content for:

1. **Tech Stack Questions**
   - Extract runtime, framework, language mentions
   - Example: "Next.js 14", "TypeScript", "Bun runtime"

2. **Pattern Questions**
   - Extract naming conventions, file structure
   - Example: "flag-based parameters", "YAML frontmatter"

3. **Decision Questions**
   - Extract design rationale from docs/plans/*.md
   - Example: "Why was NextAuth chosen?"

4. **True/False Questions**
   - Convert factual discoveries to T/F
   - Example: "This project uses TypeScript" (True)

**Question Pool:**
- Generate 2-3x the requested count
- Mix question types (multiple choice, true/false)
- Create plausible distractors from same source

**Distractor Strategy:**
- Similar technologies (e.g., "Deno" as distractor for "Bun")
- Related patterns (e.g., "camelCase" as distractor for "kebab-case")
- Common alternatives from docs/plans comparisons

### Phase 5: Interactive Quiz Loop

For each question (one at a time):

```python
# Present question context (brief)
"""
During exploration, you discovered the project's scripting runtime.
"""

# Ask question with AskUserQuestion
AskUserQuestion(questions=[{
  "question": "What scripting runtime does this project use?",
  "header": "Q1/5: Runtime",
  "options": [
    {"label": "Bun", "description": "Modern JavaScript runtime"},
    {"label": "Node.js", "description": "Traditional JavaScript runtime"},
    {"label": "Deno", "description": "Secure JavaScript runtime"},
    {"label": "tsx", "description": "TypeScript runner"}
  ],
  "multiSelect": False
}])

# Show immediate feedback
"""
✅ Correct! The project uses Bun (from exploration/overview.md: "Runtime: Bun")
"""

# OR

"""
❌ Incorrect. The correct answer is Bun.
From exploration/overview.md: "Runtime: Bun 1.0+"
"""

# Move to next question
```

### Phase 6: Display Final Score

```markdown
# Quiz Complete

**Score:** 4/5 (80%)

## Summary
- Tech Stack: 2/2 ✓
- Design Decisions: 1/2
- Patterns: 1/1 ✓

## Review Areas
You might want to review:
- Design rationale in docs/plans/design.md (Decision questions)
```

## Question Format Examples

### Multiple Choice (Tech Stack)

```python
AskUserQuestion(questions=[{
  "question": "What framework is used for the API routes?",
  "header": "Q2/5: Framework",
  "options": [
    {"label": "Next.js App Router", "description": "Server-side rendering framework"},
    {"label": "Express", "description": "Node.js web framework"},
    {"label": "Fastify", "description": "Fast web framework"},
    {"label": "Hono", "description": "Lightweight edge framework"}
  ],
  "multiSelect": False
}])
```

### Multiple Choice (Design Decision)

```python
AskUserQuestion(questions=[{
  "question": "Why was command-only implementation chosen over a dedicated script?",
  "header": "Q3/5: Design",
  "options": [
    {"label": "All data access available via existing scripts", "description": "Reuse pattern"},
    {"label": "Better performance", "description": "Speed optimization"},
    {"label": "Easier testing", "description": "Test coverage"},
    {"label": "Security requirements", "description": "Access control"}
  ],
  "multiSelect": False
}])
```

### True/False (Pattern)

```python
AskUserQuestion(questions=[{
  "question": "True or False: This project uses YAML frontmatter for command definitions.",
  "header": "Q4/5: Pattern",
  "options": [
    {"label": "True", "description": "YAML frontmatter is used"},
    {"label": "False", "description": "Another format is used"}
  ],
  "multiSelect": False
}])
```

## Graceful Degradation

### No Quiz Data Available

If session has no exploration or design docs:

```markdown
# No Quiz Available

This session doesn't have enough data for a quiz.

**Why?**
- No exploration files found in exploration/
- No design documents in docs/plans/

**Tip:** Run `/ultrawork` with a goal to generate quiz content.
```

### Insufficient Questions

If requested count exceeds available data:

```markdown
# Limited Quiz Data

Requested: 10 questions
Available: 4 questions

**Proceeding with 4 questions based on available data.**
```

## Implementation Notes

1. **One question at a time** - Do NOT batch questions in a single AskUserQuestion call
2. **Immediate feedback** - Show correct answer after each response
3. **Track score** - Count correct/incorrect answers
4. **Category tracking** - Group by question type for summary
5. **Source attribution** - Show which file the answer came from
6. **Randomize** - Shuffle question order and option order

## Error Handling

| Error | Response |
|-------|----------|
| Session not found | "Error: Session {ID} not found. Use /ultrawork-status --all to list sessions." |
| Invalid --count | "Error: --count must be a positive integer (got: {value})" |
| No exploration data | Display "No Quiz Available" message with tips |

## Example Quiz Flow

```
# Quiz Started

Session: abc-123
Goal: Implement user authentication
Questions: 5

---

During exploration, you discovered the project's scripting runtime.

Q1/5: Runtime
What scripting runtime does this project use?

[ User selects: "Bun" ]

✅ Correct!
Source: exploration/overview.md - "Runtime: Bun 1.0+"

Score: 1/1

---

The design document compared several authentication approaches.

Q2/5: Design Decision
Why was NextAuth.js chosen for authentication?

[ User selects: "Better performance" ]

❌ Incorrect. The correct answer is "Next.js standard, built-in OAuth"
Source: docs/plans/auth-design.md - "Approach A: NextAuth.js (Recommended) - Next.js standard, built-in OAuth, active community"

Score: 1/2

---

... (3 more questions) ...

---

# Quiz Complete

**Score:** 4/5 (80%)

## Summary
- Tech Stack: 2/2 ✓
- Design Decisions: 1/2
- Patterns: 1/1 ✓

## Review Areas
You might want to review:
- Design rationale in docs/plans/auth-design.md

Great job! You've retained most of the key learnings from this session.
```
