# Contributing

Every skill in this repo must work across coding agents. Cross-agent
compatibility is the core requirement.

## Walkthrough

Adding a simple skill end to end, using `my-skill` as the example.

### 1. Create the skill

```bash
mkdir -p skills/my-skill
```

Write `skills/my-skill/SKILL.md` with required frontmatter:

```yaml
---
name: my-skill
description: >-
  What this skill does in one sentence.
  Use when <triggering condition>.
---
```

The `name` must match the folder name. The `description` must state
WHAT the skill does and WHEN to activate it.

Add body content below the frontmatter. Keep under 500 lines. Put
heavy reference material in `references/`.

### 2. Register in marketplace.json

Add the skill path to `.claude-plugin/marketplace.json`:

```json
"skills": [
  "./skills/my-skill"
]
```

### 3. Update the skills table

Add a row for the skill in `README.md`:

```markdown
| [my-skill](skills/my-skill/SKILL.md) | What this skill does and when to use it. |
```

### 4. Create a test scenario

Write `tests/scenarios/my-skill/scenario.md` following the
format in [tests/README.md](tests/README.md). Define context, task,
and pass/fail criteria.

### 5. Validate

```bash
./validate.sh
```

All checks must pass: linting, marketplace consistency, test coverage.

### 6. Submit

Fork, branch, commit, open a pull request. Copilot and a human review.

## Choose a Layout

### Simple skill

For skills that need only a `SKILL.md`:

```text
skills/my-skill/
└── SKILL.md
```

Add `"./skills/my-skill"` to the `skills` array in the first plugin entry
of `.claude-plugin/marketplace.json`.

### Full plugin

For skills that need Claude plugin features (allowed-tools, hooks, MCP
servers, LSP) or their own Gemini extension config:

```text
plugins/my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── gemini-extension.json
└── skills/
    └── my-skill/
        └── SKILL.md
```

Add a new entry to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{
  "name": "my-plugin",
  "description": "What this plugin does",
  "source": "./plugins/my-plugin"
}
```

Keep metadata (name, version, description) consistent across
`plugin.json` and `gemini-extension.json`.

## Writing a SKILL.md

### Frontmatter

```yaml
---
name: my-skill
description: What this does and when to use it.
---
```

Both fields are required. The `name` must match the folder name, use
lowercase alphanumeric characters and hyphens, and stay under 64 characters.

The `description` determines when agents activate the skill automatically.
Be specific about triggers:

```yaml
# Good — states what and when
description: Create git commits with intelligent file grouping. Use when committing changes.

# Bad — no trigger context
description: Helps with git.
```

### Content

- Keep under 500 lines. Move reference material to `references/`.
- Add only non-obvious information. Agents already know common tools.
- Use tables for decision logic, examples for ambiguous cases.
- Prefer scripts in `scripts/` over inline code blocks for fragile operations.

### Cross-Agent Compatibility

Skills run on agents with different tool sets. Follow these rules:

- Do not reference agent-specific features in simple skills. Those
  belong in plugins.
- Do not assume a particular tool is available. Check with `command -v`
  in scripts.

## Test Your Skill

Every skill needs a test scenario. Create
`tests/scenarios/<skill-name>/scenario.md` following the format in
`tests/README.md`.

Run baseline (no skill) and with-skill sessions. Record the results
in the scenario file. The skill should demonstrably improve agent behavior.
Test in at least two agents before submitting.

## Validate

Run validation before submitting:

```bash
./validate.sh
```

This runs all linting and structural checks. CI runs the same checks on
every push and pull request.

## Submit

1. Fork the repo and create a branch.
2. Add your skill or plugin.
3. Add a test scenario.
4. Run `./validate.sh` — all checks must pass.
5. Open a pull request. Copilot and a human will review it.
