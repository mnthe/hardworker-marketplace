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

## Examples

### Example 1: Next.js Project

**Goal**: "Add authentication with OAuth"

**Exploration Commands**:
```python
# Step 1: Detect framework
Glob(pattern="package.json")
# → Found: package.json

Read(file_path="package.json")
# → Dependencies: next@14.0.0, react@18.2.0, typescript@5.0.0

# Step 2: Structure
Glob(pattern="*")
# → [".next", "app", "components", "lib", "public", "node_modules", "package.json"]

Glob(pattern="app/**/*.tsx")
# → ["app/page.tsx", "app/layout.tsx", "app/api/users/route.ts"]

# Step 3: Check existing auth
Grep(pattern="auth|login|session", output_mode="files_with_matches")
# → No matches

# Step 4: Read docs
Read(file_path="README.md")
# → Simple Next.js starter, no auth mentioned
```

**Output**:
```markdown
## Overview Exploration Results

**Project Type**: Next.js 14 App Router

**Tech Stack**:
- Language: TypeScript 5.0
- Framework: Next.js 14 (App Router)
- Database: Not found
- Test: Not found

**Directory Structure**:
```
project/
├── app/              # Next.js App Router pages
│   ├── page.tsx      # Homepage
│   ├── layout.tsx    # Root layout
│   └── api/          # API routes
├── components/       # React components
└── lib/              # Utilities
```

**Key Entry Points**:
- app/layout.tsx (root layout)
- app/api/* (API routes)

**Existing Patterns**:
- Auth: not found
- Database: not found
- API: REST via route handlers

**Relevant Files** (based on Goal):
- app/layout.tsx: Need to wrap with SessionProvider
- app/api/: Where auth routes will go
```

### Example 2: Go CLI Tool

**Goal**: "Add config file support"

**Exploration Commands**:
```python
# Step 1: Detect Go project
Glob(pattern="go.mod")
# → Found: go.mod

Read(file_path="go.mod")
# → module: github.com/user/tool, go 1.21

# Step 2: Structure
Glob(pattern="*")
# → ["cmd", "internal", "pkg", "go.mod", "go.sum", "README.md"]

Glob(pattern="cmd/**/*.go")
# → ["cmd/tool/main.go"]

Glob(pattern="internal/**/*.go")
# → ["internal/cli/cli.go", "internal/runner/runner.go"]

# Step 3: Check existing config
Grep(pattern="config|\.yaml|\.toml", output_mode="content", -n=true)
# → internal/cli/cli.go:15: // TODO: Add config file support

Read(file_path="internal/cli/cli.go")
# → CLI uses cobra, flags only, no config file
```

**Output**:
```markdown
## Overview Exploration Results

**Project Type**: Go CLI Tool

**Tech Stack**:
- Language: Go 1.21
- Framework: cobra (CLI framework)
- Database: N/A
- Test: go test (standard)

**Directory Structure**:
```
tool/
├── cmd/tool/         # Main entry point
├── internal/cli/     # CLI logic (cobra)
├── internal/runner/  # Business logic
└── pkg/              # Public packages
```

**Key Entry Points**:
- cmd/tool/main.go (entry point)
- internal/cli/cli.go (CLI setup)

**Existing Patterns**:
- Config: TODO comment found, not implemented
- CLI: cobra with flags
- Test: Standard go test

**Relevant Files** (based on Goal):
- internal/cli/cli.go: Add config loading here
- go.mod: May need viper or similar for config parsing
```

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
  --session {SESSION_ID} \
  --exploration-stage overview
```

### 2. Save overview.md

```bash
# Get session directory
SESSION_DIR=$("${CLAUDE_PLUGIN_ROOT}/scripts/session-get.sh" --session {SESSION_ID} --dir)

# Write overview.md
Write(
  file_path="$SESSION_DIR/exploration/overview.md",
  content="{exploration results in above format}"
)
```

### 3. Add overview to context.json

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/context-add.sh" \
  --session {SESSION_ID} \
  --explorer-id "overview" \
  --file "exploration/overview.md" \
  --summary "{brief summary of overview findings}" \
  --key-files "{comma-separated key files}" \
  --patterns "{comma-separated patterns found}"
```

### 4. Update exploration stage

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/session-update.sh" \
  --session {SESSION_ID} \
  --exploration-stage analyzing
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
