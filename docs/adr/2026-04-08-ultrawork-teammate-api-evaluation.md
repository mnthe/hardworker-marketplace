# ADR: Ultrawork Teammate API Migration Evaluation

## Status

**Rejected** — 2026-04-08

## Context

Claude Code v2.1.9+ provides a native Teammate API (`TeamCreate`, `TaskCreate`/`TaskList`/`TaskUpdate`, `SendMessage`, `TeammateIdle`/`TaskCompleted` hooks) designed for multi-agent collaboration with event-driven coordination.

Ultrawork currently uses the standard `Agent()` tool with `run_in_background=True` for worker orchestration, with session-file-based state management (`session.json`, `tasks/*.json`, `evidence/log.jsonl`).

The question: should ultrawork migrate its orchestration layer to the native Teammate API?

## Evaluation

### Teammate API Benefits (Theoretical)

| Benefit | Description |
|---------|-------------|
| Event-driven coordination | `TeammateIdle`/`TaskCompleted` hooks vs polling |
| Native dependency management | `addBlockedBy` with automatic unblocking |
| Inter-worker communication | `SendMessage` for direct worker-to-worker messaging |
| Long-lived workers | Workers persist and pick up new tasks when idle |

### Why These Benefits Don't Apply to Ultrawork

**1. Event-driven coordination — already present.**
`Agent(run_in_background=True)` already delivers task-notification on completion. Ultrawork spawns all wave workers in a single message and receives completion notifications automatically. `TeammateIdle` fires when a worker has no task, but ultrawork workers execute exactly 1 task then terminate — idle state never exists.

**2. Native dependency management — no incremental value.**
Ultrawork uses a wave-based execution pattern: spawn all unblocked tasks → wait for all to complete → spawn next wave. Native `addBlockedBy` auto-unblocking only helps when workers pick up tasks dynamically, which ultrawork doesn't do (orchestrator manages waves explicitly).

**3. Inter-worker communication — not needed.**
Ultrawork workers are independent: each implements a single task with no cross-worker coordination. All coordination flows through the orchestrator via session files. `SendMessage` adds no value.

**4. Long-lived workers — architectural mismatch.**
Ultrawork's 1-task-1-worker-terminate pattern is intentional: each worker gets a fresh context without prior task bias, and the orchestrator maintains full control over task assignment. Long-lived workers would require state management within workers, contradicting ultrawork's stateless worker design.

### Migration Cost

| Cost | Magnitude |
|------|-----------|
| Dual state management (native tasks + session tasks) | High — sync bugs |
| 20+ scripts need API adaptation | Medium |
| 11 hooks need compatibility verification | Medium |
| Full test suite rewrite | High |
| Maintenance during migration | High |

### ROI Assessment

| Benefit | Actual Value | Migration Cost | ROI |
|---------|-------------|----------------|-----|
| Event coordination | Negligible (already have notifications) | High | **Negative** |
| Dependency management | Negligible (wave pattern) | Medium | **Negative** |
| SendMessage | Zero (no inter-worker communication) | Medium | **Zero** |

## Decision

**Reject migration.** The Teammate API is designed for long-lived, communicating workers — a pattern fundamentally different from ultrawork's 1-task-1-worker-terminate model. Migration cost is high with negligible benefit.

## When to Reconsider

- If ultrawork adopts long-lived workers (e.g., persistent review agent)
- If Claude Code deprecates `Agent()` in favor of Teammate API
- If ultrawork needs inter-worker communication (e.g., shared build cache)

## Consequences

- Ultrawork continues using `Agent()` / `Task()` with `run_in_background=True`
- Session-file-based state management remains
- The teamwork plugin continues to use Teammate API independently
- No code changes required
