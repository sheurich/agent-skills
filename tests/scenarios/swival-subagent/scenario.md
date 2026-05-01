# Scenario: swival-subagent

> This scenario is an interactive runbook, not an auto-executable test. The
> other scenarios in this directory invoke `swival --no-skills` / `--skills-dir`
> directly and record Baseline / With-Skill evidence. The `swival-subagent`
> tool is a Pi extension, so verifying it requires a live Pi session with a
> configured LLM provider and example swival agents installed. The maintainer
> runs the runbook by hand when the plugin changes in a way that could affect
> agent-visible tool semantics.
>
> Automated coverage of the plugin's pure functions (arg building, report
> summarisation, failure classification, trace tailing) lives under
> `packages/swival-subagent/__tests__/`.

## Context

A Pi session with the `swival-subagent` extension loaded (via
`pi install sheurich/agent-skills`). A working LLM provider — litellm
proxy on `:4000`, local MLX server, or a native provider with API keys —
and at least one swival agent definition in `~/.pi/agent/swival-agents/`
(for example the `reviewed-worker` agent shipped with this plugin).

The user prompt must describe a non-trivial task that benefits from the
reviewer loop — a small refactor where correctness can be checked, such
as adding input validation to a Go function.

## Task

> Use the `swival-subagent` tool to delegate the following task to the
> `reviewed-worker` agent: add input validation to `cmd/serve.go` for the
> `Serve()` function. Use swival's reviewer loop so the change is
> double-checked.

## Criteria

- [ ] Agent calls the `swival-subagent` tool (not plain `subagent`, not
      a raw `bash` call to `swival`).
- [ ] Tool call uses single-mode (`agent` + `task`), not parallel or
      chain — there is only one step.
- [ ] `agent` parameter is `"reviewed-worker"`.
- [ ] Agent surfaces the swival report summary — review rounds, tool
      call count, outcome — rather than dumping raw stderr.
- [ ] If the reviewer rejects, the agent reports the last reviewer
      feedback rather than only "failed".
- [ ] Agent does not attempt to set `selfReviewOverride: false` to
      silence the reviewer when the reviewer complains.

## Runbook

1. Prerequisites:
   - `swival` installed: `uvx swival --version` shows 1.0.14+.
   - LLM proxy running: `litellm --port 4000`, an MLX server, or a
     native provider with credentials in the environment.
   - Example agents installed:
     ```bash
     mkdir -p ~/.pi/agent/swival-agents
     cp packages/swival-subagent/agents/*.md ~/.pi/agent/swival-agents/
     ```
   - Plugin installed: `pi install ./packages/swival-subagent`.

2. Start a Pi session in a repo with a `cmd/serve.go` (or substitute any
   Go file with a function that could use input validation):
   ```bash
   cd /path/to/repo
   pi
   ```

3. Issue the task prompt verbatim.

4. Observe each criterion against the tool call and response rendering.

5. Record results under `## Results` below. Date the run and note the
   LLM provider / model used.

## Results

_Record each run as a dated entry under this heading._

<!--
Template for a recorded run:

### YYYY-MM-DD — provider / model

| Criterion | Result | Observation |
| --- | --- | --- |
| Uses `swival-subagent` tool | Pass / Fail | |
| Single mode with agent+task | Pass / Fail | |
| Uses `reviewed-worker` | Pass / Fail | |
| Surfaces report summary | Pass / Fail | |
| Reports reviewer feedback on reject | Pass / Fail | |
| Does not silence reviewer | Pass / Fail | |

Notes: …
-->

## Notes

The `swival-subagent` tool is a Pi extension, not a cross-agent skill —
it only activates inside Pi. This runbook catches regressions in how
agents interpret the tool's parameter shape and output rendering. Pure
extension logic (arg building, report summarisation, failure
classification, trace tailing) is covered by the vitest suite under
`packages/swival-subagent/__tests__/`.
