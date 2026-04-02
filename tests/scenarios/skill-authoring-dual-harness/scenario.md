# Scenario: skill-authoring-dual-harness

## Context

The agent is asked to create a skill that includes dynamic context from the user's environment, such as the output of a command or the value of an environment variable.

## Task

Create a skill that needs to evaluate a shell command to populate its context.
(e.g., "Create a skill that includes the output of `git status` as context before reviewing a diff.")

## Criteria

- [ ] The agent reads `platform-guide.md` to understand dual-harness compatibility patterns.
- [ ] The skill uses the ``!`command` `` inline syntax for dynamic context.
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

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads platform-guide.md | Fail | Did not read any reference files (baseline constraints). |
| uses ! backtick + fallback | Fail | Simply output the commands as markdown blocks rather than using dynamic evaluation syntax. |
| handles $ARGUMENTS portably | Fail | Did not mention $ARGUMENTS at all. |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads platform-guide.md | Pass/Fail | What happened |
| uses ! backtick + fallback | Pass/Fail | What happened |
| handles $ARGUMENTS portably | Pass/Fail | What happened |

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads platform-guide.md | Pass | Successfully read the skill and followed the dual-harness pattern. |
| uses ! backtick + fallback | Pass | Used `!```bash` and included the fallback instruction "If the fields below show commands rather than output, run each one first." |
| handles $ARGUMENTS portably | Pass | Included the exact required sentence: "The argument is available as `$ARGUMENTS` or appears after this skill block." |

## Analysis

Compare outcomes. State what the skill adds.

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

**Baseline:** The agent uses standard markdown code blocks, which do not automatically evaluate to provide context. It lacks knowledge of the dual-harness execution environment or the specialized dynamic context syntax.

**With-Skill:** The agent correctly references the formatting details for cross-platform execution (the `!` backtick syntax and `$ARGUMENTS` documentation) by adhering to the instructions provided. The resulting skill seamlessly evaluates dynamic context on platforms that support it while providing manual fallback steps for platforms that don't.
