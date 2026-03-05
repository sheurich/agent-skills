# Agent Skills

[Agent skills](https://agentskills.io) that work across coding agents.

## Install

| Agent | Command |
| --- | --- |
| Pi | `pi install https://github.com/sheurich/agent-skills` |
| Claude Code | `/plugin marketplace add sheurich/agent-skills` |
| Gemini CLI | `gemini extensions install sheurich/agent-skills` |
| npx skills | `npx skills add sheurich/agent-skills --all -g` |

Install a single skill with npx:

```bash
npx skills add sheurich/agent-skills -s <skill-name> -g
```

## Skills

| Skill | Description |
| --- | --- |
| [skill-authoring](skills/skill-authoring/SKILL.md) | Write and refine agent skills using test-driven development. Use when creating new skills, editing existing skills, or reviewing skill quality. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add skills, write tests,
and run validation.

## Repo Structure

```text
skills/                        # Simple skills (SKILL.md only)
plugins/                       # Full plugins (own manifests, hooks, LSP, MCP)
tests/scenarios/               # One scenario per skill
scripts/validate-extra.sh      # Repo-specific validation checks
vendor/agent-validate/         # Vendored validator
validate.sh                    # Thin wrapper → vendor/agent-validate
.claude-plugin/marketplace.json
gemini-extension.json
```

## Validation

```bash
./validate.sh              # run all checks
./validate.sh --skip json  # skip specific checks
```

CI runs [agent-validate](https://github.com/sheurich/agent-validate) on
every push and pull request.

## License

[MIT](LICENSE)
