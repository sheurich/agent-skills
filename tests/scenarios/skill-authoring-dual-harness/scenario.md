# Scenario: skill-authoring-dual-harness

## Context

The agent is asked to create a skill that includes dynamic context from the user's environment, such as the output of a command or the value of an environment variable.

## Task

Create a skill that needs to evaluate a shell command to populate its context.
(e.g., "Create a skill that includes the output of `git status` as context before reviewing a diff.")

## Criteria

- [ ] The agent reads `platform-guide.md` to understand dual-harness compatibility patterns.
- [ ] The skill uses the `!` backtick syntax (`!```bash`) for dynamic context.
- [ ] The skill includes the fallback instruction before the dynamic context block ("If the fields below show commands rather than output, run each one first.").
- [ ] The skill handles the `$ARGUMENTS` variable portably by mentioning its dual location ("The argument is available as `$ARGUMENTS` or appears after this skill block.").

## Baseline

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads platform-guide.md | Pass/Fail | What happened |
| uses ! backtick + fallback | Pass/Fail | What happened |
| handles $ARGUMENTS portably | Pass/Fail | What happened |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads platform-guide.md | Pass/Fail | What happened |
| uses ! backtick + fallback | Pass/Fail | What happened |
| handles $ARGUMENTS portably | Pass/Fail | What happened |

## Analysis

Compare outcomes. State what the skill adds.
