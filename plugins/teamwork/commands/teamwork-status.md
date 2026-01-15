---
name: teamwork-status
description: "Dashboard view of teamwork project status"
argument-hint: "[--project NAME] [--team NAME] [--verbose] | --help"
allowed-tools: ["Bash", "Read", "Glob"]
---

# Teamwork Status Command

## Overview

Display a dashboard-style status view of a teamwork project.

---

## Step 1: Parse Arguments

Parse options:
- `--project NAME`: Override project detection
- `--team NAME`: Override sub-team detection
- `--verbose`: Show task details

Detect project/team:
```bash
# Default detection
PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" || echo "unknown")
SUB_TEAM=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo "main")

# Check for overrides in arguments
```

Teamwork directory: `~/.claude/teamwork/{PROJECT}/{SUB_TEAM}/`

## Step 2: Read Project State

**If project doesn't exist:**
```
No teamwork project found for: {PROJECT}/{SUB_TEAM}

Start one with: /teamwork "your goal"
```

**Otherwise, read:**
- project.json
- All task files in tasks/
- waves.json (if exists - for wave-based projects)
- verification/*.json (if exists - for verification results)

## Step 3: Calculate Statistics

Count by status:
- Total tasks
- Open tasks
- Resolved tasks
- In-progress (claimed but not resolved)

Count by role:
- Per-role completion

Calculate:
- Overall progress percentage
- Active workers (tasks with owner)

**If waves.json exists (wave-based project):**

Count by wave:
- Wave status (planning/in_progress/verified/failed)
- Tasks per wave
- Completed tasks per wave
- Wave verification results

Parse verification files:
- Read verification/*.json
- Extract verdict (PASS/FAIL)
- Extract test results
- Extract conflict information

## Step 4: Display Dashboard

**Render:**

```markdown
═══════════════════════════════════════════════════════════
 TEAMWORK STATUS
═══════════════════════════════════════════════════════════

 Project: {PROJECT}
 Sub-team: {SUB_TEAM}
 Goal: {goal}

───────────────────────────────────────────────────────────
 PROGRESS
───────────────────────────────────────────────────────────

 ████████████░░░░░░░░ 60% (6/10)

 Open:       3 tasks
 In Progress: 1 task
 Completed:  6 tasks

{If waves.json exists:}
───────────────────────────────────────────────────────────
 WAVE PROGRESS
───────────────────────────────────────────────────────────

 Wave 1: ✅ VERIFIED   (3/3 tasks, 100%)
 Wave 2: ✅ VERIFIED   (5/5 tasks, 100%)
 Wave 3: ⏳ IN PROGRESS (2/4 tasks, 50%)
         Task 7: ✓ resolved
         Task 8: ◐ in progress (session-abc)
         Task 9: ○ open
         Task 10: ○ open
 Wave 4: ⏸️  PENDING    (0/2 tasks, 0%)
         (blocked by Wave 3)

 Overall: Wave 3/4 active

{If verification files exist:}
───────────────────────────────────────────────────────────
 VERIFICATION
───────────────────────────────────────────────────────────

 Wave 1: ✅ PASS (verified 2026-01-15 10:30)
         - Build passed
         - Tests passed (15/15)
         - No conflicts

 Wave 2: ✅ PASS (verified 2026-01-15 11:45)
         - Build passed
         - Tests passed (23/23)
         - No conflicts

 Wave 3: (in progress, not yet verified)

───────────────────────────────────────────────────────────
 BY ROLE
───────────────────────────────────────────────────────────

 backend:   ████████████████████ 100% (3/3) ✓
 frontend:  ████████░░░░░░░░░░░░  40% (2/5)
 test:      ░░░░░░░░░░░░░░░░░░░░   0% (0/2)

───────────────────────────────────────────────────────────
 ACTIVE WORKERS
───────────────────────────────────────────────────────────

 session-abc: #7 Build login form (5m ago)
 session-xyz: #9 Add unit tests (2m ago)

───────────────────────────────────────────────────────────
 BLOCKED TASKS
───────────────────────────────────────────────────────────

 #10 Integration tests - blocked by: #7, #8

───────────────────────────────────────────────────────────
 COMMANDS
───────────────────────────────────────────────────────────

 /teamwork-worker              Start working on tasks
 /teamwork-worker --loop       Continuous worker mode
 /teamwork-worker --strict     Strict evidence mode (for waves)
 /teamwork-status --verbose    Show task details

═══════════════════════════════════════════════════════════

{Wave-based projects show additional sections:}
- WAVE PROGRESS: Shows wave-by-wave execution status
- VERIFICATION: Shows verification results for completed waves
```

## Step 5: Verbose Mode (if --verbose)

**Additional output:**

```markdown
───────────────────────────────────────────────────────────
 ALL TASKS
───────────────────────────────────────────────────────────

| ID | Status | Role | Task | Owner |
|----|--------|------|------|-------|
| 1 | ✓ | backend | Setup schema | - |
| 2 | ✓ | backend | Build API | - |
| 3 | ✓ | backend | Add auth | - |
| 4 | ✓ | frontend | Create layout | - |
| 5 | ✓ | frontend | Login page | - |
| 6 | ◐ | frontend | Dashboard | session-abc |
| 7 | ○ | frontend | Settings | - |
| 8 | ○ | frontend | Profile | - |
| 9 | ○ | test | Unit tests | - |
| 10 | ⊘ | test | Integration | blocked |

Legend: ✓ resolved, ◐ in progress, ○ open, ⊘ blocked
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name |
| `--team NAME` | Override sub-team name |
| `--verbose` | Show detailed task list |
