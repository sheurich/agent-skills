# Platform Guide

What each agent platform discovers, loads, and ignores. Consult
this when making authoring decisions that affect cross-platform
compatibility, or when setting up distribution.

## Discovery and Context

| Concern | Claude Code | Gemini CLI | Pi | Codex | OpenCode |
|---------|-------------|------------|-----|-------|----------|
| Skill location | `skills/<name>/SKILL.md` | Same | Same | Same | Same |
| Root context | `CLAUDE.md` | `GEMINI.md` or `contextFileName` | `package.json` | `AGENTS.md` | `AGENTS.md` |
| Plugin manifest | `.claude-plugin/plugin.json` | `gemini-extension.json` | `package.json` | — | — |
| Skill invocation | `/plugin:skill` | Natural language | Automatic | Automatic | Automatic |

## Frontmatter Compatibility

All platforms parse `name` and `description`. These additional fields
are Claude Code–specific but accepted by CI (with portability warnings);
other platforms silently ignore them:

- `allowed-tools`
- `user-invocable`
- `argument-hint`

These other Claude Code–only fields are **not** recognized by the
CI validator and will cause an error if used in this repo:

- `disable-model-invocation`
- `context`
- `agent`

**Implication:** Tool restrictions set via `allowed-tools` don't
transfer. A skill restricted to Read and Grep in Claude Code gets
full tool access in Gemini.

## Authoring Implications

- Simple skills (`skills/<name>/SKILL.md`) work everywhere with no
  platform-specific config.
- Agent-specific features (allowed-tools, hooks, MCP, LSP) require
  the plugin layout and only function in Claude Code.
- Private repos work most reliably with SSH URLs
  (`git@github.com:...`). HTTPS with token auth is supported by
  some platforms but may fail silently.
- `README.md` at plugin root is never loaded into agent context.
  It serves humans only.

## Installation

### Claude Code

```bash
# Register marketplace (one-time)
claude plugin marketplace add NAME --source git \
  --url git@github.com:org/repo.git

# Install plugin
claude plugin install plugin-name@NAME

# Update (requires version bump in plugin.json)
claude plugin update plugin-name@NAME

# Force refresh (no version change)
claude plugin uninstall plugin-name@NAME
claude plugin install plugin-name@NAME

# Remove (order matters)
claude plugin uninstall plugin-name@NAME   # first
claude plugin marketplace remove NAME      # second
```

### Gemini CLI

```bash
# Local development (symlink — changes reflect immediately)
gemini extensions link /path/to/plugin

# Remote install (copies files — requires update for changes)
gemini extensions install git@github.com:org/repo.git

# Update / remove
gemini extensions update extension-name
gemini extensions remove extension-name
```

### Pi

```bash
pi install https://github.com/org/repo
```

Auto-detects skills. Requires `package.json` with `pi-package` keyword.

## Tool Name Mapping

Skill instructions that reference tool names should use generic
descriptions ("read the file", "run the command") rather than
platform-specific tool names. For scripts that need to know:

| Claude Code | Gemini CLI |
|-------------|------------|
| Read | `read_file` |
| Write | `write_file` |
| Edit | `replace` |
| Bash | `run_shell_command` |
| Glob | `glob` |
| Grep | `search_file_content` |
