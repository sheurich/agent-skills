# Scenario: swival

## Context

A project directory with a Go file (`cmd/serve.go`) containing a
`Serve()` function that lacks input validation. The litellm proxy is
running. Swival is configured with `generic` provider pointing at the
proxy.

## Task

"Use the swival CLI tool to add input validation to cmd/serve.go.
Enable self-review and secret encryption. Show me the exact command
you would run."

## Criteria

- [ ] Agent checks proxy status before invoking swival
- [ ] Agent invokes `swival` with `--self-review` flag
- [ ] Agent includes `--encrypt-secrets` given the task mentions credentials
- [ ] Agent uses `-q` flag for one-shot delegation (not --repl)
- [ ] If task involves untrusted input, agent considers `--sandbox agentfs`

## Baseline — Haiku

- Date: 2026-04-02
- Agent: claude-haiku-4-5 (via swival --no-skills --no-instructions --no-memory)

| Criterion | Result | Observation |
| --- | --- | --- |
| Checks proxy status | Fail | No proxy check |
| Uses `--self-review` | Fail | Edited the file directly instead of producing a swival command. Invented fake flags (`swival enhance --feature input-validation`). |
| Uses `--encrypt-secrets` | Fail | Implemented AES encryption in the Go code instead of using swival's flag |
| Uses `-q` flag | Fail | No swival invocation at all |
| Considers `--sandbox agentfs` | Fail | Not mentioned |

## With-Skill — Haiku

- Date: 2026-04-02
- Agent: claude-haiku-4-5 (via swival --skills-dir .../skills)

| Criterion | Result | Observation |
| --- | --- | --- |
| Checks proxy status | Fail | No proxy check (read `swival --help` instead of skill) |
| Uses `--self-review` | Pass | Correct flag: `swival --self-review --encrypt-secrets "Add input validation to cmd/serve.go"` |
| Uses `--encrypt-secrets` | Pass | Correct flag with accurate description |
| Uses `-q` flag | Fail | Omitted `-q` from the primary command |
| Considers `--sandbox agentfs` | Fail | Not mentioned |

## Baseline — Sonnet

- Date: 2026-04-02
- Agent: claude-sonnet-4-6 (via swival --no-skills --no-instructions --no-memory)

| Criterion | Result | Observation |
| --- | --- | --- |
| Checks proxy status | Fail | No proxy check |
| Uses `--self-review` | Pass | Correct flag (discovered via `swival --help`) |
| Uses `--encrypt-secrets` | Pass | Correct flag |
| Uses `-q` flag | Fail | Omitted `-q` |
| Considers `--sandbox agentfs` | Fail | Not mentioned |

## With-Skill — Sonnet

- Date: 2026-04-02
- Agent: claude-sonnet-4-6 (via swival --skills-dir .../skills)

| Criterion | Result | Observation |
| --- | --- | --- |
| Checks proxy status | Pass | Included `swival-proxy status` / `swival-proxy start` instructions |
| Uses `--self-review` | Pass | Correct flag with accurate description of review loop |
| Uses `--encrypt-secrets` | Pass | Correct flag with format-preserving encryption explanation |
| Uses `-q` flag | Pass | Included `-q` in the command |
| Considers `--sandbox agentfs` | Pass | Offered `--sandbox agentfs` as an optional refinement |

## Analysis

### Haiku

Without the skill, Haiku completely misunderstands the task — it
edits the Go file directly and invents fake CLI flags. With the
skill, it produces the correct `swival --self-review --encrypt-secrets`
command. The skill converts a total failure into a correct invocation.
Haiku still misses `-q` and the proxy check.

### Sonnet

Without the skill, Sonnet discovers correct flags via `swival --help`
but omits `-q`, the proxy check, and `--sandbox agentfs`. With the
skill, Sonnet passes 5 of 5 evaluable criteria (proxy check,
`--self-review`, `--encrypt-secrets`, `-q`, and `--sandbox agentfs`)
and proactively suggests custom `--review-prompt`.

### Summary

The skill provides the most value for less capable models (Haiku:
0/5 → 2/5 evaluable criteria) and adds meaningful completeness
for capable models (Sonnet: 2/5 → 5/5). The proxy status check
and AgentFS suggestion are behaviors that no model exhibits
without the skill.
