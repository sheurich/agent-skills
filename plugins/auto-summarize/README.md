# auto-summarize

Rolling session summary and automatic session naming for
[Pi](https://github.com/nicorevin/pi-coding-agent).

After every agent turn, the extension sends the conversation delta to a
configured budget model in the background and maintains a concise
bullet-point summary plus a short session title. The summary survives
session reloads and compactions.

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

3. **LLM call** — The current summary and new deltas are sent to the
   configured budget model. The extension checks `autoSummarize.model`
   first, then the `scout` subagent override, then known budget fallback
   models. The prompt requests JSON output:
   `{"title": "...", "summary": "..."}` with 3–8 bullet points and a
   ≤72-character title in `topic: what happened` format.

4. **Persist** — The title is applied via `pi.setSessionName()` and both
   title and summary are written as a custom `auto-summary` entry via
   `pi.appendEntry()`.

On `session_start`, `session_switch`, and `session_fork`, the extension
clears pending async state and restores the summary from the most recent
`auto-summary` entry in the new session's branch.

## Commands

| Command | Description |
| --- | --- |
| `/summary` | Display the current rolling session summary. |
| `/autoname` | Force an immediate full re-summarize from all messages in the branch. |

## Design notes

- **Silent failure.** Every error path is swallowed — the summary is a
  background convenience that must never disrupt the primary session.
- **Model caching.** The summarizer model is resolved once per session
  to avoid repeated registry lookups.
- **Lenient JSON parsing.** Strips markdown fences and normalizes array
  responses into bullet-point format.
- **Authentication** is delegated to the Pi model registry, so the
  extension works with any configured provider (Bedrock, Anthropic
  direct, etc.).

## Requirements

Set `autoSummarize.model` in `~/.pi/agent/settings.json` to the model
Pi should use for background summaries, for example:

```json
{
  "autoSummarize": {
    "model": "openai-codex/gpt-5.4-mini"
  }
}
```

If that setting is absent, the extension falls back to the `scout`
subagent override and then to built-in budget model candidates such as
Claude Haiku 4.5 and GPT-5.4 mini. The selected model must be available
with valid credentials in Pi's model registry.

## License

[MIT](../../LICENSE)
