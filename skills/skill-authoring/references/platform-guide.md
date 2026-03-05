# Platform Guide

What each agent platform discovers, loads, and ignores. Consult
this when making authoring decisions that affect cross-platform
compatibility, or when setting up distribution.

Versions tested: Claude Code 2.1.69, Gemini CLI 0.31.0, Pi 0.56.0.

## Discovery and Context

| Concern | Claude Code | Gemini CLI | Pi |
|---------|-------------|------------|-----|
| Skill location | `skills/<name>/SKILL.md` | Same | Same |
| Root context | `CLAUDE.md` | `GEMINI.md` or `contextFileName` | `AGENTS.md` |
| Plugin manifest | `.claude-plugin/plugin.json` | `gemini-extension.json` | `package.json` (with `pi-package` keyword) |
| Marketplace manifest | `.claude-plugin/marketplace.json` | — | — |
| Skill invocation | `/plugin:skill` or automatic | Natural language or `/skill` | `/skill:name` or automatic |
| Progressive disclosure | Yes (name+desc at startup, body on activation) | Yes | Yes |

## Skill Discovery Paths

### Claude Code

- Plugins from installed marketplaces: `skills/<name>/SKILL.md`
  inside each plugin
- Standalone skills: `~/.claude/skills/`, `.claude/skills/` in project
- Plugin components also: agents, hooks, MCP servers, LSP servers

### Gemini CLI

- Extensions: `skills/<name>/SKILL.md` relative to
  `gemini-extension.json`
- Global: `~/.agents/skills/`, `~/.gemini/skills/`
- Workspace: `.gemini/skills/`
- Individual install: `gemini skills install <source>` or
  `gemini skills link <path>`
- Extension components also: custom commands (`commands/*.toml`),
  hooks (`hooks/hooks.json`), sub-agents (`agents/*.md`),
  policies (`policies/*.toml`), themes

### Pi

- Global: `~/.pi/agent/skills/`, `~/.agents/skills/`
- Project: `.pi/skills/`, `.agents/skills/` (walks ancestors to
  git root)
- Packages: `skills/` convention directory, or `pi.skills` in
  `package.json`
- Settings: `skills` array in `settings.json`
- CLI: `--skill <path>` (repeatable, additive even with
  `--no-skills`)
- Package components also: TypeScript extensions, prompt templates,
  themes

## Frontmatter Compatibility

All platforms parse `name` and `description`. Additional fields
vary in support:

| Field | Claude Code | Gemini CLI | Pi | Spec |
|-------|-------------|------------|-----|------|
| `name` | Required | Required | Required | Required |
| `description` | Required | Required | Required | Required |
| `license` | Ignored | Ignored | Ignored | Optional |
| `compatibility` | Ignored | Ignored | Ignored | Optional |
| `metadata` | Ignored | Ignored | Ignored | Optional |
| `allowed-tools` | Enforced | Ignored | Experimental | Optional |
| `user-invocable` | Enforced | Ignored | Ignored | CC-only |
| `argument-hint` | Shown in autocomplete | Ignored | Ignored | CC-only |
| `disable-model-invocation` | Enforced | Ignored | Enforced | CC-only |
| `context` | Enforced (`fork`) | Ignored | Ignored | CC-only |
| `agent` | Enforced | Ignored | Ignored | CC-only |

**Implication:** Tool restrictions set via `allowed-tools` don't
transfer to Gemini CLI. A skill restricted to Read and Grep in
Claude Code gets full tool access in Gemini and Pi.

## Template Variables

| Variable | Claude Code | Gemini CLI | Pi |
|----------|-------------|------------|-----|
| `$ARGUMENTS` | Invocation args | — | Appended as `User: <args>` |
| `${CLAUDE_SESSION_ID}` | Current session | — | — |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin directory | — | — |
| `` !`command` `` | Shell substitution at load | — | — |
| `${extensionPath}` | — | Extension directory | — |
| `${workspacePath}` | — | Current workspace | — |

## Access Control (Claude Code)

| Pattern | User invokes | Agent invokes | Use case |
|---------|------------|----------------|----------|
| (default) | Yes | Yes | General-purpose skills |
| `disable-model-invocation: true` | Yes | No | Side effects: deploys, commits |
| `user-invocable: false` | No | Yes | Background knowledge |

## Authoring Implications

- Simple skills (`skills/<name>/SKILL.md`) work everywhere with no
  platform-specific config.
- Agent-specific features (allowed-tools, hooks, MCP, LSP, policies)
  require the plugin layout and only function in the supporting
  platform.
- `README.md` at plugin root is never loaded into agent context.
  It serves humans only.
- `references/` content loads only when the agent reads it explicitly.
- Private repos work with SSH URLs (`git@github.com:...`) or
  HTTPS with credential helpers / tokens.
- For multi-plugin repos, Gemini CLI users install individual plugins
  as separate extensions; Claude Code users install from the
  marketplace.

## Installation

### Claude Code

```bash
# Marketplace (multi-plugin repo)
claude plugin marketplace add NAME --source git \
  --url git@github.com:org/repo.git
claude plugin install plugin-name@NAME
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
# Whole extension (repo or plugin dir)
gemini extensions install git@github.com:org/repo.git
gemini extensions link /path/to/plugin    # local dev

# Individual skill
gemini skills install <source>
gemini skills link /path/to/skill

# Update / remove
gemini extensions update extension-name
gemini extensions uninstall extension-name
```

### Pi

```bash
# Package install (multiple source formats)
pi install https://github.com/org/repo
pi install git:git@github.com:org/repo
pi install npm:@scope/package
pi install ./local/path

# Project-local
pi install https://github.com/org/repo -l

# Manage
pi list
pi update
pi remove <source>
```

Pi auto-detects skills from `skills/` convention directory if no
`package.json` `pi` manifest exists. For explicit control, add
`package.json` with `pi-package` keyword and `pi.skills` paths.

## Tool Name Mapping

Skill instructions should use generic descriptions ("read the file",
"run the command") rather than platform-specific tool names.

| Claude Code | Gemini CLI | Pi |
|-------------|------------|-----|
| Read | `read_file` | read |
| Write | `write_file` | write |
| Edit | `replace` | edit |
| Bash | `run_shell_command` | bash |
| Glob | `glob` | — |
| Grep | `search_file_content` | — |
| WebFetch | `web_fetch` | — |
