# Success Criteria Guide

## Why Success Criteria Matter

Without clear criteria:
- Workers don't know when they're "done"
- Verification is subjective
- Evidence collection is impossible

With clear criteria:
- Binary pass/fail determination
- Automated verification possible
- Evidence is specific and actionable

## SMART Criteria

| Property | Description | Example |
|----------|-------------|---------|
| **S**pecific | Exactly what must happen | "POST /api/users returns 201" |
| **M**easurable | Can be verified | "Test coverage > 80%" |
| **A**chievable | Actually possible | Not "zero bugs forever" |
| **R**elevant | Relates to the goal | Not "code is pretty" |
| **T**estable | Can prove it | Command/test that verifies |

## Criteria Templates

### API Endpoint
```markdown
Success Criteria:
- Endpoint responds with 200 for valid input
- Returns expected JSON schema
- Returns 400 for invalid input with error message
- Returns 401 for unauthenticated requests

Evidence: curl commands or test output
```

### Database Change
```markdown
Success Criteria:
- Migration runs without error
- Rollback works without error
- Existing data is preserved
- New queries execute correctly

Evidence: Migration output, query results
```

### UI Component
```markdown
Success Criteria:
- Component renders without console errors
- Handles loading state
- Handles error state
- Handles empty state
- Passes accessibility checks

Evidence: Test output, screenshot
```

### Performance Optimization
```markdown
Success Criteria:
- Response time reduced from Xms to <Yms
- Memory usage stays under Zmb
- No regression in functionality

Evidence: Benchmark before/after
```

### Bug Fix
```markdown
Success Criteria:
- Failing test now passes
- Original issue no longer reproducible
- No new test failures introduced

Evidence: Test output, reproduction steps
```

### Refactoring
```markdown
Success Criteria:
- All existing tests pass
- No behavior changes
- Code complexity reduced (if measurable)

Evidence: Test output, complexity metrics
```

## Evidence Formats

| Type | When to Use | Example |
|------|-------------|---------|
| Test output | Automated tests exist | `npm test` exit code 0 |
| Command output | CLI verification | `curl -I /api/health` → 200 |
| Screenshot | Visual verification | UI renders correctly |
| Metrics | Performance | Before: 2s, After: 200ms |
| Logs | Runtime behavior | No errors in logs |

## Anti-Patterns

### Too Vague
```
❌ "It works"
❌ "Code is clean"
❌ "User can login"

✅ "POST /login returns JWT token"
✅ "No ESLint errors"
✅ "Login test passes with valid credentials"
```

### Unmeasurable
```
❌ "Performance is better"
❌ "UX is improved"

✅ "Page load < 2s on 3G"
✅ "User can complete checkout in < 5 clicks"
```

### Too Many Criteria
```
❌ 20 criteria for one task (task too big)
✅ 2-5 criteria per task, split if more needed
```

## Verification Checklist

Before finalizing success criteria, ask:
1. Can a worker know exactly when they're done?
2. Can evidence be collected automatically or easily?
3. Is there a single source of truth (test, command, metric)?
4. Would two people agree on pass/fail?
