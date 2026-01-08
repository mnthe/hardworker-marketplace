# hardworker-marketplace

Claude Code plugin marketplace for hardworker plugins.

## Plugins

| Plugin | Description |
|--------|-------------|
| [ultrawork](plugins/ultrawork/) | Strict verification-first development with execute→verify loops |
| [teamwork](plugins/teamwork/) | Multi-session collaboration with role-based workers |

## Installation

```bash
# Add marketplace
claude plugin marketplace add mnthe/hardworker-marketplace

# Install plugins
claude plugin install ultrawork@hardworker-marketplace
claude plugin install teamwork@hardworker-marketplace
```

See individual plugin READMEs for usage details.

## License

MIT
