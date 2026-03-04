# Skill Testing

Measure whether a skill improves agent behavior by comparing runs with and
without the skill loaded.

## Scenario Format

Each skill has a test scenario in `tests/scenarios/<skill-name>/scenario.md`.

````markdown
# Scenario: skill-name

## Context

Describe the git state, files, and environment the agent starts in.

## Task

The concrete action to perform.

## Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Baseline

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| Criterion 1 | Pass/Fail | What happened |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| Criterion 1 | Pass/Fail | What happened |

## Analysis

Compare outcomes. State what the skill adds.
````

## Running a Scenario

1. Read the scenario file for context and setup.
2. Start a fresh agent session.
3. For baseline: run the task without the skill loaded.
4. For with-skill: invoke the skill, then run the task.
5. Record results in the scenario file.

When re-running, append new results with a dated heading below existing
ones.

## Interpreting Results

| Baseline | With-Skill | Meaning |
| --- | --- | --- |
| Fail | Pass | Skill adds value |
| Pass | Pass | Skill may be unnecessary |
| Fail | Fail | Skill needs improvement |
| Pass | Fail | Bug in skill |
