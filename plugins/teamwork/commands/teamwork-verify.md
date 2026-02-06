---
name: teamwork-verify
description: "Manually trigger project verification"
allowed-tools: ["Task", "TaskList", "Read"]
---

# Teamwork Verify Command

## Overview

Manually trigger final verification for a teamwork project. Spawns a final-verifier teammate to perform comprehensive checks on the entire project.

---

## Step 1: Check Project State

Use TaskList to verify there are completed tasks to check:

```python
tasks = TaskList()
# Count completed vs total tasks
```

**If no completed tasks:**
```
No completed tasks found. Nothing to verify.

Use /teamwork-status to check progress.
```

## Step 2: Spawn Final Verifier

**ACTION REQUIRED - Call Task tool with:**
- subagent_type: "teamwork:final-verifier"
- model: "opus"
- prompt:
  ```
  Task: Run final verification for the project.

  Please verify the entire project, checking for:
  - All tasks completed with evidence
  - No file conflicts between tasks
  - Full project build succeeds
  - Test suite passes
  - No blocked patterns in changed files
  - Cross-task dependencies satisfied

  Use TaskList to review all tasks and their status.
  Use Read and Bash to verify build/test results.

  Report your findings with a clear PASS or FAIL verdict.
  ```

Wait for verifier to complete.

## Step 3: Display Verification Result

```markdown
# Verification Result

## Verdict
{PASS or FAIL}

## Summary
{verifier's findings}

## Details
- Tasks checked: {count}
- Build: {PASS/FAIL}
- Tests: {passed}/{total}
- Issues: {list or "None"}

## Next Steps
{If PASS: "Project verified. Ready for delivery."}
{If FAIL: "Issues found. Review details above and fix."}
```

---

## Usage Examples

```bash
# Run final verification
/teamwork-verify

# After fixing issues, re-verify
/teamwork-verify
```

---

## Integration with Workflow

| Scenario | Action |
|----------|--------|
| All tasks complete | Run `/teamwork-verify` |
| Verification fails | Fix issues, then re-run |
| Before PR/delivery | Run for final quality check |
