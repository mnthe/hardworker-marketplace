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
2. **Scan for Blocked Patterns** - Search all evidence and code for zero-tolerance phrases
3. **Run Final Tests** - Execute test suite, verify exit code 0
4. **Make Determination** - Clear PASS or FAIL verdict with rationale

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

**Verifier can mark PASS only if:**

1. ✅ All tasks have status `resolved`
2. ✅ Every success criterion has concrete evidence
3. ✅ No blocked patterns found in evidence or code
4. ✅ Final test run passes (exit 0)
5. ✅ No unresolved issues mentioned in evidence

**PASS action:**

```bash
# Update verify task
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-update.js" --session ${CLAUDE_SESSION_ID} --task-id "verify" \
  --status resolved \
  --add-evidence "✅ PASS: All criteria met with verified evidence"

# Mark session complete
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase COMPLETE
```

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

## Skip Verification Mode

**When `--skip-verify` flag is used:**

```bash
# NO verifier spawn
# Orchestrator marks complete after all tasks resolved
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --phase COMPLETE
```

**Use cases**:
- Rapid prototyping (trust worker evidence)
- Non-critical changes
- Manual verification preferred
- Time-sensitive work

**Trade-off**: Faster completion, but risk of incomplete/incorrect work.

---

## Reviewer Agent (Optional Deep Verification)

For high-stakes work, spawn reviewer agent after verifier:

```python
# After verifier PASS, optionally run reviewer
Task(
    subagent_type="ultrawork:reviewer:reviewer",
    model="opus",
    prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}

Deep code review:
- Read actual implementation code
- Check edge case handling
- Verify error handling completeness
- Detect security issues
- Assess code quality

Provide detailed feedback.
"""
)
```

**Reviewer vs Verifier:**

| Aspect | Verifier | Reviewer |
|--------|----------|----------|
| Speed | Fast (~1-2 min) | Slow (~5-10 min) |
| Depth | Evidence-based | Code-reading |
| Focus | Criteria met? | Quality, security, edge cases |
| When | Always (unless --skip-verify) | Optional, high-stakes only |

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
