# Google Workspace Plugin

Claude Code MCP bridge for [`gws`](https://github.com/googleworkspace/cli).
Exposes Drive, Gmail, Calendar, Sheets, Docs, Chat, Slides, and People
as MCP tools via `gws mcp`.

This plugin exists because `googleworkspace/cli` ships Gemini CLI and
Pi support natively but has no Claude Code plugin manifest or MCP
config. Everything else — behavioral rules, 89 per-service skills,
helper commands, recipes — comes from upstream.

## Prerequisites

```bash
npm i -g @googleworkspace/cli
gws auth setup     # walks you through GCP project + OAuth config
gws auth login
```

Verify:

```bash
gws drive files list --params '{"pageSize": 1}'
```

## Install

### Claude Code (this plugin)

```bash
claude plugin marketplace add sheurich/agent-skills
claude plugin install google-workspace@sheurich-agent-skills
claude plugin enable google-workspace@sheurich-agent-skills
```

### Gemini CLI (install upstream directly)

```bash
gemini extensions install googleworkspace/cli
```

### Pi (install upstream directly)

```bash
pi install @googleworkspace/cli
```

## What this plugin provides

- `.mcp.json` — launches `gws mcp` with 8 services
- `.claude-plugin/plugin.json` — Claude Code manifest

## What upstream provides

- `CONTEXT.md` — behavioral rules (field masks, dry-run, schema discovery)
- 89 skills — per-service, helper commands, recipes, personas
- `gemini-extension.json` — Gemini CLI manifest
- `package.json` — Pi manifest
