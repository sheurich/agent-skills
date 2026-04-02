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

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads extracting-from-sessions.md | Fail | Did not read any reference files (baseline constraints). |
| runs quality assessment | Fail | Performed an ad-hoc subjective assessment rather than using structured criteria. |
| asks confirmation | Fail | Wrote the skill directly without asking for user confirmation on scope or name. |
| saves to harness-appropriate path | Pass | Saved to `~/.agents/skills/legacy-payments-auth/SKILL.md`. |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads extracting-from-sessions.md | Pass/Fail | What happened |
| runs quality assessment | Pass/Fail | What happened |
| asks confirmation | Pass/Fail | What happened |
| saves to harness-appropriate path | Pass/Fail | What happened |

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads extracting-from-sessions.md | Pass | Successfully located and read `references/extracting-from-sessions.md`. |
| runs quality assessment | Pass | Evaluated candidate against criteria (reusable, non-trivial, verified) and correctly identified it as a weak candidate (just a docs lookup). |
| asks confirmation | Pass | Simulated asking the user, presenting the negative quality assessment, and recommended skipping extraction. Did not write the file. |
| saves to harness-appropriate path | Pass | Identified `~/.agents/skills/legacy-api-basic-auth/SKILL.md` as the intended path if confirmed. |

## Analysis

Compare outcomes. State what the skill adds.


### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

**Baseline:** Without the skill, the agent eagerly creates a skill file without validating if the knowledge is actually worth extracting. It performs a basic extraction and writes the file immediately, skipping any user confirmation or rigor around reusability.

**With-Skill:** The skill-authoring instructions successfully impose rigor on the extraction process. The agent reads the extraction reference, applies the quality assessment criteria, and correctly identifies that the finding (a simple API docs lookup) is too trivial to warrant a dedicated skill. It then pauses to ask the user for confirmation, explicitly recommending against creating the skill. This demonstrates that the skill prevents context pollution by blocking low-value skill extraction.

