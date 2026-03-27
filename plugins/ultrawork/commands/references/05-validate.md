# Validate Phase Reference

**Used by**: `ultrawork.md`, `ultrawork-exec.md`

**Purpose**: Verify all success criteria are met with concrete evidence before marking work complete.

---

## Phase Transition

When all tasks are resolved, move to verification:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase VERIFICATION
```

---

## Verification Workflow

### Step 1: Spawn Verifier

```python
# Get session directory directly
SESSION_DIR = "~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}"

# Spawn verifier (foreground - waits for completion)
Task(
    subagent_type="ultrawork:verifier:verifier",
    model="opus",  # Use opus for thorough verification
    prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}
SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts

Verify all success criteria are met with evidence.
Check for blocked patterns.
Run final tests.
Make PASS/FAIL determination.
"""
)
```

---

## Verifier Responsibilities

The verifier must:

1. **Audit Evidence** - Check that every success criterion has corresponding evidence
2. **Verify Design Document** - If design doc exists, check section completeness and blocked patterns
3. **Scan for Blocked Patterns** - Search all evidence and code for zero-tolerance phrases
4. **Run Final Tests** - Execute test suite, verify exit code 0
5. **Make Determination** - Clear PASS or FAIL verdict with rationale (Quad Gate: Claude + Codex + Doc + Reviewer)

---

## Design Document Verification

If a design document exists in `{WORKING_DIR}/docs/plans/`:

1. **Locate**: Find most recent `*-design.md`
2. **Content-area check**: Verify design covers: problem/goal, approach/decisions, affected files/consumers, scope boundaries, verification criteria, dependencies
3. **Blocked patterns**: TODO, TBD, FIXME, placeholder, "not yet decided"
4. **Task traceability**: Each task should relate to design content

**Design doc path retrieval:**

The design doc path is stored in `session.json` by the planner (via `session-update.js --design-doc`). The verifier reads it from session state:

```bash
DESIGN_DOC=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field plan.design_doc)
```

**Codex invocation with `--design`:**

The verifier passes the design document to Codex for both doc-review and exec context:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/codex-verify.js" \
  --mode full \
  --working-dir ${WORKING_DIR} \
  --criteria "criterion1|criterion2" \
  --goal "${GOAL}" \
  --design "${DESIGN_DOC}" \
  --output /tmp/codex-${CLAUDE_SESSION_ID}.json
```

When `--design` is provided in `full` mode:
- **doc-review**: Design document itself is verified for completeness, blocked patterns, consistency, quality
- **exec**: Design content is injected as context for criteria verification (verifies "implemented as designed")

---

## Evidence Audit

**For each task, verify:**

1. **Task status is `resolved`**
   ```bash
   bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-get.js" --session ${CLAUDE_SESSION_ID} --task-id "1" --field status
   ```

2. **Every criterion has evidence**
   ```json
   {
     "criteria": [
       "Tests pass with 5/5 assertions",
       "Middleware created in src/middleware/auth.ts",
       "Handles invalid tokens gracefully"
     ],
     "evidence": [
       "npm test -- auth.test.ts: 5/5 passed, exit 0",
       "Created src/middleware/auth.ts with JWT validation",
       "Test case 'invalid token' passes: returns 401"
     ]
   }
   ```

3. **Evidence is concrete, not speculative**
   - Good: "npm test: exit 0, 5/5 passed"
   - Bad: "Tests should pass"

---

## Zero Tolerance Rules

**Scan ALL evidence and code for these blocked patterns. If found → instant FAIL:**

| Pattern | Why Blocked | Example |
|---------|-------------|---------|
| "should work" | Speculation, not verification | "This should work with the new config" |
| "probably works" | Uncertainty | "The auth probably works now" |
| "basic implementation" | Incomplete | "Added basic implementation of validation" |
| "you can extend" | Leaving work for later | "You can extend this with more features" |
| "TODO" | Unfinished work | "TODO: Add error handling" |
| "FIXME" | Known issues | "FIXME: This breaks with empty input" |
| "not implemented" | Missing features | "Not implemented: logout functionality" |
| "placeholder" | Temporary code | "Placeholder implementation" |

**Scan locations:**
- Task evidence in `tasks/*.json`
- Evidence log in `session.json`
- Code comments in modified files (via grep)
- Test output in evidence

**Scan commands:**

```bash
# Scan all task evidence
for task_file in ${session_dir}/tasks/*.json; do
  grep -iE "(should work|probably works|basic implementation|you can extend|TODO|FIXME|not implemented|placeholder)" "$task_file"
done

# Scan modified files
git diff --name-only | xargs grep -iE "(TODO|FIXME|not implemented|placeholder)"
```

---

## Final Test Execution

**Run the project's test suite:**

```bash
# Standard test commands by framework
npm test          # Node.js projects
pytest            # Python projects
cargo test        # Rust projects
go test ./...     # Go projects
```

**Verify exit code:**
```bash
npm test
echo "Exit code: $?"  # Must be 0
```

**Parse test output for:**
- Total tests run
- Passed count
- Failed count (must be 0)
- Exit code (must be 0)

**Evidence format:**

```
Final test run: npm test
Output:
  PASS  src/auth.test.ts
  PASS  src/middleware.test.ts

  Test Suites: 2 passed, 2 total
  Tests:       10 passed, 10 total

Exit code: 0
```

---

## PASS Determination

**Verifier can mark PASS only if (Quad Gate):**

1. ✅ All tasks have status `resolved`
2. ✅ Every success criterion has concrete evidence
3. ✅ No blocked patterns found in evidence or code
4. ✅ Final test run passes (exit 0)
5. ✅ No unresolved issues mentioned in evidence
6. ✅ Design document passes review (if present) — no missing sections, no blocked patterns
7. ✅ Codex gate: PASS or SKIP
8. ✅ Reviewer gate (Phase 2-2): APPROVE (zero P0 and P1 issues)

**Quad Gate Decision:**

| Claude Gate | Codex Gate | Doc Gate | Reviewer Gate | Final Verdict |
|-------------|------------|----------|---------------|---------------|
| PASS | PASS | PASS | APPROVE | **PASS** |
| PASS | PASS | PASS | REQUEST_CHANGES | **FAIL** |
| PASS | PASS | FAIL | any | **FAIL** |
| PASS | SKIP | PASS | APPROVE | **PASS** |
| FAIL | any | any | any | **FAIL** |
| PASS | PASS | N/A | APPROVE | **PASS** |

**PASS action:**

```bash
# Update verify task
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id "verify" \
  --status resolved \
  --add-evidence "✅ PASS: All criteria met with verified evidence"
```

After PASS, the orchestrator runs the **Documentation phase** (if design doc exists) to transform the design document into an implementation record, then marks session COMPLETE. See [Documentation Phase Reference](06-document.md).

---

## FAIL Determination

**Verifier must mark FAIL if any:**

1. ❌ Missing evidence for any criterion
2. ❌ Blocked pattern found
3. ❌ Tests fail (exit code != 0)
4. ❌ Speculation in evidence ("should", "probably")
5. ❌ Incomplete implementation (TODO, FIXME)

**FAIL action - Ralph Loop:**

The verifier creates fix tasks and triggers another execution iteration:

```bash
# Create fix tasks for each issue found
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-create.js" --session ${CLAUDE_SESSION_ID} \
  --id "fix-1" \
  --subject "Fix failing test: auth middleware" \
  --description "Test 'invalid token' is failing. Error: Expected 401, got 500" \
  --complexity standard \
  --criteria "Test passes|Exit code 0"

# Increment iteration counter
current_iteration=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field iteration)
next_iteration=$((current_iteration + 1))

# Check max iterations
max_iterations=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field options.max_iterations)
if [ $next_iteration -gt $max_iterations ]; then
  # Max iterations reached - fail session
  bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase FAILED
else
  # Return to execution with fix tasks
  bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase EXECUTION --iteration $next_iteration
fi
```

**Fix task characteristics:**
- Target specific issues found in verification
- Have clear, concrete success criteria
- Include context from failed verification
- Block on fixing root cause, not symptoms

---

## Verification Is Mandatory

Verification cannot be skipped. The `--skip-verify` option has been removed in v1.0.0.
Every session must go through the VERIFICATION phase before completion.
- Manual verification preferred
- Time-sensitive work

**Trade-off**: Faster completion, but risk of incomplete/incorrect work.

---

## Mandatory Reviewer (Phase 2-2)

The reviewer agent is a mandatory gate in the verification pipeline. The verifier spawns the reviewer during Phase 2-2 for P0/P1 correctness checks:

```python
# Verifier spawns reviewer as Phase 2-2
Task(
    subagent_type="ultrawork:reviewer:reviewer",
    model="opus",
    prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}
SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts
MODE: verification

TASKS:
- Task 1: {subject} | Files: {file1, file2}
- Task 2: {subject} | Files: {file3, file4}

GIT_DIFF_BASE: {base_branch}

Deep code review:
- Read actual implementation code
- Check edge case handling (P0/P1)
- Verify error handling completeness
- Detect security issues
- Assess code quality
- Cross-module integration review

Provide structured verdict (APPROVE/REQUEST_CHANGES/REJECT).
"""
)
```

**Reviewer vs Verifier:**

| Aspect | Verifier | Reviewer |
|--------|----------|----------|
| Speed | Fast (~1-2 min) | Slow (~5-10 min) |
| Depth | Evidence-based | Code-reading |
| Focus | Criteria met? | Quality, security, edge cases |
| When | Always (mandatory) | Always (mandatory, Phase 2-2) |

---

## Evidence Log

All verification evidence is recorded in session.json:

```json
{
  "evidence_log": [
    {
      "timestamp": "2026-01-12T10:30:00Z",
      "agent": "verifier",
      "tool": "Bash",
      "command": "npm test",
      "output": "10 passed, exit 0"
    }
  ]
}
```

**View evidence:**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/ultrawork-evidence.js" --session ${CLAUDE_SESSION_ID}
```

---

## Verification Checklist

Before marking PASS, verifier confirms:

- [ ] All tasks status = `resolved`
- [ ] Every criterion has concrete evidence
- [ ] No "should", "probably", "basic implementation" in evidence
- [ ] No TODO, FIXME, "not implemented" in code
- [ ] Final test suite passes (exit 0)
- [ ] No speculation or assumptions in evidence
- [ ] All edge cases handled (if in scope)
- [ ] Error handling verified (if in scope)

**Only when ALL checkboxes are ✅ → PASS verdict.**
