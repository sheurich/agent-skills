# Tool Design for Agent Skills

Skill descriptions are tool interfaces, and a skill's structure is an API surface.
When authoring skills, apply the same principles used for designing tools that LLMs consume well.

## Present tools as typed code, not schemas

LLMs have trained on millions of real programs but few synthetic
tool-call examples. A typed function signature communicates more than
the equivalent JSON Schema or OpenAPI spec.

- Generate Python or TypeScript stubs from tool definitions.
- Required parameters → positional args (Python) or required properties
  (TypeScript). Optional → keyword-only with defaults (Python) or `?:`
  (TypeScript).
- Group related tools into classes or namespaces when naming conventions
  allow it (`gmail.search` → `class gmail:`).
- 55 tools compress to ~80 lines of stubs. The schema representation
  runs to pages.

## Return only what the caller needs

Tool responses are often 10–100× larger than what the caller needs.
Provide composable output filters rather than forcing post-processing.

- **Field selection**: let callers specify which fields to extract.
- **Compaction**: strip nulls, empty values, and configurable noise
  keys. Configure noise keys close to the tool or service definition,
  not globally.
- **Raw mode**: expose the full protocol envelope when callers need
  metadata.
- Compose filters in a fixed order so behavior is predictable.
- When content isn't structured, skip filters silently rather than
  erroring.

## Batch calls when possible

Each round-trip through the LLM costs latency and tokens. When a
workflow requires multiple tool calls, let callers batch them.

- Use the simplest viable format. Line-oriented beats a full DSL — LLMs
  generate it trivially and parsing is unambiguous.
- Execute over one persistent connection when the transport allows it.
- Errors on individual calls go to stderr; subsequent calls continue.
- Leave richer scripting (variables, control flow) for later if demand
  materializes. YAGNI.

## Make errors actionable

Every error an LLM sees should tell it what went wrong, why, and how
to fix it.

- Include the valid alternatives (available servers, tools, flags).
- Suggest the correct invocation rather than just rejecting the wrong
  one.
- Scope flags to their commands. Reject misplaced flags early with a
  clear message, not a confusing downstream failure.

## Validate configuration at load time

Catch structural errors before any network call or tool invocation.

- Type-check config fields strictly (e.g., an array field given a bare
  string silently breaks — `new Set("self")` → `{'s','e','l','f'}`).
- Reject contradictory config (e.g., both `command` and `url` on the
  same entry).
- Warn on empty definitions rather than silently doing nothing.

## Design for upstream contribution

When adding features to a fork intended for upstream:

- One feature per PR, ordered smallest-to-largest.
- Pure refactors that touch upstream files go first (or bundled with the
  first feature that needs them).
- A wiring commit that touches the entry point for multiple features
  must be split per-PR with `git add -p`.
- Lead with the highest-value, lowest-risk feature. It sets the tone.
