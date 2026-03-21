# ADR: Ultrawork Planning Pipeline Redesign

## Status

Accepted — 2026-03-21

## Context

The ultrawork planning pipeline had two usability and efficiency issues:

### Issue 1: Auto-trigger Gap
Ultrawork required explicit `/ultrawork` invocation by users. Implementation requests using natural language (구현, 만들어, implement, build, etc.) were intercepted by the brainstorming plugin instead, forcing users to either manually switch to `/ultrawork` or complete the brainstorming→writing-plans→execution chain unnecessarily.

### Issue 2: Design-Verification-Decomposition Coupling
The design document contained both architectural decisions AND task decomposition (Execution Strategy) simultaneously. When the Codex doc-review gate detected design flaws, both the design AND task decomposition needed revision, creating unnecessary rework cycles. Ideally, the doc-review should validate pure design decisions before tasks are decomposed from a verified specification.

## Decision

**Approach**: Extend keyword detection + separate Execution Strategy writing from initial design phase.

### D1: Auto-trigger Mechanism
Extended `keyword-detector.js` with **advisory mode** for implementation keywords (구현, 만들어, 리팩토링, 추가해, 수정해, 변경해, implement, build, refactor, create, add, modify). When detected, the hook suggests `/ultrawork-plan` via `additionalContext` rather than transforming the prompt—allowing users to accept or ignore the suggestion.

**Rationale**: Advisory mode avoids false positives and respects user intent. Users can choose when to switch to planning mode.

### D2: Keyword Scope
Focused on implementation verbs (Korean and English) rather than generic action words. This reduces false positives while capturing the primary use case (structured planning for code changes).

### D3: Global Routing Rule
Created `~/.claude/rules/ultrawork-routing.md` as a global rule directing users toward ultrawork for implementation work instead of brainstorming. Since the brainstorming plugin is external, a rule-based override is the only mechanism available.

**Rationale**: Global rules provide system-wide guidance without modifying external plugins.

### D4: Execution Strategy Post-Review
Moved Execution Strategy (task decomposition) from initial design to a **post-review section** written AFTER the Codex doc-review verifies the pure design. The design document now focuses on architecture, decisions, and verification strategy without task details.

**Workflow**:
1. Planner writes design (Context, Problem, Approach, Decisions, Architecture, Verification)
2. Codex doc-review validates design quality
3. After PASS: Planner writes Execution Strategy section and decomposes tasks
4. Session transitions to EXECUTION

**Rationale**: Decouples design validation from task decomposition. Doc-review failures trigger design fixes, not task re-decomposition.

### D5: Design Template Restructuring
Updated `design-template.md` to mark Execution Strategy as optional and post-review. Template now indicates:
- **Before doc-review**: Write Context, Problem, Approach, Decisions, Architecture, Verification
- **After doc-review PASS**: Add Execution Strategy section

**Rationale**: Backward compatible. Existing sessions can adapt if Execution Strategy is already in the document.

### D6: Planner Behavioral Adaptation
Updated planner agent to handle both old (Execution Strategy in design) and new (added post-review) document formats. Detects whether Execution Strategy exists and acts accordingly.

### D7: Phase Order Changes
Updated planning SKILL.md, planner AGENT.md, ultrawork-plan.md, and CLAUDE.md to reflect the new order:
- Phase 4: Write Design (without Execution Strategy)
- Phase 5: Codex doc-review (validates design)
- Phase 6: Write Execution Strategy + Decompose Tasks (post-review)

## Outcome

**Verification**: PASS
**Iterations**: 1 (all tasks resolved on first attempt)
**Version**: 1.9.0

### Files Changed

| File | Type | Change |
|------|------|--------|
| `plugins/ultrawork/src/hooks/keyword-detector.js` | Modified | Added advisory mode for implementation keywords (구현, 만들어, 리팩토링, implement, build, refactor, etc.) |
| `~/.claude/rules/ultrawork-routing.md` | Created | Global routing rule suggesting ultrawork for implementation work over brainstorming |
| `plugins/ultrawork/skills/planning/references/design-template.md` | Modified | Moved Execution Strategy to post-review section, marked optional |
| `plugins/ultrawork/skills/planning/SKILL.md` | Modified | Reordered phases: doc-review before task decomposition |
| `plugins/ultrawork/agents/planner/AGENT.md` | Modified | Updated workflow to reflect post-review Execution Strategy writing |
| `plugins/ultrawork/commands/ultrawork-plan.md` | Modified | Updated interactive mode workflow with separated doc-review and task decomposition |
| `plugins/ultrawork/CLAUDE.md` | Modified | Updated phase transition rules documenting post-review Execution Strategy |
| `plugins/ultrawork/.claude-plugin/plugin.json` | Modified | Version bump 1.8.0 → 1.9.0 |
| `.claude-plugin/marketplace.json` | Modified | Version sync 1.8.0 → 1.9.0 |

### Test Results

**Gate 0**: PASS
- All existing ultrawork tests pass
- keyword-detector.js hook executes without errors
- No blocked patterns in code

**Verification Criteria (V1-V9)**:
- V1: Advisory keyword patterns found (구현, 만들어, 리팩토링, implement, build, refactor)
- V2: Advisory mode message detected (제안만, 강제 아님)
- V3: ultrawork-routing.md global rule file exists
- V4: Design template marks Execution Strategy as post-review
- V5: planning SKILL.md shows doc-review before task decomposition
- V6: planner AGENT.md reflects separated workflow
- V7: CLAUDE.md phase transition rules updated
- V8: Existing ultrawork tests all PASS, exit 0
- V9: keyword-detector.js runs without errors

### Execution Summary

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| 1 | keyword-detector.js advisory mode | ✓ Resolved | Implementation keywords detected, advisory message added |
| 2 | ultrawork-routing.md global rule | ✓ Resolved | Rule file created in ~/.claude/rules/ |
| 3 | design-template.md post-review section | ✓ Resolved | Execution Strategy moved, marked optional |
| 4 | planning SKILL.md phase reordering | ✓ Resolved | Doc-review phase placed before task decomposition |
| 5 | planner AGENT.md workflow update | ✓ Resolved | Post-review Execution Strategy writing documented |
| 6 | ultrawork-plan.md interactive mode | ✓ Resolved | Separated workflow phases reflected |
| 7 | CLAUDE.md phase transitions | ✓ Resolved | Post-review rules documented |
| 8 | version bump 1.8.0 → 1.9.0 | ✓ Resolved | Both plugin.json and marketplace.json updated |
| verify | Final verification V1-V9 | ✓ Resolved | All criteria PASS |

## Implementation Matched Plan

- Advisory keyword detection: ✓ (D2, V1-V2)
- Global routing rule: ✓ (D3, V3)
- Design template separation: ✓ (D5, V4)
- Phase reordering: ✓ (D7, V5-V7)
- Version sync: ✓ (V8)
- No regressions: ✓ (V9)

## Consequences

### Benefits

1. **Reduced friction**: Users can request implementation work naturally; keyword-detector suggests ultrawork planning
2. **Cleaner design validation**: Doc-review validates design decisions without being coupled to task decomposition
3. **Efficient iteration**: Design flaws trigger design fixes, not task re-decomposition
4. **Progressive disclosure**: Users see execution details only after design is verified

### Risks (Mitigated)

1. **False positive suggestions**: Advisory mode suggests but doesn't transform, user can dismiss
2. **Rules override brainstorming**: Global rules may not override external plugin auto-trigger—mitigated by placing both keyword-detector advisory AND global rules; user sees both signals
3. **Backward compatibility**: Existing sessions have Execution Strategy in design doc—planner adapts by checking if section exists before writing post-review

### No Changes to UX

- `/ultrawork --auto` still executes plan + execution in one step
- `/ultrawork-plan` still executes planning phase only
- Session isolation, evidence collection, verification gates unchanged

## References

- **Design Spec**: `docs/superpowers/specs/2026-03-21-ultrawork-planning-pipeline-redesign.md`
- **Commit**: `23de725` (docs) and supporting commits `c49087f`, `931eda7`, `b92a025`, `8237e9c`, `113e5ea`, `57c2488`, `7d0e38f`
