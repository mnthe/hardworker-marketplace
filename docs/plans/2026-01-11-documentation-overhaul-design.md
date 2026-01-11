# Design: Documentation Overhaul

## Overview

Comprehensive documentation update across repository to improve user onboarding, developer experience, and Claude agent guidance. This addresses identified gaps in READMEs, user guides, agent rules, and plugin context files.

## Current State Analysis

**Existing Documentation**:
- Root README.md: Basic (28 lines) - only installation
- Root CLAUDE.md: Comprehensive development guidelines ✓
- plugins/ultrawork/README.md: Good plugin documentation ✓
- plugins/ultrawork/CLAUDE.md: Basic sync rules ✓
- plugins/ultrawork-js/README.md: **Wrong name ("ultrawork-ts")** ✗
- plugins/ultrawork-js/CLAUDE.md: Good ✓
- plugins/teamwork/README.md: Good ✓
- plugins/teamwork/CLAUDE.md: **MISSING** ✗
- docs/: 13 analysis reports, 1 design doc ✓
- docs/guides/: **MISSING** ✗
- .claude/rules: **EMPTY directory** ✗

## Decisions

### 1. Root README.md Structure

**Choice**: Standard open-source project README with detailed sections

**Rationale**:
- GitHub best practices for discoverability
- Common pattern in plugin marketplaces
- Balances high-level overview with actionable content

**Structure**:
```markdown
# Project Overview
# Features (3 plugins with key features)
# Quick Start
# Plugin Details
# Architecture Overview
# Contributing Guidelines
# License
```

**Asked User**: No (auto mode)

---

### 2. Fix ultrawork-js Naming

**Choice**: Rename "ultrawork-ts" → "ultrawork-js" throughout README

**Rationale**:
- Plugin is actually ultrawork-js, not ultrawork-ts
- Uses JavaScript with JSDoc, not TypeScript
- Installation command uses ultrawork-js name
- Consistency with plugin.json and directory name

**Asked User**: No (auto mode)

---

### 3. User Documentation Location

**Choice**: Create docs/guides/ directory for user-facing docs

**Rationale**:
- Separates user guides from technical analysis
- Standard pattern (docs/analysis/ + docs/guides/)
- Easier navigation for different audiences

**Content Structure**:
```
docs/guides/
├── getting-started.md      # Quick start for users
├── plugin-development.md   # How to create plugins
└── workflow-guide.md       # Common workflows
```

**Asked User**: No (auto mode)

---

### 4. .claude/rules Structure

**Choice**: Separate rules files per concern

**Rationale**:
- Modular approach, easier to maintain
- Claude agents can load specific rule sets
- Clear separation of concerns

**Structure**:
```
.claude/rules/
├── code.rules              # Coding standards
├── testing.rules           # Test requirements
├── documentation.rules     # Doc standards
└── workflow.rules          # Development workflow
```

**Format**: Markdown with Claude-specific directives

**Asked User**: No (auto mode)

---

### 5. teamwork CLAUDE.md Content

**Choice**: Mirror ultrawork structure with plugin-specific rules

**Rationale**:
- Consistency across plugins
- Proven pattern from ultrawork
- Focus on multi-session coordination challenges

**Content**:
- Plugin overview
- Development rules
- Document synchronization requirements
- Agent coordination guidelines

**Asked User**: No (auto mode)

---

### 6. Documentation Style

**Choice**: Evidence-based, no speculation

**Rationale**:
- Aligns with project's "Evidence-based" core value
- No "may", "could", "seems" language
- Clear, verifiable statements

**Asked User**: No (auto mode)

## Architecture

### Components

#### 1. Root README Enhancement
**Files**: `/README.md`
**Dependencies**: None
**Description**: Expand from 28 lines to comprehensive project overview with features, quick start, architecture overview, and contributing guide.

#### 2. ultrawork-js README Fix
**Files**: `/plugins/ultrawork-js/README.md`
**Dependencies**: None
**Description**: Rename "ultrawork-ts" to "ultrawork-js" throughout, update installation commands, clarify it's JavaScript (not TypeScript).

#### 3. teamwork CLAUDE.md Creation
**Files**: `/plugins/teamwork/CLAUDE.md`
**Dependencies**: None
**Description**: Create new file following ultrawork pattern, include development rules and sync requirements specific to multi-session collaboration.

#### 4. User Guides
**Files**:
- `/docs/guides/getting-started.md`
- `/docs/guides/plugin-development.md`
- `/docs/guides/workflow-guide.md`

**Dependencies**: None
**Description**: Create user-facing documentation for onboarding, plugin development, and common workflows.

#### 5. Claude Agent Rules
**Files**:
- `/.claude/rules/code.rules`
- `/.claude/rules/testing.rules`
- `/.claude/rules/documentation.rules`
- `/.claude/rules/workflow.rules`

**Dependencies**: None
**Description**: Create agent behavior rules aligned with project standards in root CLAUDE.md.

### Documentation Flow

```
User Entry Point: README.md
    ↓
Quick Start → docs/guides/getting-started.md
    ↓
Advanced Usage → docs/guides/workflow-guide.md
    ↓
Plugin Development → docs/guides/plugin-development.md

Developer Entry Point: CLAUDE.md
    ↓
Claude Rules → .claude/rules/*.rules
    ↓
Plugin Context → plugins/*/CLAUDE.md
```

## Scope

### In Scope
- Root README.md expansion (features, quick start, architecture)
- Fix ultrawork-js README.md naming error
- Create teamwork/CLAUDE.md
- Create docs/guides/ with 3 user guides
- Create .claude/rules/ with 4 rules files
- Ensure consistency across all documentation

### Out of Scope
- Plugin code changes (documentation only)
- Automated documentation generation
- API reference documentation (future)
- Video tutorials or visual diagrams
- Multi-language translations

## Assumptions
1. Current root CLAUDE.md structure is correct
2. ultrawork/CLAUDE.md pattern is appropriate for teamwork
3. Markdown format is sufficient for all docs
4. No breaking changes needed to plugin interfaces

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Documentation drift from code | Medium | Include verification task to check consistency |
| Inconsistent tone across docs | Low | Follow evidence-based style guide |
| Missing edge cases in guides | Medium | Review existing analysis reports for completeness |
| .claude/rules not loaded by agents | Low | Test rule loading in verification phase |

## Success Criteria

1. **Root README.md**:
   - Contains features, quick start, architecture sections
   - >100 lines with comprehensive content
   - Links to plugin READMEs

2. **ultrawork-js README.md**:
   - No references to "ultrawork-ts"
   - Installation command uses correct name
   - Clear JavaScript (not TypeScript) description

3. **teamwork/CLAUDE.md**:
   - File exists with >30 lines
   - Follows ultrawork pattern
   - Contains development rules

4. **docs/guides/**:
   - 3 guide files exist
   - Each >50 lines of practical content
   - Cross-referenced with each other

5. **/.claude/rules/**:
   - 4 rules files exist
   - Each >20 lines of agent directives
   - Aligned with root CLAUDE.md standards

6. **Consistency**:
   - All READMEs use same tone/style
   - Version numbers match between files
   - No broken internal links

## Testing Strategy

**Manual verification**:
1. Read through all documentation as new user
2. Check internal links resolve correctly
3. Verify code examples are accurate
4. Confirm tone is consistent and evidence-based

**Automated checks** (in verify task):
1. Grep for "ultrawork-ts" in ultrawork-js docs (should be 0 results)
2. Verify file existence for all created files
3. Check line counts meet minimums
4. Validate markdown syntax with linter

## Timeline Estimate

- Task 1 (ultrawork-js fix): 5 minutes
- Task 2 (root README): 20 minutes
- Task 3 (teamwork CLAUDE.md): 10 minutes
- Task 4 (user guides): 30 minutes
- Task 5 (agent rules): 20 minutes
- Task 6 (verification): 15 minutes

**Total**: ~100 minutes (~1.5 hours)

## Notes

- All tasks are independent and can run in parallel (except verification)
- No code changes required, documentation only
- Follows existing patterns and conventions
- Evidence-based style throughout
