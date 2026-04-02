# Scenario: skill-authoring-extract

## Context

The agent is provided with a transcript of a successful coding session where a non-obvious problem was solved, and asked to extract a reusable skill.

## Task

Review the provided `session-transcript.md` fixture and create a new reusable skill based on it. 
(e.g., "Extract a skill from the attached session transcript that captures the workaround we found for the legacy API authentication error.")

## Criteria

- [ ] The agent reads `extracting-from-sessions.md` to understand the extraction process.
- [ ] The agent runs the quality assessment criteria defined in the reference doc on the transcript.
- [ ] The agent asks the user for confirmation on the extracted skill's scope and name before writing files.
- [ ] The skill is saved to a harness-appropriate path (e.g., `~/.agents/skills/` or a project `.pi/agents/skills/` directory).

## Baseline

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads extracting-from-sessions.md | Pass/Fail | What happened |
| runs quality assessment | Pass/Fail | What happened |
| asks confirmation | Pass/Fail | What happened |
| saves to harness-appropriate path | Pass/Fail | What happened |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads extracting-from-sessions.md | Pass/Fail | What happened |
| runs quality assessment | Pass/Fail | What happened |
| asks confirmation | Pass/Fail | What happened |
| saves to harness-appropriate path | Pass/Fail | What happened |

## Analysis

Compare outcomes. State what the skill adds.
