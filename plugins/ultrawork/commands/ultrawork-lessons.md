---
name: ultrawork-lessons
description: Show lessons learned from recent ultrawork sessions
argument-hint: "[--last N]"
allowed-tools: [Read, Glob, Grep]
---

# Ultrawork Lessons Dashboard

## Overview

Display lessons learned from previous ultrawork sessions in this project. Lessons are extracted by the documenter after each session and stored in `docs/lessons/`.

## Usage

```
/ultrawork-lessons          # Show all lessons for current project
/ultrawork-lessons --last 5 # Show 5 most recent
```

## Workflow

1. Find lessons files:
   ```python
   Glob("docs/lessons/*.md")
   ```

2. Sort by filename (date prefix ensures chronological order), newest first

3. If `--last N` specified, take only the N most recent files

4. For each file, read and display:
   - **Session Summary** (date, tasks, Ralph loops)
   - **Key Failure-Fix Patterns** (pattern name + takeaway)
   - **Recommendations** (actionable items)

5. At the end, show aggregated summary:
   - Total sessions with lessons
   - Most common failure patterns across sessions
   - Top recurring recommendations

## Output Format

```markdown
## Lessons Dashboard

### Recent Sessions

#### 2026-03-18: Auth middleware refactor
- Tasks: 8 (6 first-pass, 2 fix)
- Ralph Loops: 1
- Key lesson: lint를 worker 단계에서 미리 실행할 것

#### 2026-03-15: API endpoint migration
- Tasks: 5 (all first-pass)
- Ralph Loops: 0
- (No failures — clean session)

### Aggregated Insights
- Total sessions: 5
- Average Ralph loops: 0.8
- Most common failure: lint violations (3 sessions)
- Top recommendation: "Run lint before verification"
```

## Edge Cases

- No `docs/lessons/` directory -> Display: "No lessons found. Lessons are created after ultrawork sessions complete."
- Empty directory -> Same message
- Only clean sessions (no failures) -> Show sessions but note "clean completion"
