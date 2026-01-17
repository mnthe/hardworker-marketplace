---
name: teamwork-worker
description: "Claim and complete teamwork tasks (one-shot or continuous loop)"
argument-hint: "[--project NAME] [--team NAME] [--role ROLE] [--loop] [--strict] [--fresh-start-interval N] [--poll-interval N] | --help"
allowed-tools: ["Bash(bun ${CLAUDE_PLUGIN_ROOT}/src/scripts/worker-setup.js:*)", "Bash(sleep:*)", "Task", "TaskOutput", "Read", "Edit", "mcp__plugin_serena_serena__activate_project"]
---

# Teamwork Worker Command

## Overview

Workers claim and complete tasks from a teamwork project. Can run in one-shot mode (default) or continuous loop mode.

**Automatic Role Detection**: When `--role` is not specified, the worker automatically detects the role from the first available task and spawns the appropriate role-specific agent (frontend, backend, test, etc.). This ensures tasks are handled by agents with specialized knowledge and tools for their domain.

**Role Selection Precedence**: `--role` flag (explicit) > task.role (auto-detected) > "worker" (generic fallback)

---

## Step 0: Serena Project Activation (Optional)

If the MCP tool `mcp__plugin_serena_serena__activate_project` is available, activate Serena for enhanced code navigation:

```python
# Check if Serena is available and activate
if "mcp__plugin_serena_serena__activate_project" in available_tools:
    try:
        mcp__plugin_serena_serena__activate_project(project=".")
        # Serena enabled - worker agents can use symbol-based tools
    except:
        pass  # Continue without Serena
```

**Benefits when Serena is active:**
- Workers: `replace_symbol_body`, `rename_symbol` for safe refactoring
- Role specialists: Symbol-based tools for their expertise area

**If Serena is not available, agents will use standard tools (Read, Edit, Grep).**

---

## Step 1: Parse Arguments

Execute the worker setup script:

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/worker-setup.js" $ARGUMENTS
```

Parse the output to get:
- Project name
- Sub-team name
- Role filter (optional)
- Loop mode (true/false)
- Strict mode (true/false)
- Fresh start interval (number, default 10)
- Poll interval (number, default 30 seconds)
- Teamwork directory path

### Polling Mode (when `--loop` is enabled)

**If worker-setup.js fails (no project found or no open tasks) AND `--loop` is enabled:**

Instead of exiting with error, enter polling mode:

```python
poll_interval = args.poll_interval or 30  # seconds
max_retries = None  # infinite until manual stop

while True:
    result = run_worker_setup()

    if result.success:
        break  # Project found and tasks available

    # Output timestamped status
    timestamp = datetime.now().strftime("%H:%M:%S")
    if "No teamwork project found" in result.error:
        print(f"[{timestamp}] Waiting for project {project}/{team}...")
    elif "No open tasks" in result.error:
        print(f"[{timestamp}] No available tasks (role: {role}). Waiting {poll_interval}s...")

    # Wait before retry
    sleep(poll_interval)
```

**Output format during polling:**
```
[15:50:30] Waiting for project item-search/master...
[15:51:00] Waiting for project item-search/master...
[15:51:30] Project found: item-search/master
[15:51:30] Found 5 open tasks. Starting worker...
```

**If `--loop` is NOT enabled:**
Show error and suggest `/teamwork "goal"` first (existing behavior).

**If `--loop` mode and project ready:**
Register loop state for this terminal:

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/loop-state.js" --start --project "{PROJECT}" --team "{SUB_TEAM}" --role "{ROLE}"
```

## Step 2: Check for Available Tasks

Read task files to find available work:

```bash
ls {TEAMWORK_DIR}/{PROJECT}/{SUB_TEAM}/tasks/
```

Count:
- Total tasks
- Open tasks
- Tasks matching role filter (if specified)

**If no open tasks:**
```
No open tasks available.
Project complete or all tasks claimed.

Use /teamwork-status to check progress.
```

## Step 2.5: Detect Task Role (if --role not specified)

**If user did NOT specify `--role` flag:**

Query available tasks to detect role from first available task:

```bash
AVAILABLE_TASKS=$(bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/task-list.js" \
  --project {PROJECT} \
  --team {SUB_TEAM} \
  --available \
  --format json)
```

Parse first task's role field:

```bash
DETECTED_ROLE=$(echo "$AVAILABLE_TASKS" | bun -e "
  const tasks = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  if (tasks.length > 0 && tasks[0].role) {
    console.log(tasks[0].role);
  } else {
    console.log('worker');
  }
")
```

**Variable values:**
- `DETECTED_ROLE`: Role from first available task, or "worker" if no tasks or no role field

**If user specified `--role` flag:**
Skip this step. Use user-specified role directly.

## Step 2.6: Detect Task Complexity (for model selection)

**Read the first available task's complexity field:**

```bash
TASK_COMPLEXITY=$(echo "$AVAILABLE_TASKS" | bun -e "
  const tasks = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  if (tasks.length > 0 && tasks[0].complexity) {
    console.log(tasks[0].complexity);
  } else {
    console.log('standard');
  }
")
```

**Variable values:**
- `TASK_COMPLEXITY`: Complexity from first available task ('simple', 'standard', 'complex'), or 'standard' if not specified

**Model Selection Logic:**

| Complexity | Model | Rationale |
|------------|-------|-----------|
| `simple` | haiku | Single file changes, minor edits |
| `standard` | sonnet | Multi-file CRUD, typical implementation |
| `complex` | opus | Architecture changes, 5+ files, security-critical |

## Step 3: Spawn Worker Agent

**Determine agent type using precedence order:**

Use the following logic to select `subagent_type`:

```python
# Precedence: user --role > detected task.role > default 'worker'
if user_specified_role:
    # User explicitly specified --role flag (highest priority)
    subagent_type = f"teamwork:{user_specified_role}"
    role_filter = user_specified_role
elif DETECTED_ROLE and DETECTED_ROLE != "worker":
    # Role detected from task in Step 2.5 (medium priority)
    subagent_type = f"teamwork:{DETECTED_ROLE}"
    role_filter = DETECTED_ROLE
else:
    # Default fallback (lowest priority)
    subagent_type = "teamwork:worker"
    role_filter = None
```

**Valid role values**: `frontend`, `backend`, `test`, `devops`, `docs`, `security`, `review`, `worker`

**Determine model using complexity:**

```python
# Dynamic model selection based on task complexity
if TASK_COMPLEXITY == "simple":
    model = "haiku"
elif TASK_COMPLEXITY == "complex":
    model = "opus"
else:  # "standard" or default
    model = "sonnet"
```

**ACTION REQUIRED - Call Task tool with:**
- subagent_type: `{subagent_type}` (determined using logic above)
- model: `{model}` (determined by complexity: simple→haiku, standard→sonnet, complex→opus)
- prompt:
  ```
  TEAMWORK_DIR: {teamwork_dir}
  PROJECT: {project}
  SUB_TEAM: {sub_team}
  SCRIPTS_PATH: ${CLAUDE_PLUGIN_ROOT}/src/scripts

  Options:
  - role_filter: {role_filter}
  - strict_mode: {true or false}
  - fresh_start_interval: {N or 10}
  ```

Wait for worker to complete using TaskOutput.

**Strict Mode Behavior:**

When `--strict` is enabled, workers must:
- Provide concrete evidence for EVERY success criterion
- Run tests and capture exit codes
- Document file paths created/modified
- Include command outputs in evidence
- Never mark tasks resolved without verification

Without `--strict`, workers use relaxed evidence collection (implementation-focused).

## Step 4: Report Result

Display what happened:

```markdown
# Task Completed

## Task
{task.subject}

## Status
{resolved or failed}

## Evidence
{list of evidence}

## Progress
{resolved}/{total} tasks complete
```

## Step 5: Loop Mode (if --loop)

**If `--loop` was set and there are more open tasks:**

Output the continue marker:

```
__TEAMWORK_CONTINUE__
```

The hook reads state from `loop-state.js` and triggers the next iteration with saved context.

**If no more tasks:**

```!
bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/loop-state.js" --clear
```

Exit and report completion.

---

## Options Reference

| Option | Description |
|--------|-------------|
| `--project NAME` | Override project name (default: git repo name) |
| `--team NAME` | Override sub-team name (default: branch name) |
| `--role ROLE` | Only claim tasks with this role |
| `--loop` | Continuous mode - keep claiming tasks, enables polling when project/tasks not found |
| `--strict` | Enable strict evidence mode (require concrete verification for all criteria) |
| `--fresh-start-interval N` | Reset context every N tasks (default: 10, 0 = disabled) |
| `--poll-interval N` | Seconds to wait between polling attempts in loop mode (default: 30) |

## Role Options

| Role | Description |
|------|-------------|
| `frontend` | UI, components, styling |
| `backend` | API, services, database |
| `test` | Tests, fixtures, mocks |
| `devops` | CI/CD, deployment |
| `docs` | Documentation |
| `security` | Auth, permissions |
| `review` | Code review |

---

## Examples

```bash
# One-shot: complete one task
/teamwork-worker

# Auto-detect role from task (smart agent selection)
# If first available task has role="backend", spawns teamwork:backend agent
# If first available task has role="frontend", spawns teamwork:frontend agent
# If no role specified in task, falls back to generic teamwork:worker
/teamwork-worker

# Continuous: keep working until done (with auto-detection)
/teamwork-worker --loop

# Explicit role override (ignores task.role field)
/teamwork-worker --role frontend

# Specialized continuous
/teamwork-worker --role backend --loop

# Strict evidence mode (for wave verification)
/teamwork-worker --strict

# Strict + loop (continuous with verification)
/teamwork-worker --strict --loop

# Strict + role specialization
/teamwork-worker --role test --strict

# Fresh start every 5 tasks (helps with stuck context)
/teamwork-worker --loop --fresh-start-interval 5

# Disable fresh start (never reset context)
/teamwork-worker --loop --fresh-start-interval 0

# Specific project
/teamwork-worker --project myapp --team feature-x

# Start worker before project exists (polling mode)
# Worker will wait for project to be created by orchestrator
/teamwork-worker --loop
# Output: [15:50:30] Waiting for project item-search/master...

# Custom poll interval (60 seconds)
/teamwork-worker --loop --poll-interval 60
```

### Agent Selection Examples

```bash
# Scenario 1: Task has role="backend", no --role flag specified
# → Spawns teamwork:backend agent (auto-detected)

# Scenario 2: Task has role="frontend", --role backend specified
# → Spawns teamwork:backend agent (explicit flag takes precedence)

# Scenario 3: Task has no role field (or role="worker"), no --role flag
# → Spawns teamwork:worker agent (generic fallback)

# Scenario 4: Multiple tasks, first has role="test", no --role flag
# → Spawns teamwork:test agent (uses first available task's role)
```
