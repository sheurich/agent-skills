# Copilot Instructions

When performing a code review, this is a public cross-agent skill repository.
Every skill must work across coding agents (Claude Code, Codex, Gemini CLI,
OpenCode, Pi). Cross-agent compatibility is the core review criterion.

When performing a code review, REJECT skills that:
- Have vague descriptions without trigger context ("Helps with git", "A useful
  tool for developers"). The description must say what the skill does AND when
  to activate it.
- Use agent-specific features in simple skills (`skills/`). Claude's
  `context: fork`, Pi's `!command` substitution, Codex sandbox paths — these
  belong in full plugins (`plugins/`), not simple skills.
- Assume a particular tool is installed without checking. Scripts must use
  `command -v` before calling tools that may not be present.
- Assume a particular OS or shell beyond `/usr/bin/env bash`.
- Restate common knowledge the agent already has. A skill that says "use
  `git add` to stage files" is not worth shipping.
- Exceed 500 lines with inline reference material that belongs in a
  `references/` subdirectory.
- Place fragile multi-step operations in inline code blocks instead of
  `scripts/` files.

When performing a code review, REJECT PRs that:
- Add a skill without a test scenario in `tests/scenarios/<skill-name>/scenario.md`.
- Add a test scenario without concrete pass/fail criteria. "Agent completed
  the task" is too broad. "Agent grouped related files into separate commits"
  tests a specific behavior.
- Add a test scenario without both baseline and with-skill results recorded.
- Add a simple skill without adding its path to `plugins[0].skills` in
  `.claude-plugin/marketplace.json`.
- Add a full plugin without adding a separate entry to the `plugins` array
  in `.claude-plugin/marketplace.json`.
- Use the full plugin layout (`plugins/`) when a simple skill (`skills/`)
  would suffice.
- Remove a skill without removing its marketplace.json entry.
- Have inconsistent metadata (name, version, description) across
  `plugin.json` and `gemini-extension.json` within a full plugin.

When performing a code review, ACCEPT:
- Skills with well-defined trigger context in descriptions ("Use when X",
  "Trigger on Y").
- Decision tables, concrete examples, and scripts that teach the agent
  non-obvious behavior.
- Reference material in `references/` subdirectories, even if large.
- Helper scripts in `scripts/` that check for dependencies before use.

When performing a code review, CI already validates JSON/YAML/Markdown/shell
syntax, SKILL.md frontmatter fields, skill name format, duplicate names,
test scenario file existence, and marketplace.json structure. Focus your
review on semantic quality that linters cannot catch.
