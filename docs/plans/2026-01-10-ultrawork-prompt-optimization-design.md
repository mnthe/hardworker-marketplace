# Design: Ultrawork Plugin Prompt Optimization & Hook Fixes

## Overview
Enhance ultrawork plugin's agent/skill prompts using modern context engineering techniques from Claude official documentation, and fix hook system compliance with Claude Code specifications. This includes fixing critical JSON parsing bugs, standardizing hook outputs, and applying prompt engineering best practices to 5 agents and 3 skills.

## Problem Statement

### Critical Issues
1. **JSON Parsing Failure**: session-update.sh and session-get.sh fail on multiline strings with control characters
2. **Hook Format Mismatch**: hooks.json doesn't follow Claude Code specification
3. **Hook Output Format**: Missing required fields (hookSpecificOutput.hookEventName)
4. **Suboptimal Prompts**: Agent/skill prompts lack modern context engineering techniques

### Impact
- Sessions with multiline goals crash when accessing fields
- Hooks may not trigger correctly or produce invalid output
- Agents may produce less optimal results due to unclear instructions

## Decisions

### 1. JSON String Escaping Strategy
- **Choice**: Use jq's built-in string escaping functions
- **Rationale**:
  - `@json` properly escapes all control characters (U+0000 through U+001F)
  - Built-in jq function, no external dependencies
  - Handles newlines, tabs, quotes automatically
- **Implementation**: Replace direct string interpolation with `jq -n --arg` pattern
- **Alternatives Considered**:
  - Manual escaping (error-prone, incomplete)
  - Base64 encoding (unnecessary complexity)
- **Asked User**: No (auto mode)

### 2. Hook Format Compliance
- **Choice**: Follow Claude Code spec exactly
  - Use `matcher` only for PreToolUse/PostToolUse events
  - Omit `matcher` for SessionStart, Stop, UserPromptSubmit (not supported)
  - Use proper matcher patterns: `{"tool_name": "exact_name"}` not wildcards
- **Rationale**:
  - Ensures hooks trigger correctly
  - Follows official Claude Code plugin specification
  - Prevents runtime errors
- **Alternatives Considered**:
  - Keep current format (breaks spec, causes errors)
  - Use matcher for all events (not supported by spec)
- **Asked User**: No (auto mode)

### 3. Hook Output Format
- **Choice**: Standardize on Claude Code hook output schema
  - PreToolUse: `permissionDecision: "allow"|"deny"`
  - PostToolUse: `decision: "continue"`
  - All hooks: Include `hookSpecificOutput.{hookEventName}` field
- **Rationale**:
  - Required by Claude Code specification
  - Enables proper hook chaining
  - Provides debugging information
- **Asked User**: No (auto mode)

### 4. Prompt Engineering Architecture
- **Choice**: XML-structured prompts with clear sections
  ```
  ---
  YAML frontmatter (metadata)
  ---

  # Agent Title

  <role>
  Clear persona with expertise
  </role>

  <context>
  Background information
  </context>

  <instructions>
  Step-by-step procedures
  </instructions>

  <examples>
  Few-shot examples
  </examples>

  <output_format>
  Expected output structure
  </output_format>

  <error_handling>
  Edge cases and failure modes
  </error_handling>
  ```
- **Rationale**:
  - Anthropic official best practice
  - Claude processes XML tags semantically
  - Clear separation of concerns
  - Easier to maintain and extend
- **Alternatives Considered**:
  - Markdown headers only (less semantic structure)
  - No structure (Claude performs worse)
- **Asked User**: No (auto mode)

### 5. Few-Shot Examples Strategy
- **Choice**: Add 2-3 concrete examples per agent
  - Input: Realistic scenario
  - Reasoning: Step-by-step thought process
  - Output: Expected format
- **Rationale**:
  - Claude documentation shows 40-60% improvement with examples
  - Reduces ambiguity in expected behavior
  - Provides templates for complex outputs
- **Asked User**: No (auto mode)

### 6. Skill Modularization
- **Choice**: Keep skills in single files with clear section markers
- **Rationale**:
  - Maintains context locality (agent reads one file)
  - Section markers (`---`, `##`) provide structure
  - Splitting requires complex file references in prompts
- **Alternatives Considered**:
  - Split into multiple files (increases cognitive load)
  - Inline all content (too long for some skills)
- **Asked User**: No (auto mode)

## Architecture

### Component Breakdown

#### 1. JSON Handling Layer
**Files**:
- `scripts/setup-ultrawork.sh`
- `scripts/session-update.sh`
- `scripts/session-get.sh`

**Changes**:
```bash
# OLD (vulnerable to control characters)
jq ".field = \"$VALUE\"" file.json

# NEW (safe escaping)
jq --arg value "$VALUE" '.field = $value' file.json
```

**Dependencies**: jq (already present)

**Testing**: Create session with goal containing `\n`, `\t`, `"` characters

#### 2. Hook Configuration Layer
**Files**:
- `hooks/hooks.json`

**Changes**:
```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{"type": "command", "command": "..."}]
    }],
    "PreToolUse": [{
      "matcher": {"tool_name": "Bash"},
      "hooks": [{"type": "command", "command": "..."}]
    }]
  }
}
```

**Dependencies**: None

**Testing**: Trigger each hook type and verify it executes

#### 3. Hook Output Layer
**Files**:
- `hooks/session-context-hook.sh`
- `hooks/gate-enforcement.sh`
- `hooks/post-tool-use-evidence.sh`
- `hooks/stop-hook.sh`
- `hooks/pre-tool-use-gate.sh`

**Changes**:
```bash
# PreToolUse hooks
jq -n --argjson decision "$DECISION" \
  '{permissionDecision: ($decision | if . then "allow" else "deny" end), hookSpecificOutput: {PreToolUse: {...}}}'

# PostToolUse hooks
jq -n '{decision: "continue", hookSpecificOutput: {PostToolUse: {...}}}'
```

**Dependencies**: jq

**Testing**: Capture hook output, validate JSON structure

#### 4. Agent Prompt Layer
**Files**:
- `agents/explorer/AGENT.md`
- `agents/planner/AGENT.md`
- `agents/worker/AGENT.md`
- `agents/verifier/AGENT.md`
- `agents/reviewer/AGENT.md`

**Changes**:
- Add `<role>` section with clear persona
- Add `<examples>` section with 2-3 concrete cases
- Add `<error_handling>` section with edge cases
- Restructure with semantic XML tags
- Add explicit success criteria

**Dependencies**: None (pure documentation)

**Testing**: Spawn agents with test scenarios, evaluate output quality

#### 5. Skill Prompt Layer
**Files**:
- `skills/overview-exploration/SKILL.md`
- `skills/planning/SKILL.md`
- `skills/ultrawork/SKILL.md`

**Changes**:
- Add concrete examples to overview-exploration
- Add section markers to planning skill
- Remove duplication in ultrawork skill
- Add XML structure for clarity
- Define explicit output formats

**Dependencies**: None

**Testing**: Invoke skills via commands, verify behavior

### Data Flow

#### Session Creation Flow (Fixed)
```
User → /ultrawork "goal\nwith\nnewlines"
  → setup-ultrawork.sh
    → jq --arg goal "$GOAL" '.goal = $goal' (SAFE)
      → session.json (valid JSON)
        → session-get.sh --field goal (SUCCESS)
```

#### Hook Execution Flow (Fixed)
```
Claude Code Event
  → hooks.json (matched correctly)
    → hook-script.sh
      → {permissionDecision: "allow", hookSpecificOutput: {...}} (valid format)
        → Claude Code (processed correctly)
```

#### Agent Spawn Flow (Enhanced)
```
Orchestrator → Spawn planner
  → Read AGENT.md
    → <role>: Clear persona loaded
    → <examples>: Few-shot templates loaded
    → <instructions>: Step-by-step procedures loaded
      → Agent produces high-quality output (structured, complete)
```

## Scope

### In Scope
- Fix JSON escaping in all scripts that write/read session.json
- Standardize hooks.json to Claude Code specification
- Fix all hook output formats (8 hook scripts)
- Enhance all 5 agent prompts with context engineering
- Enhance all 3 skill prompts with examples and structure
- Update plugin version to 0.2.15

### Out of Scope
- Changing core ultrawork workflow logic
- Adding new agents or skills
- Modifying command interfaces
- Database/state schema changes
- Performance optimization (not blocking)

## Implementation Strategy

### Phase 1: Critical Fixes (Blocking)
Fix issues that cause runtime errors:
1. JSON escaping in scripts (session-update.sh, setup-ultrawork.sh, session-get.sh)
2. hooks.json format compliance
3. Hook output format standardization

### Phase 2: Agent Prompt Enhancement
Enhance agent prompts with context engineering:
1. Explorer agent (context gathering)
2. Planner agent (task decomposition)
3. Worker agent (implementation)
4. Verifier agent (validation)
5. Reviewer agent (code review)

### Phase 3: Skill Prompt Enhancement
Enhance skill prompts:
1. overview-exploration (add examples)
2. planning (add structure markers)
3. ultrawork (remove duplication)

### Phase 4: Verification
Verify all changes:
1. Run test scenarios for each agent
2. Trigger all hook types
3. Create sessions with complex goals
4. Verify no regressions in behavior

## Testing Plan

### Unit Testing (Manual)

#### JSON Escaping
```bash
# Test multiline goal
GOAL=$'Line 1\nLine 2\t"quoted"\nLine 3'
./scripts/setup-ultrawork.sh "$GOAL"
./scripts/session-get.sh --session $SESSION_ID --field goal
# Expected: No parse error, goal preserved exactly
```

#### Hook Format
```bash
# Test each hook type triggers
# SessionStart: Start session
# PreToolUse: Call Bash
# PostToolUse: After Bash
# Stop: /ultrawork-cancel
# Expected: Hooks execute, no errors in logs
```

#### Hook Output
```bash
# Capture hook output
./hooks/gate-enforcement.sh < test-input.json
# Expected: Valid JSON with permissionDecision and hookSpecificOutput
```

### Integration Testing (Manual)

#### End-to-End Session
```bash
# Create session with complex goal
/ultrawork "Test goal with\nnewlines and \"quotes\""
# Expected: Session created, no errors

# Verify hooks fire
# Expected: Evidence collected, gates enforced

# Check agent outputs
# Expected: Structured, complete, following new prompt format
```

## Assumptions
1. jq is available in environment (already required by plugin)
2. Claude Code version supports hook specification used
3. Agents are spawned by orchestrator (don't need to handle spawning logic)
4. Session files are in standard location (~/.claude/ultrawork/sessions/)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON escaping breaks existing sessions | High | Test with various input types, provide migration if needed |
| Hook format change breaks event triggering | High | Test each hook type manually, verify in logs |
| Prompt changes alter agent behavior | Medium | Compare outputs before/after, iterate if issues found |
| Examples in prompts increase token usage | Low | Keep examples concise (2-3 per agent, <500 tokens each) |
| Hook output changes break orchestrator | High | Follow spec exactly, test hook chaining |

## Success Criteria

### Critical (Must Pass)
1. Sessions with multiline goals create and read successfully
2. All hooks trigger without errors
3. Hook outputs validate against Claude Code schema
4. No regression in existing functionality

### Quality (Should Pass)
1. Agent outputs are more structured and complete
2. Agents handle edge cases better (per examples)
3. Fewer agent retries needed (clearer instructions)
4. Skills produce more consistent results

### Optional (Nice to Have)
1. Reduced average agent execution time
2. Fewer user clarifications needed
3. More actionable error messages

## Rollback Plan

If issues arise:
1. **Scripts**: Git revert to previous version (minimal risk - well-tested escaping)
2. **Hooks**: Revert hooks.json and hook scripts (moderate risk - test thoroughly)
3. **Prompts**: Revert agent/skill prompts (low risk - doesn't affect runtime)

## Future Enhancements (Out of Scope)

1. **Automated Testing**: Add shellcheck, JSON schema validation
2. **Prompt Versioning**: Track prompt performance metrics
3. **Hook Monitoring**: Add hook execution timing and error tracking
4. **Agent Specialization**: Create more specialized agents for specific domains
5. **Skill Composition**: Allow skills to reference other skills

## References

- Claude Prompt Engineering Guide: https://docs.anthropic.com/claude/docs/prompt-engineering
- Claude Code Plugin Specification: https://claudecode.com/docs/plugins
- jq Manual: https://stedolan.github.io/jq/manual/
- Bash String Escaping: POSIX sh specification
