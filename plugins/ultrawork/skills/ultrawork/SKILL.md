---
name: ultrawork
description: "Use when starting complex implementation work requiring verification guarantees. Activates strict mode with mandatory planning, success criteria, evidence collection, and zero tolerance for partial completion."
---

# Ultrawork Mode

## Overview

Ultrawork enforces **verification-first development**:
- No implementation without a plan
- No completion claims without evidence
- No partial work accepted

## Activation

```
/ultrawork "your goal here"
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: PLANNING                                           │
│                                                             │
│ → Spawn planner agent (opus)                                │
│ → Planner spawns explorers (sonnet) for context             │
│ → Creates Task Graph with success criteria                  │
│ → Includes verification task                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: EXECUTION                                          │
│                                                             │
│ → Spawn workers for unblocked tasks                         │
│ → Workers report evidence on completion                     │
│ → TaskUpdate as tasks complete                              │
│ → Next tasks unblock automatically                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: VERIFICATION                                       │
│                                                             │
│ → Verification task runs                                    │
│ → All evidence collected and validated                      │
│ → Quality checks pass                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: COMPLETE                                           │
│                                                             │
│ → All criteria met with evidence                            │
│ → Session marked complete                                   │
│ → Summary reported to user                                  │
└─────────────────────────────────────────────────────────────┘
```

## State Management

Session state stored in: `~/.claude/ultrawork/{team-name}/session.json`

Check status anytime: `/ultrawork-status`

## Zero Tolerance Rules

**BLOCKED phrases (cannot claim completion with these):**

| Phrase | Why Blocked |
|--------|-------------|
| "should work now" | No evidence |
| "basic implementation" | Incomplete |
| "simplified version" | Partial work |
| "you can extend this" | Not done |
| "implementation complete" | Without evidence |

## Evidence Requirements

| Claim | Required Evidence |
|-------|-------------------|
| "Tests pass" | Test command output |
| "Build succeeds" | Build command output |
| "Feature works" | Demo or test proving it |
| "Bug fixed" | Before/after showing fix |

## Commands

| Command | Purpose |
|---------|---------|
| `/ultrawork "goal"` | Start session |
| `/ultrawork-status` | Check current state |
| `/ultrawork-evidence` | List collected evidence |
| `/ultrawork-cancel` | Cancel session |

## Integration

Ultrawork uses:
- **planner agent** for task decomposition
- **Task system** for state tracking
- **orchestration patterns** for execution

Read references/ for detailed protocols.
