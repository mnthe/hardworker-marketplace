# Codex Auxiliary Verifier (이중 게이트) Design

## Outcome

**Status**: PASS
**Completed**: 2026-02-07

Codex dual gate verification implemented in both ultrawork and teamwork plugins. Fork-join pattern with graceful degradation when Codex is not installed. Triple gate (Claude + Codex + Doc) verification system deployed as ultrawork v1.0.0.

## Goal

ultrawork / teamwork 플러그인의 검증 단계에 Codex CLI를 보조 검증기로 추가하여 이중 게이트(dual gate) 검증 체계를 구축한다.

## Architecture

### Dual Gate Verification

```
Verification Phase (Non-blocking Parallel):

┌─────────────────────────────────────────────────────┐
│                   Verifier Agent                     │
│                                                      │
│  Phase 0: Fork Codex (background)                    │
│    bg = Bash("codex-verify.js ...",                  │
│              run_in_background=True)                 │
│                                                      │
│  Phase 1-3: Evidence Audit + Pattern Scan            │
│    (Claude gate runs while Codex works in parallel)  │
│                                                      │
│  Phase 4: Final Tests (npm test, build)              │
│                                                      │
│  Phase 4.5: Join - Await Codex Result                │
│    codex_result = TaskOutput(bg, block=True)         │
│                                                      │
│  Phase 5: Combined PASS/FAIL Determination           │
│    PASS = Claude Gate ✓ AND Codex Gate ✓ (or SKIP)  │
│    FAIL = Claude Gate ✗ OR  Codex Gate ✗             │
└─────────────────────────────────────────────────────┘
```

### Decision Table

| Claude Gate | Codex Gate | Final Verdict | Notes |
|-------------|------------|---------------|-------|
| PASS | PASS | **PASS** | Both gates agree |
| PASS | FAIL | **FAIL** | Codex found issues Claude missed |
| FAIL | PASS | **FAIL** | Claude found issues |
| FAIL | FAIL | **FAIL** | Both found issues |
| PASS | SKIP | **PASS** | Codex not installed, graceful degradation |
| FAIL | SKIP | **FAIL** | Claude found issues, Codex unavailable |

### Graceful Degradation

- Codex CLI not installed → `verdict: "SKIP"`, exit 0
- Codex API error/timeout → `verdict: "FAIL"`, include error details
- Codex output unparseable → `verdict: "FAIL"`, include raw output

## Components

### 1. `codex-verify.js` (Shared Script)

**Location**: `plugins/{ultrawork,teamwork}/src/scripts/codex-verify.js`

Each plugin gets its own copy (per project copy-and-adapt convention).

**Interface**:
```bash
bun codex-verify.js \
  --mode full|review|exec|check \
  --working-dir /path/to/project \
  --criteria "Tests pass|API responds 200|Auth middleware works" \
  --output /tmp/codex-result.json \
  --model o3-mini    # optional model override
```

**Modes**:
| Mode | Action | Use Case |
|------|--------|----------|
| `check` | Check codex CLI availability | Pre-flight check |
| `review` | Run `codex review --uncommitted` | Code quality review |
| `exec` | Run `codex exec` with criteria prompt | Criteria verification |
| `full` | Run both review + exec | Complete dual verification |

**Output JSON**:
```json
{
  "available": true,
  "mode": "full",
  "review": {
    "exit_code": 0,
    "output": "Review summary...",
    "issues": [
      {"severity": "warning", "file": "src/auth.ts", "line": 42, "message": "..."}
    ]
  },
  "exec": {
    "exit_code": 0,
    "output": "Verification summary...",
    "criteria_results": [
      {"criterion": "Tests pass", "status": "PASS", "evidence": "..."},
      {"criterion": "API responds 200", "status": "FAIL", "evidence": "..."}
    ]
  },
  "verdict": "PASS",
  "summary": "All criteria verified. No critical issues found."
}
```

**Codex exec prompt template**:
```
You are verifying code changes in a project.

Project directory: {working_dir}
Goal: {goal}

Success criteria to verify:
{criteria_list}

For each criterion:
1. Read the relevant code
2. Check if the criterion is met
3. Report PASS or FAIL with evidence

Output your findings as structured text.
```

**Codex review invocation**:
```bash
codex review --uncommitted --sandbox read-only
```

**Codex exec invocation**:
```bash
codex exec \
  --sandbox read-only \
  -C "{working_dir}" \
  --output-last-message /tmp/codex-exec-result.txt \
  "{verification_prompt}"
```

### 2. Ultrawork Verifier Update

**File**: `plugins/ultrawork/agents/verifier/AGENT.md`

Add Phase 0 (fork) and Phase 4.5 (join):

```markdown
### Phase 0: Fork Codex Verification (Background)

If codex-verify.js is available, launch it in background:

    bg = Bash(
      "bun {SCRIPTS_PATH}/codex-verify.js --mode full \
        --working-dir {WORKING_DIR} \
        --criteria '{all_criteria_pipe_separated}' \
        --output /tmp/codex-{SESSION_ID}.json",
      run_in_background=True
    )

### Phase 4.5: Join Codex Result

    codex_output = TaskOutput(bg, block=True, timeout=300000)
    codex_result = Read("/tmp/codex-{SESSION_ID}.json")

If codex verdict is FAIL:
  - Add Codex issues to fail reasons
  - Create fix tasks for Codex-identified issues
```

### 3. Teamwork Final-Verifier Update

**File**: `plugins/teamwork/agents/final-verifier/AGENT.md`

Same fork-join pattern, adapted for teamwork's native API:

```markdown
### Step 0: Fork Codex Verification

Launch codex-verify.js in background before starting main verification.

### Step 4.5: Join Codex Result

Read Codex result before sending verdict to orchestrator.
Include Codex findings in SendMessage report.
```

### 4. Codex exec Output Schema

**File**: `plugins/{plugin}/src/scripts/codex-output-schema.json`

```json
{
  "type": "object",
  "properties": {
    "criteria_results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "criterion": { "type": "string" },
          "status": { "type": "string", "enum": ["PASS", "FAIL"] },
          "evidence": { "type": "string" }
        },
        "required": ["criterion", "status", "evidence"]
      }
    },
    "overall_verdict": { "type": "string", "enum": ["PASS", "FAIL"] },
    "summary": { "type": "string" }
  },
  "required": ["criteria_results", "overall_verdict", "summary"]
}
```

## File Changes

### New Files
| File | Plugin | Purpose |
|------|--------|---------|
| `src/scripts/codex-verify.js` | ultrawork | Codex CLI wrapper script |
| `src/scripts/codex-verify.js` | teamwork | Codex CLI wrapper script (adapted copy) |
| `src/scripts/codex-output-schema.json` | ultrawork | JSON schema for codex exec output |
| `src/scripts/codex-output-schema.json` | teamwork | JSON schema for codex exec output (copy) |

### Modified Files
| File | Plugin | Change |
|------|--------|--------|
| `agents/verifier/AGENT.md` | ultrawork | Add Phase 0 (fork) and Phase 4.5 (join) |
| `agents/final-verifier/AGENT.md` | teamwork | Add Step 0 (fork) and Step 4.5 (join) |
| `.claude-plugin/plugin.json` | ultrawork | Version bump |
| `.claude-plugin/plugin.json` | teamwork | Version bump |
| `.claude-plugin/marketplace.json` | root | Version sync |
| `CLAUDE.md` | ultrawork | Document Codex integration |
| `CLAUDE.md` | teamwork | Document Codex integration |

## Non-Goals

- No changes to the core verification logic (evidence audit, pattern scan remain unchanged)
- No Codex integration in execution phase (workers don't use Codex)
- No Codex integration in exploration/planning phases
- No mandatory Codex dependency (graceful degradation when absent)

## Execution Summary

| Component | Status | Key Evidence |
|-----------|--------|--------------|
| codex-verify.js (ultrawork) | Implemented | Script created with check/review/exec/full modes |
| codex-verify.js (teamwork) | Implemented | Adapted copy for teamwork |
| codex-output-schema.json | Implemented | JSON schema for exec output |
| Verifier AGENT.md update | Implemented | Phase 0 (fork) + Phase 4.5 (join) added |
| Final-verifier AGENT.md update | Implemented | Step 0 + Step 4.5 added |
