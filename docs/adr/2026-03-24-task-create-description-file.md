# ADR: Add --description-file Parameter to task-create.js

## Status

Accepted — 2026-03-24

## Context

When Claude agents invoke `task-create.js` with multi-line descriptions, they typically use heredoc syntax:

```bash
bun task-create.js --description "$(cat <<'EOF'
## Complex description
Line 2
Line 3
EOF
)"
```

However, heredoc EOF terminators must be at the start of the line (no leading whitespace). When Claude's tools indent the terminator for readability, the shell parser fails with:

```
(eval):34: unmatched "
```

This is a fundamental limitation of shell heredoc syntax that cannot be worked around by escaping or quoting.

## Decision

Add a new `--description-file` parameter to `task-create.js` (alias: `-D`) that reads description content from a file instead of accepting it as a command-line argument.

This approach:
1. **Eliminates heredoc parsing**: Agents use Write tool to create temp file, then pass file path
2. **No escaping needed**: File content is read directly without shell interpretation
3. **Cleaner agent code**: Write + Bash sequence is more readable than nested quoting
4. **Backward compatible**: Existing `--description` parameter remains unchanged
5. **Single responsibility**: `--description` and `--description-file` are mutually exclusive

### Approach

**File reading strategy**:
- Parameter validation: File must exist before invocation
- Read entire file content into memory (synchronous fs.readFileSync)
- Assign to `args.description` after loading
- Error if both `--description` and `--description-file` are provided

**Agent workflow pattern**:
```javascript
// Instead of:
bun task-create.js --description "$(cat <<'EOF'..."

// Agents now do:
bun task-create.js --description-file /tmp/ultrawork-task-1-desc.md
```

## Outcome

**Verification**: PASS
**Iterations**: 1 (no failures, implementation matched plan)

### Files Changed
- `plugins/ultrawork/src/scripts/task-create.js` — Added `--description-file` parameter with validation
- `tests/ultrawork/task-create.test.js` — Added 3 test cases (success, missing file, conflict with --description)
- `plugins/ultrawork/skills/planning/references/task-examples.md` — Added multi-line description example
- `plugins/ultrawork/commands/references/02-planning.md` — Added --description-file template
- `plugins/ultrawork/CLAUDE.md` — Updated task-create usage example and Script Inventory table

### Test Results
- `test: --description-file parameter works correctly` — PASS
- `test: --description-file validates file existence` — PASS
- `test: --description-file conflicts with --description` — PASS
- `bun test tests/ultrawork/` — All tests passed, exit code 0

### Key Implementation Details

**Parameter spec** (task-create.js line 46):
```javascript
'--description-file': { key: 'descriptionFile', aliases: ['-D'] }
```

**Validation** (task-create.js lines 92-101):
```javascript
// Validate mutual exclusivity
if (args.description && args.descriptionFile) {
  console.error('Error: Cannot use both --description and --description-file');
  process.exit(1);
}

// Load description from file if provided
if (args.descriptionFile) {
  if (!fs.existsSync(args.descriptionFile)) {
    console.error(`Error: Description file not found: ${args.descriptionFile}`);
    process.exit(1);
  }
  args.description = fs.readFileSync(args.descriptionFile, 'utf8');
}
```

## Delta from Plan

Implementation matched plan exactly. No scope changes, no unexpected findings, single iteration to completion.

## Rationale

### Why Not Heredoc-Compatible Escape?

Heredoc terminator position is enforced by the shell parser itself — no escape sequence or quoting technique can work around it. The only viable solutions are:
1. Change how agents invoke the script (file-based approach) ✅ Selected
2. Switch to JSON API (incompatible with ultrawork's Bash-only workflow)
3. Pre-define a custom parser in agents (adds complexity, limits flexibility)

### Why Mutually Exclusive?

Accepting both parameters simultaneously would create ambiguity: which value takes precedence? Explicit conflict validation forces agents to choose one approach, making intent clearer.

### Why Not Support All Parameters This Way?

Only `--description` needed this treatment because:
- `--criteria` is single-line (fits in command arguments)
- `--subject` is single-line (fits in command arguments)
- `--evidence` in task-update.js is single-line (fits in command arguments)
- Other parameters are simple values

Multi-line support is only needed for fields where free-form content is expected.

## Related

- Issue: Heredoc EOF indentation causes shell parsing errors in agent prompts
- Pattern: File-based parameter pattern now documented in skills/planning/references/task-examples.md
