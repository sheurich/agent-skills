# Format Specification

## Frontmatter

Required:

```yaml
---
name: skill-name
description: What this does AND when to use it.
---
```

Optional fields:

```yaml
---
name: skill-name
description: What this does AND when to use it.
compatibility: Requires Node.js and gh CLI.
user-invocable: true
argument-hint: "<query>"
---
```

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | Yes | Must match folder name. Lowercase alphanumeric and hyphens, <64 chars |
| `description` | Yes | Activation trigger. Max 1024 chars |
| `compatibility` | No | Runtime requirements (prose). Max 500 chars |
| `license` | No | SPDX license identifier |
| `metadata` | No | Structured metadata (e.g., `author`, `version`) |
| `user-invocable` | No | Allow explicit `/skill` invocation (Claude Code only) |
| `argument-hint` | No | Usage hint shown for invocable skills (Claude Code only) |

## Naming Rules

Name must match the containing folder exactly:

```text
skills/my-skill/SKILL.md  →  name: my-skill      ✓
skills/my-skill/SKILL.md  →  name: My Skill       ✗
```

In plugins, use the folder name only. The plugin prefix is added
automatically:

```text
plugins/my-plugin/skills/deployment/SKILL.md
  → name: deployment            ✓  (invoked as plugin:deployment)
  → name: my-plugin:deployment  ✗
```

## Directory Patterns

### Simple skill

```text
skills/skill-name/
├── SKILL.md              # Required
├── references/           # Loaded on demand
├── scripts/              # Executed, not read into context
└── assets/               # Used in output only
```

### Full plugin

```text
plugins/plugin-name/
├── .claude-plugin/
│   └── plugin.json
├── gemini-extension.json
├── skills/
│   └── skill-name/
│       └── SKILL.md
└── scripts/
```

### What goes where

| Component | Purpose | In context? |
|-----------|---------|-------------|
| `SKILL.md` | Core instructions | On activation |
| `references/` | Specs, API docs, heavy content | On demand |
| `scripts/` | Deterministic operations | Executed |
| `assets/` | Templates, fonts, images | Output only |
| `README.md` | Human-facing documentation | Never |

## External Tool Patterns

No formal dependency declaration exists. Document dependencies in
`compatibility:` frontmatter and validate at runtime.

| Situation | Pattern | Example |
|-----------|---------|---------|
| Custom fragile logic | Bundle in `scripts/` | `scripts/process.py` |
| Python CLI (published) | `uvx <tool>` | `uvx markitdown input.pdf` |
| Python CLI (local) | `uv run --directory` | `uv run --directory tools/rag rag` |
| Node CLI (published) | `npx -y <package>` | `npx -y markdownlint-cli` |
| System tool | Bare command + guard | `command -v gh` |

Guard tools at the boundary:

```bash
if ! command -v gh &>/dev/null; then
    echo "Error: gh CLI required. See https://cli.github.com" >&2
    exit 1
fi
```

Use PEP 723 inline metadata for Python scripts with dependencies:

```python
# /// script
# requires-python = ">=3.9"
# dependencies = ["pyyaml"]
# ///
```

Invoke with `uv run scripts/my-script.py` for automatic resolution.

## Content Organization

### High-level with on-demand references

```markdown
# PDF Processing

## Quick start
[essential workflow]

## Advanced
- **Form filling**: See [forms.md](references/forms.md)
- **API reference**: See [reference.md](references/reference.md)
```

### Domain-specific references

```text
skill/
├── SKILL.md           (overview + routing)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

### Conditional workflows

```markdown
1. Determine task type:
   **Creating?** → "Creation workflow" section
   **Editing?** → "Editing workflow" section
```

## plugin.json Schema

```json
{
  "name": "plugin-name",
  "description": "What this plugin does",
  "version": "1.0.0",
  "author": { "name": "Author Name" },
  "keywords": ["tag1"],
  "license": "MIT"
}
```

`name`, `description`, and `version` are required. Unrecognized fields
cause installation failure.
