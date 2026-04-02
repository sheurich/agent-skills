# Scenario: skill-authoring-tool-design

## Context

The agent is asked to design a CLI tool that will be used by other AI agents to manage AWS resources.

## Task

Design the command-line interface for a new tool that allows agents to list, start, and stop EC2 instances.

## Criteria

- [ ] The agent reads `tool-design.md` to understand principles for designing tool interfaces.
- [ ] The suggested design uses typed code stubs (e.g., Python or TypeScript function signatures), not JSON Schema.
- [ ] The suggested design includes output filtering (e.g., pagination, field selection) to avoid context window explosion.
- [ ] The suggested design supports batch execution (e.g., `start-instances --ids i-123 i-456`) to minimize round trips.
- [ ] Error messages are designed to be actionable (e.g., "Invalid instance ID. Valid formats: i-[0-9a-f]{8} or i-[0-9a-f]{17}").

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

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads tool-design.md | Fail | Did not read any reference files due to baseline constraints. |
| suggests typed stubs | Fail | Provided JSON examples but no typed stubs or schemas (e.g. no TypeScript signatures or JSON Schema for inputs/outputs). |
| output filtering | Partial | Included basic state/tag filters but lacked pagination or field selection (e.g. no `--fields`). |
| batch execution | Pass | Commands accept multiple instance IDs to minimize round trips. |
| actionable errors | Fail | Error format included a basic message but lacked actionable hints or format suggestions. |

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

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

- Date: 2026-04-02
- Agent: global.anthropic.claude-opus-4-6-v1

| Criterion | Result | Observation |
| --- | --- | --- |
| reads tool-design.md | Pass | Explicitly read and applied the 5 design principles from `tool-design.md`. |
| suggests typed stubs | Pass | Provided a complete TypeScript class and interfaces (`EC2`, `Instance`, `ActionError`) instead of flag tables or JSON schema. |
| output filtering | Pass | Included composable filtering (`--fields`), compaction, `--raw`, and pagination (`--max-results`, `--next-token`). |
| batch execution | Pass | Commands accept multiple IDs and handle partial failures with inline per-instance errors. |
| actionable errors | Pass | Designed structured `ActionError` with explicit `suggestion` and `valid_alternatives` fields. |

## Analysis

Compare outcomes. State what the skill adds.

### Run: 2026-04-02 (global.anthropic.claude-opus-4-6-v1)

**Baseline vs With-Skill:**
The baseline run managed to design a functional CLI tool that supported batch execution, but it failed to implement advanced agent-friendly patterns. It relied on simple JSON examples without typed stubs, lacked field selection for output filtering, and provided basic error messages without actionable hints. The with-skill run, having read `tool-design.md`, successfully implemented all criteria. It used TypeScript signatures for the interface, added robust output filtering (`--fields`, compaction, pagination), and designed actionable error messages with explicit suggestions and valid alternatives.

**What the skill adds:**
The `skill-authoring` skill (specifically the `tool-design.md` reference) provides explicit, structured guidance on how to build agent-friendly tools. It ensures the agent applies specific patterns—such as using typed stubs over JSON schemas, implementing composable output filtering to prevent context window explosion, and designing actionable error messages. Without the skill, the model defaults to standard CLI design patterns (basic JSON output and generic errors) rather than optimizing the interface specifically for LLM consumption.
