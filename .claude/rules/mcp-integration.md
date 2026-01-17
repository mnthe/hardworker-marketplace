# MCP Tool Integration Pattern

## Rule

When integrating optional MCP tools, always check tool availability before activation. Enable enhanced capabilities without blocking core functionality.

## Pattern

```javascript
// Check if MCP tool is available before using
if (available_tools.includes("mcp__plugin_name__tool_name")) {
    try {
        // Use enhanced capability
        await mcp__plugin_name__tool_name(params);
    } catch (error) {
        // Graceful fallback to standard tools
        console.error("MCP tool failed, using fallback");
    }
} else {
    // Core functionality works without MCP
}
```

## Examples in This Project

- `ultrawork.md` - Checks for Serena MCP before enabling symbol navigation
- `teamwork.md` - Checks for Serena MCP before enabling code analysis
- `teamwork-worker.md` - Checks for Serena MCP before enabling symbol tools

## Why This Matters

1. **Graceful degradation** - Plugins work even when MCP servers unavailable
2. **Optional enhancement** - MCP tools add capabilities, don't gate them
3. **Error resilience** - MCP failures don't crash the workflow
4. **User flexibility** - Users can choose which MCP servers to run

## Anti-patterns

- Assuming MCP tools are always available
- Hard failing when MCP tool not found
- Not catching MCP tool execution errors
- Duplicating MCP availability checks (check once, store result)
