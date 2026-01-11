---
name: ultrawork
description: "This skill should be used when the user has a large, complex task requiring: (1) multi-file or multi-step implementation, (2) major refactoring or architecture changes, (3) new feature spanning multiple components. This skill should NOT be used for simple fixes, single-file edits, or quick questions. Activates strict verification with planning, success criteria, and evidence collection."
---

# Ultrawork Mode

## Overview

Ultrawork enforces **verification-first development**:
- No implementation without a plan
- No completion claims without evidence
- No partial work accepted

## Activation

See `/ultrawork` command for detailed usage and workflow.

Quick reference:
```
/ultrawork "your goal"         # Interactive: asks questions, user approves plan
/ultrawork --auto "your goal"  # Auto: decides autonomously, no confirmations
```

---

## Examples

### Example 1: Adding Authentication (Interactive)

**Goal**: "Add OAuth authentication with Google"

**Process**:
1. **Exploration**: Discovers Next.js project, no existing auth
2. **Planning Questions**:
   - "Which auth method?" → User chooses "OAuth + Email"
   - "Which library?" → User chooses "NextAuth.js"
3. **Design Created**: Design document saved to project docs/
4. **Tasks Generated**: 5 tasks with dependencies
5. **Execution**: Workers implement in parallel
6. **Verification**: Tests pass, OAuth flow works

**Result**: Complete auth system with evidence.

### Example 2: Refactoring Database Layer (Auto)

**Goal**: "Migrate from direct SQL to Prisma ORM"

**Process**:
1. **Exploration**: Finds all SQL query locations
2. **Planning**: Auto-decides on migration strategy (no user input)
3. **Design**: Migration plan with rollback strategy
4. **Tasks**: Schema definition → Migration scripts → Update queries → Tests
5. **Execution**: Sequential migration with verification
6. **Verification**: All queries work, tests pass

**Result**: Complete migration with backward compatibility.

---

## When to Use Ultrawork

**USE ultrawork for:**
- Multi-file implementations
- Architecture changes
- New features with unknowns
- Refactoring with risk

**DON'T use ultrawork for:**
- Single-file edits
- Simple bug fixes
- Documentation updates
- Quick questions

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

## Key Concepts

### Session Isolation
- Each ultrawork session has its own directory
- State tracked in session.json
- Context preserved across exploration/planning/execution

### Evidence Collection
- Every completion claim requires proof
- Tests must pass (with output)
- Builds must succeed (with output)
- Features must be demonstrated

### Task Dependencies
- Tasks unblock automatically when dependencies complete
- Workers execute in parallel waves
- Verification always runs last

---

## Related Commands

- `/ultrawork-status` - Check current phase/progress
- `/ultrawork-evidence` - View collected evidence
- `/ultrawork-cancel` - Cancel active session

For detailed workflow, see `/ultrawork` command documentation.
