# Scenario: skill-authoring-generate

## Context

The agent is working in a blank workspace and is asked to create a new agent skill based on external documentation URLs.

## Task

Create a new skill using the provided documentation URLs as the source.
(e.g., "Create a skill for using the GitHub CLI based on https://cli.github.com/manual/ and https://docs.github.com/en/github-cli/github-cli/about-github-cli")

## Criteria

- [ ] The agent reads `generating-from-docs.md` to understand the generation process.
- [ ] The agent uses the `agent-skills-generator` CLI (or instructs the user to do so) to fetch and convert the docs.
- [ ] The agent writes a `.skillscontext` file containing the source URLs.
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

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads generating-from-docs.md | Pass/Fail | What happened |
| uses agent-skills-generator | Pass/Fail | What happened |
| writes .skillscontext | Pass/Fail | What happened |
| applies format-spec | Pass/Fail | What happened |

## Analysis

Compare outcomes. State what the skill adds.
