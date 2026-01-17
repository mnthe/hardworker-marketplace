# MCP Tool Integration Patterns

Claude Code plugins can integrate optional MCP tools using two patterns.

## Pattern 1: Declarative (Recommended)

List MCP tools in agent frontmatter. Claude Code runtime auto-filters unavailable tools.

```yaml
# AGENT.md frontmatter
tools: [
  "Read", "Write", "Edit",
  "mcp__plugin_serena_serena__find_symbol",
  "mcp__plugin_playwright_playwright__browser_snapshot"
]
```

**How it works:**
- Tools declared in frontmatter are requested at agent spawn
- Claude Code checks actual MCP availability at runtime
- Unavailable tools are silently removed from the agent's toolset
- Agent code works identically with or without MCP installed

**Benefits:**
- No error handling code needed
- Same agent definition works in all environments
- Zero configuration for end users
- Graceful degradation built-in

## Pattern 2: Imperative (For Conditional Logic)

Check tool availability in command code when you need different behavior.

```python
# In command markdown
if "mcp__plugin_serena_serena__activate_project" in available_tools:
    mcp__plugin_serena_serena__activate_project(project=".")
    # Enable Serena-specific workflow
else:
    # Use alternative workflow
```

**When to use:**
- Need to activate/initialize the MCP before use
- Want to show different UI or messages based on availability
- Need to choose between alternative implementations

## Pattern Comparison

| Aspect | Declarative | Imperative |
|--------|-------------|------------|
| Error handling | Automatic | Manual |
| Code complexity | Lower | Higher |
| Conditional behavior | No | Yes |
| Best for | Agent tools | Commands |

## Example: Playwright Integration

```yaml
# Declarative: Agent can use if available
tools: ["mcp__plugin_playwright_playwright__browser_snapshot"]
```

```python
# Imperative: Command checks availability
if "mcp__plugin_playwright_playwright__browser_navigate" in available_tools:
    print("Visual testing enabled")
```

## Best Practices

1. **Default to Declarative** - Simpler, less code, automatic fallback
2. **Use Imperative for initialization** - When MCP needs setup (e.g., Serena's `activate_project`)
3. **Don't mix patterns unnecessarily** - Pick one approach per integration point
4. **Document MCP requirements** - List optional MCP dependencies in CLAUDE.md
