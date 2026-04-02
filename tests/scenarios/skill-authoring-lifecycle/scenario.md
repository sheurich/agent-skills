# Scenario: skill-authoring-lifecycle

## Context

The agent is presented with an outdated skill file that uses deprecated tools (like `edit_file` instead of `edit`) and a description that is no longer accurate.

## Task

Review and update the provided `outdated-skill.md` fixture to match current best practices.

## Criteria

- [ ] The agent reads `skill-lifecycle.md` to understand the lifecycle management process.
- [ ] The agent updates the skill's description to be more accurate or adds a deprecation notice if the skill is no longer relevant.
- [ ] The agent removes or replaces the deprecated tool references in the skill body.

## Baseline

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads skill-lifecycle.md | Pass/Fail | What happened |
| adds deprecation notice | Pass/Fail | What happened |
| updates description | Pass/Fail | What happened |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads skill-lifecycle.md | Pass/Fail | What happened |
| adds deprecation notice | Pass/Fail | What happened |
| updates description | Pass/Fail | What happened |

## Analysis

Compare outcomes. State what the skill adds.
