---
name: teamwork-verify
description: "Manually trigger verification for a wave or entire project"
argument-hint: "[--project NAME] [--team NAME] (--wave N | --final)"
allowed-tools: ["Bash", "Read", "Agent"]
---

# Teamwork Verify Command

## Overview

Manually trigger verification for completed work in a teamwork project. Use this to verify:
- **Wave verification**: Check cross-task consistency after wave completion
- **Final verification**: Comprehensive check of entire project before delivery

---

## Step 1: Parse Arguments

Parse options:
- `--project NAME`: Override project detection
- `--team NAME`: Override sub-team detection
- `--wave N`: Verify specific wave number (N = 1, 2, 3, ...)
- `--final`: Verify entire project (all waves)

**Validation:**
- EITHER `--wave` OR `--final` must be provided (not both, not neither)
- `--wave` requires valid integer wave number
- Error if both `--wave` and `--final` provided
- Error if neither `--wave` nor `--final` provided

Detect project/team (if not overridden):
```bash
# Default detection
PROJECT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" || echo "unknown")
SUB_TEAM=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo "main")

# Check for overrides in arguments
```

Teamwork directory: `~/.claude/teamwork/{PROJECT}/{SUB_TEAM}/`

## Step 2: Verify Project Exists

**Check project directory:**
```bash
TEAMWORK_DIR=~/.claude/teamwork/{PROJECT}/{SUB_TEAM}
if [ ! -d "$TEAMWORK_DIR" ]; then
  echo "Error: No teamwork project found at: $TEAMWORK_DIR"
  exit 1
fi
```

**If project doesn't exist:**
```
Error: No teamwork project found for: {PROJECT}/{SUB_TEAM}

Start a project with: /teamwork "your goal"
```

## Step 3: Wave Verification Mode (if --wave N)

**Validate wave exists:**
```bash
# Check if waves.json exists
if [ ! -f "$TEAMWORK_DIR/waves.json" ]; then
  echo "Error: Project has no waves defined (waves.json not found)"
  exit 1
fi

# Check if wave N exists in waves.json
# (read waves.json and verify wave_id N is present)
```

**Spawn wave-verifier agent:**

```
Context:
TEAMWORK_DIR: {absolute path to teamwork directory}
PROJECT: {project name}
SUB_TEAM: {sub-team name}
WAVE_ID: {wave number}
SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts

Task: Verify wave {N} for project {PROJECT}/{SUB_TEAM}

Please verify all tasks in wave {N}, checking for:
- All tasks resolved
- Cross-task file conflicts
- Dependency satisfaction
- Build and test success

Write verification result to {TEAMWORK_DIR}/verification/wave-{N}.json
```

**Agent selection:** `wave-verifier`

**Wait for agent completion** and display summary.

## Step 4: Final Verification Mode (if --final)

**Spawn final-verifier agent:**

```
Context:
TEAMWORK_DIR: {absolute path to teamwork directory}
PROJECT: {project name}
SUB_TEAM: {sub-team name}
SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts

Task: Run final verification for project {PROJECT}/{SUB_TEAM}

Please verify the entire project, checking for:
- All tasks resolved
- All evidence complete (≥ 2 entries per task)
- No blocked patterns in changed files
- Cross-wave dependencies satisfied
- Full project build and test suite passes

Write verification result to {TEAMWORK_DIR}/verification/final.json
```

**Agent selection:** `final-verifier`

**Wait for agent completion** and display summary.

## Step 5: Display Verification Result

**After verification completes, read result file:**

```bash
# Wave verification result
cat {TEAMWORK_DIR}/verification/wave-{N}.json

# OR

# Final verification result
cat {TEAMWORK_DIR}/verification/final.json
```

**Display summary:**

```markdown
═══════════════════════════════════════════════════════════
 VERIFICATION RESULT
═══════════════════════════════════════════════════════════

 Project: {PROJECT}
 Sub-team: {SUB_TEAM}
 Type: {Wave N | Final}
 Verdict: {PASS | FAIL}

───────────────────────────────────────────────────────────
 SUMMARY
───────────────────────────────────────────────────────────

 Total tasks: {count}
 Resolved tasks: {count}
 Conflicts: {count}
 Build: {PASS | FAIL}
 Tests: {passed}/{total}

───────────────────────────────────────────────────────────
 ISSUES
───────────────────────────────────────────────────────────

 {List issues or "No issues found"}

───────────────────────────────────────────────────────────
 VERIFICATION FILE
───────────────────────────────────────────────────────────

 {TEAMWORK_DIR}/verification/{wave-N | final}.json

═══════════════════════════════════════════════════════════
```

**For PASS verdict:**
```
✓ Verification PASSED

All checks completed successfully. The {wave | project} is ready to proceed.
```

**For FAIL verdict:**
```
✗ Verification FAILED

Issues must be resolved before proceeding. See verification file for details.
```

---

## Usage Examples

### Verify Wave 1
```
/teamwork-verify --wave 1
```

### Verify Wave 2 with explicit project
```
/teamwork-verify --project my-app --team auth-team --wave 2
```

### Run final verification
```
/teamwork-verify --final
```

### Final verification with explicit project
```
/teamwork-verify --project my-app --team auth-team --final
```

---

## Error Cases

### Neither --wave nor --final provided
```
Error: Either --wave or --final must be provided

Usage:
  /teamwork-verify --wave N       Verify specific wave
  /teamwork-verify --final        Verify entire project
```

### Both --wave and --final provided
```
Error: Cannot specify both --wave and --final

Choose one:
  /teamwork-verify --wave N       Verify specific wave
  /teamwork-verify --final        Verify entire project
```

### Invalid wave number
```
Error: Invalid wave number: {value}

Wave number must be a positive integer (1, 2, 3, ...)
```

### Wave not found
```
Error: Wave {N} not found in project

Available waves: {list of wave numbers from waves.json}
```

### Project not found
```
Error: No teamwork project found for: {PROJECT}/{SUB_TEAM}

Start a project with: /teamwork "your goal"
```

### No waves defined
```
Error: Project has no waves defined (waves.json not found)

This project may not be using wave-based workflow.
Use /teamwork-verify --final for complete project verification.
```

---

## Integration with Workflow

**When to use:**

| Scenario | Command |
|----------|---------|
| All wave tasks complete | `/teamwork-verify --wave N` |
| All waves complete | `/teamwork-verify --final` |
| Manual quality check | `/teamwork-verify --wave N` or `--final` |
| Before PR/delivery | `/teamwork-verify --final` |

**Verification gates:**
- Wave verification blocks progression to next wave (if FAIL)
- Final verification blocks project completion (if FAIL)

**Failed verification:**
1. Review verification file for issue details
2. Fix identified problems
3. Re-run verification
4. Repeat until PASS verdict
