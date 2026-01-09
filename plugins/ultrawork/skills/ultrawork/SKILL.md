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
/ultrawork "your goal here"           # Interactive mode (default)
/ultrawork --auto "your goal here"    # Auto mode (no user interaction)
```

---

## Mode Comparison

| Aspect | Interactive (default) | Auto (--auto) |
|--------|----------------------|---------------|
| Exploration | Orchestrator spawns explorers | Same |
| Planning | Orchestrator runs planning skill | Planner sub-agent |
| User Questions | AskUserQuestion for decisions | Auto-decide from context |
| Confirmation | User approves plan | No confirmation |
| Best For | Important features, unclear requirements | Well-defined tasks, CI/CD |

---

## How It Works

### Interactive Mode (Default)

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: EXPLORATION (Orchestrator) - Dynamic               │
│                                                             │
│ Stage 1: Quick overview (1 haiku explorer)                  │
│   → exploration/overview.md                                 │
│                                                             │
│ Stage 2: Analyze overview + goal → generate hints           │
│                                                             │
│ Stage 3: Targeted exploration (N explorers, parallel)       │
│   → exploration/exp-1.md, exp-2.md, ...                     │
│                                                             │
│ → Update context.json with summaries                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: PLANNING (Orchestrator - Main Agent)               │
│                                                             │
│ → Read context.json and exploration/*.md                    │
│ → Use planning skill for design                             │
│ → AskUserQuestion for decisions (one at a time)             │
│ → Write design.md                                           │
│ → Decompose into tasks                                      │
│ → User confirms plan                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: EXECUTION                                          │
│                                                             │
│ → Spawn workers for unblocked tasks                         │
│ → Workers report evidence on completion                     │
│ → Next tasks unblock automatically                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: VERIFICATION                                       │
│                                                             │
│ → Verification task runs                                    │
│ → All evidence collected and validated                      │
│ → Quality checks pass                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: COMPLETE                                           │
│                                                             │
│ → All criteria met with evidence                            │
│ → Session marked complete                                   │
│ → Summary reported to user                                  │
└─────────────────────────────────────────────────────────────┘
```

### Auto Mode (--auto)

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: EXPLORATION (Orchestrator) - Dynamic               │
│                                                             │
│ → Same as interactive (overview → analyze → targeted)       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: PLANNING (Planner Sub-Agent)                       │
│                                                             │
│ → Read context.json and exploration/*.md                    │
│ → Auto-decide based on context (no user questions)          │
│ → Write design.md                                           │
│ → Decompose into tasks                                      │
│ → No confirmation needed                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
          [Same execution and verification phases]
```

---

## Session Directory Structure

```
~/.claude/ultrawork/{team-name}/sessions/{session-id}/
├── session.json        # Session metadata (JSON)
├── context.json        # Explorer summaries (JSON)
├── design.md           # Design document (Markdown)
├── exploration/        # Detailed exploration (Markdown)
│   ├── overview.md     # Project overview (always first)
│   ├── exp-1.md        # Targeted exploration
│   └── exp-N.md        # (dynamic count based on goal)
└── tasks/              # Task files (JSON)
    ├── 1.json
    ├── 2.json
    └── verify.json
```

---

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

---

## Commands

| Command | Purpose |
|---------|---------|
| `/ultrawork "goal"` | Start session (interactive) |
| `/ultrawork --auto "goal"` | Start session (auto) |
| `/ultrawork-status` | Check current state |
| `/ultrawork-evidence` | List collected evidence |
| `/ultrawork-cancel` | Cancel session |

---

## Integration

Ultrawork uses:
- **explorer agents** for context gathering
- **planning skill** for design decisions
- **planner agent** for auto-mode planning
- **worker agents** for task execution
- **verifier agent** for final verification

Read references/ for detailed protocols.

---

## Delegation Rules (MANDATORY)

| Phase | Must Delegate | Never Direct |
|-------|---------------|--------------|
| Exploration | ✓ | ✓ |
| Planning (non-auto) | - | - (direct by design) |
| Planning (auto) | ✓ | ✓ |
| Execution | ✓ | ✓ |
| Verification | ✓ | ✓ |

**Exception**: User explicitly requests direct execution (e.g., "run this directly").

---

## Interruptibility (Background + Polling)

To allow user interruption during long-running operations, always use **background execution with polling**.

```python
# Pattern for all sub-agent waits
task_result = Task(subagent_type="...", run_in_background=True, ...)

while True:
    # Cancel check
    phase = Bash(f'session-get.sh --session {session_dir} --field phase')
    if phase.output.strip() == "CANCELLED":
        return  # Exit cleanly

    # Non-blocking poll
    result = TaskOutput(task_id=task_result.task_id, block=False, timeout=5000)
    if result.status in ["completed", "error"]:
        break
```

This allows `/ultrawork-cancel` to take effect between poll iterations.
