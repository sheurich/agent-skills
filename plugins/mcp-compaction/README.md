# mcp-compaction

MCP-aware context compression for the Pi coding agent. Reduces voluminous MCP tool results (PagerDuty, Atlassian, Grafana, Google Workspace) before they enter the context window.

## How it works

### Layer 1: Real-time compression (`tool_result`)

Intercepts MCP `mode=call` results over 2KB and replaces them with compact structural summaries before they enter context. Pure string manipulation — no LLM, no latency.

- Per-server extractors for PagerDuty, Atlassian, Grafana, Google Workspace
- Generic JSON extractor as fallback (keeps scalar fields, drops arrays/nesting, truncates)
- A 260KB PagerDuty `list_oncalls` response becomes ~1.2KB

### Layer 2: Compaction handler (`session_before_compact`)

When Pi's auto-compaction fires (context approaching model limit), produces an MCP-aware structured summary using a cheap LLM (Flash Lite preferred). Preserves service identifiers, query results, and conversation flow.

Layer 2 rarely fires in practice because Layer 1 keeps the context small.

## Compression ratios (real data)

| Server/Tool | Original | Compressed | Ratio |
|-------------|----------|------------|-------|
| pagerduty/list_oncalls | 260KB | 1.2KB | 207x |
| pagerduty/list_incidents | 70KB | 1.3KB | 55x |
| atlassian/searchJiraIssuesUsingJql | 32KB | 1.3KB | 25x |
| atlassian/getJiraIssue | 40KB | 1.3KB | 31x |

## MCP gateway compatibility

Works with `pi-mcp-adapter`'s gateway pattern where all MCP calls go through a single `mcp` tool. Resolves server and tool identity from `details.mode`, `details.server`, `details.tool`.

## Model fallback chain (Layer 2 only)

For the compaction handler, tries models in this order, skipping any without working auth:

1. google-vertex/gemini-2.5-flash-lite
2. google-vertex/gemini-2.5-flash
3. google/gemini-2.5-flash-lite
4. google/gemini-2.5-flash
5. amazon-bedrock/global.anthropic.claude-haiku-4-5
6. anthropic/claude-haiku-4-5
7. openai/gpt-5-nano
8. openai/gpt-4.1-nano
9. Active model (fallback)

## Files

- `extensions/mcp-compaction/index.ts` — Extension entry point (tool_result + session_before_compact handlers)
- `extensions/mcp-compaction/compress.ts` — Pure compression logic (no Pi runtime dependency)
- `extensions/mcp-compaction/compress.test.ts` — 49 unit tests
- `extensions/mcp-compaction/demo.ts` — Compression demo with realistic payloads

## Testing

```bash
cd extensions/mcp-compaction
node --experimental-strip-types --test compress.test.ts
```

## Status

Mothballed. Working in production but not yet packaged for distribution.

### Known issues

- Per-server compressors need maintenance if MCP server response schemas change
- Structural compression is semantically blind — may truncate the exact records the user needs (agent can re-query with narrower parameters)
- Layer 2 compaction handler requires a configured LLM with working auth for the summarization call
