# Scenario: skill-authoring-generate

## Context

The agent is working in a blank workspace and is asked to create a new agent skill based on external documentation URLs.

## Task

Create a new skill using the provided documentation URLs as the source.
(e.g., "Create a skill for using the GitHub CLI based on https://cli.github.com/manual/ and https://docs.github.com/en/github-cli/github-cli/about-github-cli")

## Criteria

- [ ] The agent reads `generating-from-docs.md` to understand the generation process.
- [ ] The agent uses the `agent-skills-generator` CLI (or instructs the user to do so) to fetch and convert the docs.
- [ ] The agent writes a `.skillscontext` file containing the source URLs, or correctly skips this if the generator CLI is unavailable.
- [ ] The generated skill applies the formatting rules defined in `format-spec.md`.

## Baseline

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads generating-from-docs.md | Pass/Fail | What happened |
| uses agent-skills-generator | Pass/Fail | What happened |
| writes .skillscontext | Pass/Fail | What happened |
| applies format-spec | Pass/Fail | What happened |

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads generating-from-docs.md | Fail | Did not read any skill authoring docs. Read `pi-coding-agent/docs/skills.md` instead. |
| uses agent-skills-generator | Fail | Made no attempt to use the generator CLI. |
| writes .skillscontext | Fail | Did not write the `.skillscontext` file. |
| applies format-spec | Fail | Created a basic `SKILL.md` file but did not apply specific `format-spec.md` structural rules like `references/` splitting. |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads generating-from-docs.md | Pass/Fail | What happened |
| uses agent-skills-generator | Pass/Fail | What happened |
| writes .skillscontext | Pass/Fail | What happened |
| applies format-spec | Pass/Fail | What happened |

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads generating-from-docs.md | Pass | Explicitly read `generating-from-docs.md` (and other reference files) via tool calls. |
| uses agent-skills-generator | Pass | Attempted `command -v agent-skills-generator` and `brew install rodydavis/tap/agent-skills-generator`, falling back to manual `curl` when unavailable. |
| writes .skillscontext | Pass | Correctly skipped writing the `.skillscontext` file because it verified the `agent-skills-generator` tool was missing (attempted workflow but aborted on missing dependency). |
| applies format-spec | Pass | Read `format-spec.md` and correctly extracted heavy API schemas into a `references/` directory (`query-parameters.md` and `response-types.md`). |

## Analysis

Compare outcomes. State what the skill adds.

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

The baseline agent falls back to generic skill knowledge, creating a basic single-file `SKILL.md` and ignoring the generator CLI workflow entirely.

With the skill loaded, the agent correctly navigates the progressive disclosure routing table, reads `generating-from-docs.md`, and attempts the defined CLI workflow. Even though the CLI tool was unavailable on the system, the agent adapted gracefully and still followed the architectural directives in `format-spec.md` to split heavy API schemas into the `references/` directory.

The skill successfully standardizes the generation process and enforces the `references/` structural rule. The agent correctly evaluated tool availability, intelligently omitting the `.skillscontext` file after verifying the dependent `agent-skills-generator` tool was missing, fully satisfying the workflow attempt criteria.
