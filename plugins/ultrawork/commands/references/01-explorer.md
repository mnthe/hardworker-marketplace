# Explorer Phase Reference

**Used by**: `ultrawork.md`, `ultrawork-plan.md`

**Purpose**: Quickly understand codebase structure and identify areas for detailed exploration based on goal.

---

## Stage 1: Quick Overview (Direct via Skill)

**Invoke the overview-exploration skill directly (no agent spawn):**

```python
Skill(skill="ultrawork:overview-exploration")
```

The skill will:
1. Update exploration_stage to "overview"
2. Directly explore project structure using Glob, Read, Grep
3. Write `exploration/overview.md` (in session directory)
4. Initialize `context.json`

**Time budget**: ~30 seconds, max 5-7 file reads

This is synchronous - no polling needed. Proceed to Stage 2 after skill completes.

---

## Stage 2: Analyze & Plan Targeted Exploration

**Update exploration_stage to "analyzing":**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --exploration-stage analyzing
```

Based on **Overview + Goal**, decide what areas need detailed exploration.

### Decision Matrix

| Goal Keywords     | Detected Stack | Explore Areas                              |
| ----------------- | -------------- | ------------------------------------------ |
| auth, login, user | Next.js        | middleware, api/auth, existing user model  |
| auth, login, user | Express        | routes, passport config, session           |
| api, endpoint     | Any            | existing routes, controllers, schemas      |
| database, model   | Prisma         | schema.prisma, migrations, existing models |
| database, model   | TypeORM        | entities, migrations                       |
| test, coverage    | Any            | existing tests, test config, mocks         |
| ui, component     | React/Next     | components/, design system, styles         |
| bug, fix, error   | Any            | related files from error context           |

### Generate exploration hints dynamically

```python
# Analyze overview + goal
hints = analyze_exploration_needs(overview, goal)

# Example outputs:
# Goal: "Add user authentication"
# Overview: Next.js with Prisma, no existing auth
# → hints = [
#     "Authentication patterns: middleware, session, JWT",
#     "Database: user model patterns in existing Prisma schema",
#     "API routes: existing route patterns in app/api/"
# ]
```

### Set expected explorers BEFORE spawning (CRITICAL)

```bash
# Generate expected explorer IDs
expected_ids="overview"
for i, hint in enumerate(hints):
    expected_ids += f",exp-{i+1}"

# Initialize context.json with expected explorers
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-init.js" --session ${CLAUDE_SESSION_ID} --expected "{expected_ids}"
```

This ensures:
1. `expected_explorers` is set before spawning
2. `exploration_complete` auto-updates when all explorers finish

---

## Stage 3: Targeted Exploration

**Update exploration_stage to "targeted":**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --exploration-stage targeted
```

Spawn explorers for each identified area (parallel, in single message):

```python
# Get session directory directly
SESSION_DIR = "~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}"

# Call multiple Tasks in single message = automatic parallel execution
for i, hint in enumerate(hints):
    Task(
      subagent_type="ultrawork:explorer:explorer",
      model="haiku",  # or sonnet for complex areas
      prompt=f"""
SESSION_ID: ${CLAUDE_SESSION_ID}
EXPLORER_ID: exp-{i+1}

SEARCH_HINT: {hint}

CONTEXT: {overview_summary}
"""
    )
# All explorers run in parallel and results are collected
```

**After all explorers complete, update exploration_stage to "complete":**

```bash
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-update.js" --session ${CLAUDE_SESSION_ID} --exploration-stage complete
```

---

## Resume Check (for interrupted sessions)

**Before starting exploration, check session state to determine where to resume:**

```bash
# Get session directory
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}

# Read session state via script (NEVER cat JSON directly)
EXPLORATION_STAGE=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/session-get.js" --session ${CLAUDE_SESSION_ID} --field exploration_stage)

# Read context via script (NEVER Read JSON directly)
EXPLORATION_COMPLETE=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --field exploration_complete)
EXPECTED_EXPLORERS=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --field expected_explorers)
EXPLORERS=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/context-get.js" --session ${CLAUDE_SESSION_ID} --field explorers)
```

### Resume logic by exploration_stage

| Stage         | Status                           | Action                                             |
| ------------- | -------------------------------- | -------------------------------------------------- |
| `not_started` | Fresh start                      | Begin from Stage 1 (Overview)                      |
| `overview`    | Overview running/done            | Check overview.md exists → proceed to Stage 2      |
| `analyzing`   | Hints generated, no targeted yet | Re-run hint analysis, set expected_explorers       |
| `targeted`    | Targeted explorers running       | Check expected vs actual, wait or re-spawn missing |
| `complete`    | Exploration done                 | Skip to Planning                                   |

```python
if exploration_stage == "not_started":
    # Fresh start - go to Stage 1
    pass

elif exploration_stage == "overview":
    # Check if overview actually completed
    if Path(f"{session_dir}/exploration/overview.md").exists():
        # Proceed to Stage 2 (analyze & plan targeted)
        pass
    else:
        # Re-spawn overview explorer
        pass

elif exploration_stage == "analyzing":
    # Overview done, need to generate hints and set expected_explorers
    # Go to Stage 2
    pass

elif exploration_stage == "targeted":
    if expected_explorers and not exploration_complete:
        missing = set(expected_explorers) - set(actual_explorers)
        if missing:
            print(f"Exploration incomplete. Missing: {missing}")
            # Re-spawn missing explorers
            pass

elif exploration_stage == "complete":
    # Skip to planning
    pass
```

**Key checks:**
1. `exploration_stage` in session.json determines resume point
2. `expected_explorers` vs `explorers[].id` identifies missing work
3. `exploration_complete` confirms all expected explorers finished

---

## Exploration Output

Explorers will create:
- `exploration/overview.md` - Project overview
- `exploration/exp-1.md`, `exp-2.md`, ... - Targeted findings
- `context.json` - Aggregated summary with links (exploration_complete=true when all done)
