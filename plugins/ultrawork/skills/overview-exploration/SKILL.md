---
name: overview-exploration
description: "Quick project overview exploration - direct execution without agent spawn. Use at the start of ultrawork sessions."
---

# Overview Exploration Skill

Quick project overview exploration skill executed directly without agent spawn.

---

## When to Use

- At the start of ultrawork sessions (GATE 1)
- When project structure understanding is needed
- Context collection before targeted exploration

---

## Execution Steps

### Step 1: Check Project Config Files

```python
# Detect language/framework
Glob(pattern="package.json")      # Node.js/JS
Glob(pattern="go.mod")            # Go
Glob(pattern="requirements.txt")  # Python
Glob(pattern="Cargo.toml")        # Rust
Glob(pattern="pom.xml")           # Java/Maven
Glob(pattern="*.csproj")          # .NET
```

Read discovered files:
```python
Read(file_path="package.json")  # or the relevant config file
```

### Step 2: Understand Directory Structure

```python
# Top-level structure
Glob(pattern="*", path=".")

# Main source directories
Glob(pattern="src/*")
Glob(pattern="app/*")
Glob(pattern="lib/*")
Glob(pattern="internal/*")
Glob(pattern="cmd/*")
```

### Step 3: Explore Core Patterns

```python
# Config files
Glob(pattern="**/*.config.*")
Glob(pattern="**/.*rc")
Glob(pattern="**/*.json", path=".")

# Test structure
Glob(pattern="**/*_test.*")
Glob(pattern="**/*.test.*")
Glob(pattern="**/test/**/*")
```

### Step 4: Check Existing Documentation (if any)

```python
# README, CLAUDE.md, etc.
Read(file_path="README.md")
Read(file_path="CLAUDE.md")
Read(file_path=".claude/CLAUDE.md")
```

---

## Output Format

Summarize in the following format after exploration:

```markdown
## Overview Exploration Results

**Project Type**: {Next.js / Express / Go CLI / Python Library / etc.}

**Tech Stack**:
- Language: {TypeScript / Go / Python / etc.}
- Framework: {Next.js / Express / Gin / etc.}
- Database: {PostgreSQL / MongoDB / etc.} (if any)
- Test: {Jest / pytest / go test / etc.}

**Directory Structure**:
```
project/
├── src/           # {description}
├── app/           # {description}
├── lib/           # {description}
└── tests/         # {description}
```

**Key Entry Points**:
- {main entry file}
- {api routes if any}

**Existing Patterns**:
- {auth: implemented/not found}
- {database: prisma/typeorm/raw sql/not found}
- {api: rest/graphql/trpc/not found}

**Relevant Files** (based on Goal):
- {file1}: {reason}
- {file2}: {reason}
```

---

## Session Integration

When using within an ultrawork session:

### 1. Update exploration_stage

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" \
  --session {session_dir}/session.json \
  --exploration-stage overview
```

### 2. Save overview.md

```python
Write(
  file_path="{session_dir}/exploration/overview.md",
  content="{exploration results in above format}"
)
```

### 3. Initialize context.json

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/context-init.sh" \
  --session {session_dir} \
  --overview-complete
```

---

## Time Budget

- Target: Complete within **30 seconds**
- Max Read: 5-7 files
- Max Glob: 10 patterns

**No excessive exploration** - Overview aims for quick understanding.
Targeted exploration handles detailed investigation.

---

## Next Steps

After Overview completion:

1. Analyze Goal + Overview → Generate targeted exploration hints
2. Detailed exploration via `Task(subagent_type="ultrawork:explorer")`
3. All exploration complete → Proceed to Planning phase
