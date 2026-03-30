# auto-summarize

Rolling session summary and automatic session naming for
[Pi](https://github.com/nicorevin/pi-coding-agent).

After every agent turn, the extension sends the conversation delta to
Claude Haiku 4.5 in the background and maintains a concise bullet-point
summary plus a short session title. The summary survives session reloads
and compactions.

## Install

```bash
pi install https://github.com/sheurich/agent-skills
```

Or install the plugin directly:

```bash
pi install /path/to/plugins/auto-summarize
```

## How it works

1. **`agent_end` hook** — After each agent turn, the extension extracts
   user text, assistant text, and abbreviated tool-call signatures into a
   delta string.

2. **Background drain queue** — Deltas are queued and processed
   asynchronously so the primary agent is never blocked. Multiple turns
   that complete before the LLM responds are batched into a single
   prompt.

3. **LLM call** — The current summary and new deltas are sent to
   Claude Haiku 4.5 (resolved from the model registry, preferring a
   Bedrock ARN when available). The prompt requests JSON output:
   `{"title": "...", "summary": "..."}` with 3–8 bullet points and a
   ≤72-character title in `topic: what happened` format.

4. **Persist** — The title is applied via `pi.setSessionName()` and both
   title and summary are written as a custom `auto-summary` entry via
   `pi.appendEntry()`.

On `session_start`, the extension walks the current branch and restores
state from the most recent `auto-summary` entry.

## Commands

| Command | Description |
| --- | --- |
| `/summary` | Display the current rolling session summary. |
| `/autoname` | Force an immediate full re-summarize from all messages in the branch. |

## Design notes

- **Silent failure.** Every error path is swallowed — the summary is a
  background convenience that must never disrupt the primary session.
- **Model caching.** The Haiku model is resolved once per session to
  avoid repeated registry lookups.
- **Lenient JSON parsing.** Strips markdown fences and normalizes array
  responses into bullet-point format.
- **Authentication** is delegated to the Pi model registry, so the
  extension works with any configured provider (Bedrock, Anthropic
  direct, etc.).

## Requirements

Claude Haiku 4.5 (or a model whose ID contains `haiku-4-5`) must be
available in the model registry.

## License

[MIT](../../LICENSE)
