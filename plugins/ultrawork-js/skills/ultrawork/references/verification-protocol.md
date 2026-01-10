# Verification Protocol

## Core Principle

**No completion claim without evidence.**

## Evidence Collection

### When to Collect

| Event | Action |
|-------|--------|
| Worker completes task | Extract evidence from output |
| Test command runs | Capture exit code + output |
| Build succeeds | Capture build output |
| API verified | Capture response |

### How to Collect

Workers must report evidence in their output:

```
TASK COMPLETE

Evidence:
- Criteria: "Tests pass"
  Command: npm test
  Output: "47 tests passed, 0 failed"
  Exit code: 0

- Criteria: "No lint errors"
  Command: npm run lint
  Output: "No issues found"
  Exit code: 0
```

### Evidence Storage

1. Parse worker output for evidence blocks
2. Add to task's evidence array in session.json
3. Add to global evidence_log
4. Update Task via TaskUpdate(addComment)

## Verification Checklist

Before marking any task complete:

```
[ ] All success criteria have evidence
[ ] Evidence is concrete (not "it works")
[ ] Commands show exit code 0 where relevant
[ ] No blocked phrases in output
```

## Blocked Phrases

If ANY of these appear without counter-evidence, block completion:

| Phrase | Problem |
|--------|---------|
| "should work" | Speculation |
| "probably" | Uncertainty |
| "might need" | Incomplete |
| "TODO" | Unfinished |
| "basic version" | Partial |
| "simplified" | Partial |
| "you can add" | Incomplete |
| "for now" | Temporary |

## Counter-Evidence

Blocked phrase can be overridden with explicit evidence:

```
Note: Using "basic version" of auth for MVP scope.
Counter-evidence: User confirmed MVP scope acceptable.
```

## Verification Task

The verification task (created by planner) runs last:

```markdown
## Verification Task Checklist

1. All implementation tasks resolved?
   → TaskList shows all child tasks resolved

2. All success criteria have evidence?
   → Check evidence_log covers all criteria

3. Tests pass?
   → Run test suite, capture output

4. Build succeeds?
   → Run build, capture output

5. No blocked phrases?
   → Scan all task outputs

Only mark COMPLETE if ALL pass.
```

## Failure Handling

If verification fails:

1. Identify failing criterion
2. Log failure reason
3. Keep phase as VERIFICATION (not COMPLETE)
4. Report specific failure to user
5. User decides: fix and retry, or cancel

## Evidence Quality

### Good Evidence
```
Command: npm test
Output: "
  PASS src/auth.test.ts
  PASS src/user.test.ts

  Test Suites: 2 passed, 2 total
  Tests: 15 passed, 15 total
"
Exit: 0
```

### Bad Evidence
```
"Tests work fine"
"I ran the tests and they passed"
"Should be good now"
```
