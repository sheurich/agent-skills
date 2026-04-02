# Scenario: skill-authoring-tool-design

## Context

The agent is asked to design a CLI tool that will be used by other AI agents to manage AWS resources.

## Task

Design the command-line interface for a new tool that allows agents to list, start, and stop EC2 instances.

## Criteria

- [ ] The agent reads `tool-design.md` to understand principles for designing tool interfaces.
- [ ] The suggested design uses typed stubs (e.g., JSON schemas or clear type signatures for inputs/outputs).
- [ ] The suggested design includes output filtering (e.g., pagination, field selection) to avoid context window explosion.
- [ ] The suggested design supports batch execution (e.g., `start-instances --ids i-123 i-456`) to minimize round trips.
- [ ] Error messages are designed to be actionable (e.g., "Invalid instance ID. Valid formats: i-[a-z0-9]{17}").

## Baseline

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads tool-design.md | Pass/Fail | What happened |
| suggests typed stubs | Pass/Fail | What happened |
| output filtering | Pass/Fail | What happened |
| batch execution | Pass/Fail | What happened |
| actionable errors | Pass/Fail | What happened |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads tool-design.md | Pass/Fail | What happened |
| suggests typed stubs | Pass/Fail | What happened |
| output filtering | Pass/Fail | What happened |
| batch execution | Pass/Fail | What happened |
| actionable errors | Pass/Fail | What happened |

## Analysis

Compare outcomes. State what the skill adds.
