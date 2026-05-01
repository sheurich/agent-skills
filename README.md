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
| [readiness-review](skills/readiness-review/SKILL.md) | Structured readiness assessment before proceeding to the next environment or phase. |
| [semgrep-scan](skills/semgrep-scan/SKILL.md) | Scan changed files with Semgrep for security and correctness issues before committing. |
| [skill-authoring](skills/skill-authoring/SKILL.md) | Write and refine agent skills. Use when generating skills from docs, extracting from sessions, designing tool interfaces, managing lifecycle, or writing for dual-harness patterns. |
| [swival](skills/swival/SKILL.md) | Delegate tasks to Swival for self-reviewed code changes, secret-safe operations, cached analysis, and A2A agent serving. |

## Plugins

| Plugin | Description |
| --- | --- |
| [auto-summarize](plugins/auto-summarize/) | Rolling session summary and automatic session naming for Pi. |

## Pi Packages

| Package | Description |
| --- | --- |
| [swival-subagent](packages/swival-subagent/) | Pi extension that delegates tasks to a swival subprocess (reviewer loop, AgentFS sandbox, secret encryption). |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add skills, write tests,
and run validation.

## Repo Structure

```text
skills/                        # Simple skills (SKILL.md only)
plugins/                       # Claude Code plugins (own manifests, hooks, LSP, MCP)
packages/                      # Pi packages (pi.extensions in package.json)
tests/scenarios/               # One scenario per skill or package
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
