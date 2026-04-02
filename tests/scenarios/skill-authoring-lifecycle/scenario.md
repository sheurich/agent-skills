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

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads skill-lifecycle.md | Fail | Did not read any reference files due to baseline constraints. |
| updates description or adds deprecation notice | Pass | Updated the description to describe the new `edit` tool. No deprecation notice added. |
| removes or replaces deprecated tool references | Pass | Completely rewrote the skill body to replace `edit_file` with `edit` and its `edits[]` array format. |

## With-Skill

- Date: YYYY-MM-DD
- Agent: model name

| Criterion | Result | Observation |
| --- | --- | --- |
| reads skill-lifecycle.md | Pass/Fail | What happened |
| adds deprecation notice | Pass/Fail | What happened |
| updates description | Pass/Fail | What happened |

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads skill-lifecycle.md | Pass | Read `references/skill-lifecycle.md` and correctly applied the rule to add a changelog for a significant update. |
| updates description or adds deprecation notice | Pass | Updated the description to focus on triggering conditions (WHAT and WHEN). It noticed the skill was borderline redundant, but because the task said "update", it did not add a deprecation notice. |
| removes or replaces deprecated tool references | Pass | Replaced `edit_file` with `edit`, updated the parameters, and cut motivational filler per the skill-authoring guidelines. |

## Analysis

Compare outcomes. State what the skill adds.

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

**Baseline:** The agent treats the outdated skill as something that must be fixed. It updates the tool references to match its current harness capabilities (`edit`, `read`, `write`), but fails to use proper frontmatter or understand skill lifecycle management.

**With-Skill:** The skill successfully guided the agent to fix the frontmatter (adding a `name` field), format the description correctly (WHAT and WHEN), cut motivational filler, and append a changelog as required by `skill-lifecycle.md`. However, the skill failed to trigger a deprecation. The agent explicitly noted in its output: *"This skill is borderline for existence (file editing is standard agent practice), but since the task was to update rather than evaluate necessity, I preserved it with corrected content."* The skill's rule against creating skills for "standard practices" wasn't strong enough to override the direct command to "update" the skill.

To achieve the desired behavior (deprecating the skill instead of updating it), the `skill-lifecycle.md` reference may need stronger explicit guidance: e.g., "If asked to update a skill that covers standard practices, deprecate it instead."
