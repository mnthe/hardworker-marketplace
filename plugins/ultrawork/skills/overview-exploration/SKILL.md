---
name: overview-exploration
description: "This skill should be used when performing quick project overview exploration at the start of ultrawork sessions. Executes directly without agent spawn for fast codebase understanding."
user-invocable: false
---

# Overview Exploration Skill

Quick project overview exploration executed directly without agent spawn.

## When to Use

- At the start of ultrawork sessions (exploration phase)
- When project structure understanding is needed
- Context collection before targeted exploration

---

## Execution Steps

### Step 1: Detect Project Type

Check for language/framework config files:

```python
Glob(pattern="package.json")      # Node.js/JS
Glob(pattern="go.mod")            # Go
Glob(pattern="requirements.txt")  # Python
Glob(pattern="Cargo.toml")        # Rust
Glob(pattern="pom.xml")           # Java/Maven
```

Read discovered files to understand dependencies and framework.

### Step 2: Explore Directory Structure

```python
# Top-level structure
Glob(pattern="*", path=".")

# Main source directories
Glob(pattern="src/*")
Glob(pattern="app/*")
Glob(pattern="lib/*")
```

### Step 3: Identify Entry Points and Patterns

```python
# Find entry points (language-specific)
Grep(pattern="export default|module.exports", type="ts")
Grep(pattern="def main|if __name__", type="py")
Grep(pattern="func main", type="go")

# Check for existing patterns
Grep(pattern="auth|login|session", output_mode="files_with_matches")
```

### Step 4: Quantitative Data Collection

Beyond descriptive findings, collect measurable data that enables informed planning decisions.

**Test file count:**

```bash
# Count test files in project
find . -name "*.test.*" -o -name "*.spec.*" | wc -l

# Check for test configuration
ls jest.config* vitest.config* .bun* 2>/dev/null
```

**Key interface signatures:**

```bash
# Extract exported interfaces and types
grep -A3 "export.*interface\|export.*type\|export.*function" src/ --include="*.ts" -rn | head -20
```

**File line counts for main source files:**

```bash
# Line counts for relevant source files
wc -l src/**/*.ts 2>/dev/null | tail -5
```

Include these metrics in your exploration output under a "Quantitative Data" subsection (see Output Format below).

### Step 5: Read Documentation

```python
Read(file_path="README.md")
Read(file_path="CLAUDE.md")
```

---

## Goal-Aligned Exploration Priority

Exploration must be driven by the session goal. Breadth-first scanning wastes time when the goal points to a specific domain.

### Keyword Extraction

Parse the session goal for domain keywords to prioritize exploration:

| Goal keyword | Priority exploration area |
|-------------|--------------------------|
| auth, login, session, JWT | Authentication layer, middleware, token handling |
| database, schema, migration, model | Database layer, ORM config, migration files |
| API, endpoint, route, REST | Route handlers, controllers, API middleware |
| test, coverage, spec | Test infrastructure, test utilities, CI config |
| UI, component, page, form | Frontend components, layouts, styles |
| deploy, CI, build, config | Build system, CI/CD pipelines, environment config |

**Example**: goal = "add authentication" → prioritize exploring `auth/`, `login/`, `session/`, `middleware/` patterns first.

### Exploration Priority Order

1. Files directly named in or implied by the goal
2. Files that import/depend on those files (consumers)
3. Test files for the above
4. Configuration files (if goal involves infra changes)
5. Everything else (surface scan only)

### Relevance Annotation

Every finding should connect back to the goal. Annotate findings with relevance:

```markdown
### src/middleware/auth.ts
**Relevance**: Direct target for modification (goal: "add role-based access")
- Uses JWT validation with `jsonwebtoken` library
- 12 route files import this middleware
```

---

## Output Format

Summarize findings in structured format:

```markdown
## Overview Exploration Results

**Project Type**: {framework/language}

**Tech Stack**:
- Language: {language and version}
- Framework: {framework}
- Database: {if found}
- Test: {test framework}

**Directory Structure**:
{tree representation}

**Key Entry Points**:
- {main files}

**Existing Patterns**:
- {auth, database, api patterns found}

**Quantitative Data**:

| Metric | Value |
|--------|-------|
| Test files | {count} |
| Test runner | {runner} |
| Lines in {key file} | {count} |
| Exported interfaces | {count} |

**Relevant to Goal**:
- {files directly related to the session goal, with relevance annotation}
```

See `references/templates.md` for complete template.

---

## Session Integration

When running within an ultrawork session:

1. **Update exploration stage** to `overview`
2. **Write** findings to `$SESSION_DIR/exploration/overview.md`
3. **Add** summary to `context.json`
4. **Advance** stage to `analyzing`

**Note**: `SESSION_DIR` is the session metadata directory (e.g., `~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}`), not the project working directory. All exploration artifacts are stored in the session directory to maintain session isolation.

```bash
# For ultrawork, use scripts written in Javascript/Bun
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/src/scripts"

# Update stage
bun $SCRIPTS/session-update.js --session ${CLAUDE_SESSION_ID} --exploration-stage overview

# Get session directory and write findings
SESSION_DIR=~/.claude/ultrawork/sessions/${CLAUDE_SESSION_ID}
mkdir -p "$SESSION_DIR/exploration"
# Write findings to $SESSION_DIR/exploration/overview.md using Write tool

# Add to context (file path is relative to SESSION_DIR)
bun $SCRIPTS/context-add.js --session ${CLAUDE_SESSION_ID} \
  --explorer-id "overview" \
  --file "exploration/overview.md" \
  --summary "{summary}" \
  --key-files "{files}" \
  --patterns "{patterns}"

# Advance stage
bun $SCRIPTS/session-update.js --session ${CLAUDE_SESSION_ID} --exploration-stage analyzing
```

---

## Time Budget

- **Target**: Complete within 30 seconds
- **Max Read**: 5-7 files
- **Max Glob**: 10 patterns

No excessive exploration - overview aims for quick understanding. Targeted exploration handles detailed investigation.

---

## Next Steps

After overview completion:

1. Analyze Goal + Overview → Generate targeted exploration hints
2. Detailed exploration via `Task(subagent_type="ultrawork:explorer")`
3. All exploration complete → Proceed to Planning phase

---

## Additional Resources

### Reference Files

- **`references/examples.md`** - Complete exploration examples for different project types
- **`references/templates.md`** - Output templates and session integration commands
