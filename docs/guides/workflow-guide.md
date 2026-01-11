# Workflow Guide

This guide covers common development workflows using hardworker-marketplace plugins. You will learn practical patterns, evidence collection techniques, and best practices.

For plugin installation, see [Getting Started Guide](getting-started.md). For creating custom plugins, see [Plugin Development Guide](plugin-development.md).

## Core Workflow Patterns

### Verification-First Development

The ultrawork plugin enforces strict verification. Every task requires success criteria with evidence.

Workflow:

1. Define goal with measurable outcomes
2. Planner creates tasks with criteria
3. Workers execute tasks
4. Verifier checks criteria with evidence
5. Retry if verification fails (up to max iterations)

Example goal:

```bash
/ultrawork "add password strength validation with minimum 8 characters, 1 number, 1 special character"
```

Planner creates tasks:

```
Task 1: Implement validation function
- Criterion: Function rejects passwords < 8 characters
- Criterion: Function requires at least 1 digit
- Criterion: Function requires at least 1 special character
- Criterion: Unit tests pass (3/3)

Task 2: Integrate with registration endpoint
- Criterion: API returns 400 for weak passwords
- Criterion: Integration tests pass (5/5)
```

### Execute-Verify Loop

Failed verification triggers automatic retry:

```
EXECUTION (attempt 1) → VERIFICATION → FAIL
  ↓
EXECUTION (attempt 2) → VERIFICATION → PASS → COMPLETE
```

Configure maximum attempts:

```bash
/ultrawork --max-iterations 3 "fix authentication bug"
```

Default: 5 iterations. Set lower for faster failure on difficult tasks.

## Common Development Tasks

### Adding New Features

Goal template:

```bash
/ultrawork "implement [feature] with [specific requirements]"
```

Examples:

```bash
# User authentication
/ultrawork "implement JWT-based authentication with 24-hour token expiry"

# API endpoint
/ultrawork "add REST endpoint for user profile updates with input validation"

# Database migration
/ultrawork "create database migration for user roles table with admin, user, guest roles"
```

Success criteria include:

- Implementation matches requirements
- Tests pass (unit + integration)
- Build succeeds without errors
- Documentation updated (API contracts, README)

### Fixing Bugs

Goal template:

```bash
/ultrawork "fix [bug description] in [component]"
```

Examples:

```bash
# Login bug
/ultrawork "fix login failure when username contains special characters"

# Performance issue
/ultrawork "fix slow query in user search endpoint (reduce from 5s to <100ms)"

# Memory leak
/ultrawork "fix memory leak in background job processor"
```

Success criteria include:

- Bug no longer reproduces
- Tests added for regression prevention
- Related edge cases covered

### Refactoring Code

Goal template:

```bash
/ultrawork "refactor [component] to [target structure]"
```

Examples:

```bash
# Extract utility
/ultrawork "extract date formatting logic to shared utility module"

# Simplify function
/ultrawork "refactor user validation function to reduce cyclomatic complexity from 15 to <10"

# Split file
/ultrawork "split 500-line auth.js into separate modules for login, registration, password reset"
```

Success criteria include:

- All tests still pass
- No behavior changes (verified with tests)
- Code metrics improved (complexity, lines per file)

### Writing Tests

Goal template:

```bash
/ultrawork "add tests for [component] covering [scenarios]"
```

Examples:

```bash
# Unit tests
/ultrawork "add unit tests for email validation covering valid formats, invalid formats, edge cases (empty, null, undefined)"

# Integration tests
/ultrawork "add integration tests for user registration endpoint covering success, duplicate email, invalid input"

# Edge case tests
/ultrawork "add tests for date utility covering timezone handling, daylight saving time, leap years"
```

Success criteria include:

- All new tests pass
- Code coverage increased (report with coverage tool)
- Edge cases included (null, undefined, empty, boundary values)

## Evidence Collection

### Test Results

Collect evidence from test runners:

```bash
# Jest
npm test
# Evidence: "Tests: 15 passed, 15 total, exit code 0"

# pytest
pytest tests/
# Evidence: "15 passed in 2.34s, exit code 0"

# Go
go test ./...
# Evidence: "PASS, coverage: 85.2%, exit code 0"
```

Record:
- Pass/fail counts
- Exit code
- Coverage percentage (if available)

### Build Verification

Collect evidence from build tools:

```bash
# TypeScript
npm run build
# Evidence: "Successfully compiled, 0 errors, exit code 0"

# Go
go build ./...
# Evidence: "Build succeeded, exit code 0"

# Rust
cargo build
# Evidence: "Finished dev [unoptimized] target(s) in 3.21s, exit code 0"
```

Record:
- Build success/failure
- Error count
- Exit code

### File Creation

Collect evidence for file operations:

```bash
# Verify file exists
ls -la src/utils/date.ts
# Evidence: "-rw-r--r-- 1 user staff 1234 Jan 11 10:00 src/utils/date.ts"

# Verify file contents
grep -c "export function" src/utils/date.ts
# Evidence: "3 functions exported"
```

Record:
- File path
- File size
- Modification timestamp

### API Testing

Collect evidence from API calls:

```bash
# HTTP request
curl -X POST http://localhost:3000/api/users -d '{"email": "test@example.com"}'
# Evidence: "HTTP 201, response: {\"id\": 123}, exit code 0"

# Load testing
ab -n 1000 -c 10 http://localhost:3000/api/users
# Evidence: "Requests: 1000, failed: 0, mean time: 45ms"
```

Record:
- HTTP status code
- Response body (relevant fields)
- Performance metrics (latency, throughput)

### Code Quality Metrics

Collect evidence from linters and analyzers:

```bash
# ESLint
npm run lint
# Evidence: "0 errors, 0 warnings, exit code 0"

# Cyclomatic complexity
npx complexity-report src/auth.js
# Evidence: "Average complexity: 4.2, max: 8"

# Test coverage
npm test -- --coverage
# Evidence: "Lines: 85.2%, Functions: 90.1%"
```

Record:
- Error/warning counts
- Complexity scores
- Coverage percentages

## Best Practices

### Writing Clear Goals

VAGUE goals cause planning failures:

```bash
# BAD: Too vague
/ultrawork "improve the authentication system"

# GOOD: Specific and measurable
/ultrawork "add rate limiting to authentication endpoint with max 5 attempts per minute per IP"
```

GOOD goals include:
- Specific action (add, fix, refactor)
- Target component (authentication endpoint, user model)
- Measurable outcome (5 attempts per minute, <100ms latency)

### Scoping Work

LARGE goals cause task explosion:

```bash
# BAD: Too broad
/ultrawork "build user management system with roles, permissions, audit logs, and admin dashboard"

# GOOD: Focused scope
/ultrawork "implement user role assignment with admin and user roles"
```

Then chain sessions:

```bash
# Session 1
/ultrawork "implement user role assignment with admin and user roles"

# After completion, session 2
/ultrawork "add permission checks for admin-only endpoints"

# After completion, session 3
/ultrawork "add audit logging for user role changes"
```

### Parallel vs Sequential Execution

Workers execute tasks in parallel when dependencies allow:

```
Task 1: Create database schema
Task 2: Implement user model (depends on Task 1)
Task 3: Implement auth model (depends on Task 1)
Task 4: Write unit tests (depends on Task 2, Task 3)
```

Execution order:
1. Task 1 executes alone
2. Tasks 2 and 3 execute in parallel
3. Task 4 executes after 2 and 3 complete

Planner determines dependencies automatically.

### Handling Verification Failures

If verification fails, check:

1. **Missing tests**: Add test files for new code
2. **Test logic errors**: Fix test assertions
3. **Implementation bugs**: Fix code to pass tests
4. **Insufficient evidence**: Run commands to collect proof

Ultrawork retries automatically. If max iterations reached, manual intervention required.

### Interactive vs Auto Mode

Interactive mode (default):

```bash
/ultrawork "add feature X"
# Planner creates plan
# You review and confirm
# Execution begins
```

Auto mode (skip confirmation):

```bash
/ultrawork --auto "fix bug Y"
# Planner creates plan
# Execution begins immediately
# Use for small, low-risk changes
```

Use auto mode when:
- Goal is simple and low-risk
- You trust the planner
- Iterating on similar tasks

Use interactive mode when:
- Goal is complex
- Reviewing task breakdown is valuable
- Learning how the planner works

## Advanced Patterns

### Plan-Only Mode

Generate plan without execution:

```bash
/ultrawork-plan "implement user authentication"
# Planner creates plan
# Session stops after planning
# Review design at docs/plans/YYYY-MM-DD-{goal-slug}-design.md (in project directory)
# Review tasks at ~/.claude/ultrawork/sessions/{id}/tasks/ (in session directory)
```

Use cases:
- Estimate task complexity
- Review task breakdown before committing
- Generate implementation checklist

### Manual Execution

Execute pre-created plan:

1. Use `/ultrawork-plan` to create the plan with tasks:

```bash
/ultrawork-plan "implement email validation"
```

This creates:
- Design document at `docs/plans/YYYY-MM-DD-{goal-slug}-design.md` (project directory)
- Task files at `~/.claude/ultrawork/sessions/{id}/tasks/*.json` (session directory)

2. Start execution:

```bash
/ultrawork-exec
```

Workers execute tasks based on the created task files.

### Custom Retry Strategies

Configure retry behavior:

```bash
# Fast failure (2 attempts)
/ultrawork --max-iterations 2 "quick fix"

# Extended retry (10 attempts)
/ultrawork --max-iterations 10 "complex refactoring"

# Single-shot (no retry)
/ultrawork --max-iterations 1 "experimental feature"
```

Match iterations to task complexity:
- Simple fixes: 2-3 iterations
- Standard features: 5 iterations (default)
- Complex refactoring: 7-10 iterations

### Evidence Review

Check collected evidence during execution:

```bash
/ultrawork-evidence
```

Output shows:

```
Task 1: Create validation function
Evidence:
- npm test: 15/15 passed, exit code 0
- File created: src/utils/validation.ts (342 bytes)
- Coverage: 92.3% lines

Task 2: Integrate validation
Evidence:
- Integration tests: 8/8 passed, exit code 0
- API response: HTTP 400 for invalid email
```

Use this to debug verification failures.

## Session Management

### Checking Status

```bash
/ultrawork-status
```

Output format:

```
Session ID: 6bd3e4a0-eb03-429a-a8f0-32b46c2fd285
Phase: executing
Goal: Add password strength validation
Tasks: 2 total, 1 resolved, 1 open
Elapsed: 3m 45s
```

Status indicates:
- Current phase (planning, executing, verifying, complete)
- Task progress (resolved/open/blocked counts)
- Time elapsed since session start

### Canceling Sessions

```bash
/ultrawork-cancel
```

Effects:
- Current session marked as cancelled
- Worker agents stop execution
- Session directory preserved for review

Use when:
- Wrong goal specified
- Task taking too long
- Need to start over

### Session Files

Inspect session state directly:

```bash
# Session metadata
cat ~/.claude/ultrawork/sessions/{id}/session.json

# Exploration context
cat ~/.claude/ultrawork/sessions/{id}/context.json

# Task details
cat ~/.claude/ultrawork/sessions/{id}/tasks/*.json

# Design document (in project directory, not session directory)
cat docs/plans/YYYY-MM-DD-{goal-slug}-design.md
```

Session directory persists after completion for audit purposes.

## Troubleshooting

### Planning Failures

Symptom: Planner cannot create task graph

Causes:
- Vague goal description
- Impossible requirements
- Missing context

Solution:

```bash
# BAD
/ultrawork "make it better"

# GOOD
/ultrawork "reduce API response time from 5s to <100ms by adding database indexes"
```

### Worker Failures

Symptom: Worker agent fails during execution

Causes:
- Missing dependencies (packages not installed)
- Syntax errors in code
- File permission issues

Solution:
- Check worker logs in session directory
- Verify dependencies installed
- Run commands manually to reproduce error

### Verification Failures

Symptom: Verifier reports missing evidence

Causes:
- Tests not executed
- Build not run
- Evidence collection script failed

Solution:

```bash
# Manual verification
cd project-root
npm test        # Run tests
npm run build   # Run build
ls -la dist/    # Verify output files
```

Then retry:

```bash
/ultrawork-exec
```

### Session Lock

Symptom: "Session already active" error

Cause: Previous session not properly closed

Solution:

```bash
/ultrawork-cancel
# Then start new session
/ultrawork "new goal"
```

## Performance Optimization

### Parallel Worker Limits

Limit concurrent workers to reduce resource usage:

```bash
/ultrawork --max-workers 2 "large refactoring"
```

Default: 4 workers. Reduce for:
- Resource-constrained environments
- Tasks with heavy build steps
- Debugging (easier to follow logs)

### Skip Verification

Skip verification phase (use with caution):

```bash
/ultrawork --skip-verify "simple documentation update"
```

Only use when:
- No code changes
- Documentation-only updates
- Verification not applicable

### Incremental Sessions

Break large goals into incremental sessions:

```bash
# Session 1: Core functionality
/ultrawork "implement user authentication with login endpoint"

# Session 2: Add features
/ultrawork "add password reset functionality"

# Session 3: Security hardening
/ultrawork "add rate limiting and brute force protection"
```

Benefits:
- Faster verification (smaller scope)
- Clear progress tracking
- Easier debugging

## Integration with CI/CD

### Pre-commit Validation

Use ultrawork for pre-commit checks:

```bash
# .git/hooks/pre-commit
#!/bin/bash
/ultrawork --auto --max-iterations 1 "run tests and linters"
```

Ensures:
- Tests pass before commit
- Linters report no errors
- Build succeeds

### PR Validation

Run ultrawork in CI pipeline:

```yaml
# .github/workflows/validate.yml
name: Validate PR
on: pull_request
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run ultrawork verification
        run: |
          /ultrawork --auto "verify all tests pass and build succeeds"
```

### Deployment Verification

Verify deployment readiness:

```bash
/ultrawork "verify production deployment prerequisites: tests pass, build succeeds, migrations ready"
```

Evidence collected:
- Test results
- Build logs
- Migration file existence
- Configuration validation

## Next Steps

- Install plugins: [Getting Started Guide](getting-started.md)
- Create custom workflows: [Plugin Development Guide](plugin-development.md)
- Review plugin source code in `plugins/` directory

## Additional Resources

- Repository: https://github.com/mnthe/hardworker-marketplace
- Example workflows: See `docs/analysis/` directory
- Plugin specifications: See `/CLAUDE.md` in repository root
