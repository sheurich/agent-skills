---
name: swival
description: >-
  Delegate tasks to Swival for self-reviewed code changes, sandboxed
  execution, secret-safe operations, cached analysis, local-model
  inference, and A2A agent serving or client usage. Use when a task
  benefits from automated review loops against acceptance criteria,
  filesystem sandboxing, credential encryption, LLM response
  caching, or orchestrating a network of A2A agents.
---

# Swival

Tracked against Swival 1.0.14.

Swival is a CLI coding agent with native providers for local
inference (`lmstudio`, `llamacpp`, `huggingface`), `openrouter`,
`chatgpt`, `google` (Gemini), and `bedrock`, plus a `generic`
OpenAI-compatible provider for anything else including litellm
proxies. It has features other agents lack: a built-in reviewer
loop, layered sandboxing (builtin + AgentFS), format-preserving
secret encryption, outbound request filtering, A2A server **and**
client, lifecycle hooks, and command middleware. Use it as a
delegate for tasks that benefit from these capabilities.

## When to reach for Swival

Pick Swival over pi / claude / codex when the task needs a
reviewer loop that retries until acceptance passes, OS-enforced
filesystem isolation, credential-safe tool output via
format-preserving encryption, goal-driven work that won't quit
after one turn, or A2A orchestration. For quick questions and
shallow edits, a general-purpose coding agent is fine.

## Prerequisites

Swival talks to most providers directly. The litellm proxy is
only needed for Vertex AI and for Bedrock cross-region inference
profiles that the native `bedrock` provider doesn't handle.

Direct provider (no proxy) — verify `swival` only:

```bash
command -v swival >/dev/null 2>&1 || { echo "swival not found — see setup.md"; exit 1; }
```

Routing through litellm (Vertex / cross-region Bedrock) — also
verify and start `swival-proxy`:

```bash
command -v swival       >/dev/null 2>&1 || { echo "swival not found — see setup.md"; exit 1; }
command -v swival-proxy >/dev/null 2>&1 || { echo "swival-proxy not found — see setup.md"; exit 1; }
swival-proxy status || swival-proxy start
```

If `swival` or `swival-proxy` are not installed, see
[setup.md](./references/setup.md).

## Security Model

Swival enforces security at three layers: filesystem, commands, and
LLM content. Choose the right combination for the task.

### Filesystem sandbox

By default (`--files some`), file tools are restricted to the base
directory — the auto-detected project root, or the current
directory if no project root is found. Change it with `--base-dir`.

| Flag | Effect |
|------|--------|
| (default, `--files some`) | Reads and writes confined to the base directory |
| `--files all` | Unrestricted filesystem access |
| `--files none` | Only `.swival/` is accessible |
| `--add-dir <path>` | Grant read+write to an extra directory (repeatable) |
| `--add-dir-ro <path>` | Grant read-only to an extra directory (repeatable) |
| `--base-dir <path>` | Change the base directory |
| `--yolo` | Shorthand for `--files all --commands all` |

The read-before-write guard prevents overwriting files the agent
hasn't read. Disable with `--no-read-guard` if the agent creates
files from scratch.

### AgentFS (OS-enforced sandbox)

For stronger isolation, `--sandbox agentfs` re-execs Swival inside
an [AgentFS](https://github.com/tursodatabase/agentfs) overlay.
Writes go to a per-session SQLite-backed overlay instead of the
real filesystem.

Warning: the overlay does not merge back automatically. Persist
changes by reusing the session ID or copy files out of the overlay
manually. `agentfs diff <session-id>` shows the pending delta.

Session controls:

| Flag | Effect |
|------|--------|
| `--sandbox-session ID` | Name the session explicitly (persists across runs) |
| `--sandbox-strict-read` | Restrict reads to allowed dirs too (needs strict-read support; not in AgentFS 0.6.4) |
| `--no-sandbox-auto-session` | Fresh overlay every run (no auto-generated ID) |

See [agentfs.md](./references/agentfs.md) for install and usage.

### Command access

The `--commands` flag controls shell and command execution:

| Mode | Effect |
|------|--------|
| `all` (default) | Unrestricted; shell wrappers (`bash -c`, `sh -c`, `python3 -c`) permitted |
| `none` | Command execution disabled |
| `ask` | Prompt for approval on each command bucket |
| `ls,git,python3` | Comma-separated basename allowlist |

In any mode other than `all`, shell wrappers and shell syntax
(`&&`, `|`, `>`) are blocked — one command at a time.

Set a persistent allowlist in `config.toml`:

```toml
allowed_commands = ["ls", "git", "cat", "head", "tail", "find",
  "rg", "grep", "make", "uv", "curl", "diff", "patch", "python3"]
```

### Secret encryption (`--encrypt-secrets`)

Credentials in tool output are format-preserving encrypted before
reaching the LLM provider. The model sees plausible fakes; real
values are restored locally.

```bash
swival --encrypt-secrets -q "Read .env and configure the staging endpoint"
```

Pass `--encrypt-secrets-key HEX` (32-byte hex-encoded key) to get
deterministic encryption across runs — useful when you want
reproducible traces or want a second swival invocation to map the
same fake back to the same real value.

### Request auditing (`--llm-filter`)

Intercept every outbound LLM request. The filter script receives
JSON on stdin, writes filtered messages to stdout. Non-zero exit
or `{"allow": false}` blocks the request.

```bash
swival --llm-filter ./audit.py -q "Refactor the auth module"
```

### Prompt-injection posture

Tool and MCP output are tagged as untrusted before being fed to
the model. Markdown comments in skills render rather than hide,
so the rendered view matches what the agent interprets. Relevant
when loading third-party skills.

### `--yolo` still has guards

`--yolo` shorthands `--files all --commands all`, but two
mode-independent guards remain:

- Files deleted via Swival's `remove` tool move to
  `.swival/trash/<id>/` rather than unlinking. Recovery is
  possible.
- The read-before-write guard still requires reading a file before
  overwriting it (unless `--no-read-guard`).

There's no hard denylist of dangerous commands in full mode; pass
`--command-middleware` with a gate script, or `--commands ask` to
trigger per-bucket confirmation.

## Reviewer Loop

The reviewer is Swival's headline feature. It runs after each
answer and can force a retry until an acceptance condition is met
or the round budget runs out. Up to 15 rounds by default
(`--max-review-rounds N`, 0 disables retries).

### Self-review (same model, fresh context)

```bash
# Default review criteria
swival --self-review -q "Add input validation to cmd/serve.go"

# Custom review criteria appended to the built-in prompt
swival --self-review --review-prompt "Verify error messages include the field name" \
  -q "Add input validation to cmd/serve.go"
```

### Test-as-contract (programmatic reviewer)

An external script acts as the reviewer. Exit 0 accepts, 1 retries
with stdout as feedback to the agent, 2 = reviewer error.

```bash
# Loop until the test script exits 0
swival --reviewer ./run-tests.sh "Make the failing tests pass"
```

The script can be anything — `pytest`, `go test`, a `curl`
sequence, a linter chain. The contract is "must exit 0", not
a prompt the model can argue with.

### Acceptance criteria and batched objectives

- `--verify FILE` feeds acceptance criteria to the reviewer.
- `--objective FILE` reads the task description from a file
  instead of the `SWIVAL_TASK` env var (useful for batch eval).

```bash
swival --self-review --verify acceptance.md -q "Implement the parser"
swival --self-review --objective task.md --verify criteria.md
```

### System prompt overrides

`--system-prompt TEXT` injects a custom system prompt (mutually
exclusive with `--no-system-prompt`, which omits it). The
`swival-subagent` Pi plugin uses this to push the agent's Markdown
body (the content below the YAML frontmatter) as the system prompt.

## Model Selection

Most providers are native. Override the default per invocation:

```bash
# Frontier models via litellm proxy (Vertex / cross-region Bedrock)
swival --model claude-haiku-4-5 -q "Quick question"     # fast/cheap
swival --model claude-sonnet-4-6 -q "Refactor this"     # mid-tier
swival --model claude-opus-4-6 -q "Complex analysis"    # strongest
swival --model gemini-3.1-pro -q "Summarize this repo"  # Vertex

# Direct providers — no proxy needed
swival --provider huggingface --model zai-org/GLM-5 -q "Write parser tests"
swival --provider huggingface --model xiaomi/MiMo-V2.5-7B -q "Write tests"
swival --provider lmstudio -q "Refactor this"                          # LM Studio on :1234
swival --provider llamacpp -q "Refactor this"                          # llama.cpp server
swival --provider openrouter --model anthropic/claude-sonnet-4.5 -q "..."
swival --provider chatgpt -q "..."                                     # ChatGPT Plus/Pro OAuth
swival --provider bedrock --base-url us-east-2 --model <bedrock-id> --aws-profile prod -q "..."
```

Proxied model names depend on `~/.config/litellm/config.yaml`.
Direct providers use vendor model IDs. The native `bedrock`
provider reads `--base-url` as an AWS region or endpoint URL;
`--aws-profile` overrides `AWS_PROFILE`.

### Named profiles

Define `[profiles.NAME]` sections in `config.toml` and switch with
`--profile NAME`, or set `active_profile` as the default:

```bash
swival --profile fast -q "Quick lint fix"    # uses [profiles.fast]
swival --list-profiles                       # show available profiles
```

Since 1.0.13, first-run `swival --init-config` writes a
`[profiles.default]` block so new configs match the profile
structure used elsewhere.

### Thinking-model flags

For reasoning models (gpt-5.4, QwQ, MiMo-V2.5, DeepSeek-R1):

| Flag | Effect |
|------|--------|
| `--reasoning-effort LEVEL` | none / minimal / low / medium / high / xhigh / default |
| `--sanitize-thinking` | Strip leaked `<think>` tags from responses |
| `--extra-body JSON` | Pass extra API params, e.g. `'{"chat_template_kwargs": {"enable_thinking": false}}'` |
| `--no-prompt-cache` | Disable explicit cache annotations. Affects Anthropic / Gemini / Bedrock only; providers that auto-cache (OpenAI, Deepseek) are unaffected. |
| `--max-context-tokens N` | Request a specific context length (may trigger model reload) |

### Context overflow recovery (1.0.14)

When the local tiktoken estimate undercounts against the model's
real tokenizer and the provider rejects the request, Swival now
progressively truncates the prompt at 50 %, 25 %, and 10 % of the
context window and retries each one before declaring the turn
lost. A run that recovers this way completes normally; one that
exhausts all three retries surfaces as
`ContextOverflowError` (see Troubleshooting).

Enable `--proactive-summaries` on long runs with small-context
models to compress the transcript before it hits the ceiling.

## Other Capabilities

| Feature | Flag | Example |
|---------|------|---------|
| Cached analysis | `--cache` | `swival --cache -q "Analyze dependencies"` |
| JSON report | `--report FILE` | `swival --report out.json -q "..."` |
| HF-compatible trace | `--trace-dir DIR` | `swival --trace-dir ./traces -q "..."` |
| A2A endpoint (server) | `--serve` | `swival --serve --serve-port 8080 --serve-name "Reviewer"` |
| A2A client config | `--a2a-config FILE` | See A2A section below |
| Parallel workers | `--subagents` | `swival --subagents -q "Refactor auth and update tests"` |
| Proactive summaries | `--proactive-summaries` | Auto-summarize context on long runs (small-context models) |
| Lifecycle hooks | `--lifecycle-command CMD` | `swival --lifecycle-command ./scripts/sync -q "..."` |
| Command middleware | `--command-middleware CMD` | `swival --command-middleware ./scripts/gate.py -q "..."` |
| MCP config path | `--mcp-config FILE` | Overrides `.swival/mcp.json` lookup |
| Provider retries | `--retries N` | Transient-error retry budget (default 5; 1 disables) |
| Custom user agent | `--user-agent STRING` | Set `User-Agent` header for proxy-side attribution |
| Deterministic secrets | `--encrypt-secrets-key HEX` | 32-byte hex key for reproducible encryption |

### Lifecycle hooks

`--lifecycle-command CMD` runs at startup and exit as
`<cmd> startup|exit <base_dir>` with `SWIVAL_*` env vars for Git
and project metadata. Default is fail-open; add
`--lifecycle-fail-closed` to abort on hook failure. Useful for
syncing memory / AGENTS.md across machines.

### Command middleware

`--command-middleware CMD` runs before each `run_command` /
`run_shell_command` call. It receives a JSON payload on stdin and
replies with `{"action": "allow"}`, `{"action": "allow",
"mode": "<mode>", "command": "<rewritten>"}` (rewrites the
command), or `{"action": "deny", "reason": "<why>"}` (blocks
it).

### A2A (server and client)

Swival can both expose itself as an A2A endpoint and consume other
endpoints as subagents:

- `--serve` (with `--serve-port` / `--serve-name` /
  `--serve-description` / `--serve-auth-token`) publishes this
  instance.
- `--a2a-config FILE` points this instance at a TOML listing
  remote endpoints to call as subagents.

Minimal `a2a.toml`:

```toml
[a2a_servers.docs]
url = "http://localhost:8081"
description = "Documentation specialist"

[a2a_servers.reviewer]
url = "http://localhost:8082"
auth_token = "hf_..."
```

`--no-a2a` disables outbound client connections for nested or
automated runs.

### Delegating from Pi

The `swival-subagent` plugin (in `packages/swival-subagent/`
elsewhere in this repo) registers Swival as a Pi tool, dispatching
tasks to Swival with the reviewer loop, AgentFS sandbox, and
secret encryption layered on. Agents live in
`~/.pi/agent/swival-agents/` (user) or `.pi/swival-agents/`
(project). See the plugin's README for frontmatter schema and
installation.

## Structured Output

### `--report FILE` (schema v1)

Swival writes a JSON report on exit. Top-level shape:

```json
{
  "version": 1,
  "mode": "oneshot",
  "task": "...",
  "model": "claude-opus-4-6",
  "provider": "lmstudio",
  "result": {
    "outcome": "success",      // "success" | "failed" | "error"
    "answer": "...",
    "exit_code": 0,
    "error_message": null       // populated on outcome=error
  },
  "stats": { "turns": 4, "review_rounds": 1, "tool_calls_total": 8,
             "total_llm_time_s": 12.4, "llm_calls": 9 },
  "timeline": [ { "type": "llm_call", "...": "..." },
                { "type": "review", "round": 1, "exit_code": 0 } ]
}
```

Full fields: `version`, `mode`, `timestamp`, `task`, `model`,
`provider`, `settings`, `sandbox`, `result`, `stats`, `timeline`.
`result.outcome` is `"success"` when the reviewer accepted (or
review was disabled and Swival produced a terminal answer),
`"failed"` on reviewer rejection past the round budget, and
`"error"` when an `AgentError` subclass was raised — see
Troubleshooting.

### `--trace-dir DIR` (HuggingFace JSONL)

Swival writes `<trace-dir>/<sessionId>.jsonl` at end of session —
one file per session, one JSON object per line. Written in a single
pass after the session completes, not streamed per turn. Types:
`system`, `user` (plain or tool-result wrapper), `assistant`
(with `content[].type` of `text` or `tool_use`), and a
`last-prompt` sentinel. Tool calls correlate by `tool_use.id`
→ `tool_result.tool_use_id`. Paths are sanitised (base-dir →
`BASEDIR`, home → `~`); secrets are encrypted when
`--encrypt-secrets` is enabled.

## Interactive REPL

```bash
swival --repl
```

| Command | Effect |
|---------|--------|
| `/init` | Three-pass project scan, writes AGENTS.md |
| `/audit [paths...]` | Security and quality audit of the project. Accepts multiple focus paths (`/audit src/auth/ src/api/`). |
| `/audit --all` | Skip Phase 2 triage and deep-review every in-scope file. Record the flag with the run so `/audit --resume` picks up an `--all` run without re-passing the flag. |
| `/goal <objective>` | Start goal-driven mode (1.0.13). Feeds the objective back to the model after every answer; ends only when the agent signals completion after evidence-based audit, declares a blocker, or hits an optional token budget. Control with `/goal pause`, `/goal resume`, `/goal replace`, `/goal clear`. |
| `/learn` | Reviews session for mistakes, persists to memory |
| `/save [label]` | Context checkpoint |
| `/restore` | Collapse context since checkpoint |
| `/remember <text>` | Append fact to AGENTS.md |
| `/compact` | Compress context |
| `/tools` | List available tools |
| `!command` | Run script from `~/.config/swival/commands/` |

Session state saves on Ctrl-C and resumes on next `swival --repl`
in the same directory via `.swival/continue.md`. Disable with
`--no-continue` for nested / automated invocations.

### Memory and `/learn`

Auto-memory lives in `.swival/memory/` per project and aggregates
into `MEMORY.md`. `/learn` distils the session into durable notes;
subsequent runs retrieve budgeted slices. Controls: `--no-memory`
(skip loading), `--memory-full` (inject all of `MEMORY.md`),
`/remember <text>` (append to AGENTS.md).

## Recipes

Compose flags for common scenarios:

```bash
# Sandboxed + self-reviewed + credential-safe
swival --sandbox agentfs --self-review --encrypt-secrets \
  -q "Rotate the API keys in config/"

# Test-driven reviewer loop
swival --reviewer ./run-tests.sh "Make the failing tests pass"

# Cached self-review
swival --cache --self-review -q "Add comprehensive error handling"

# Parallel subagents with self-review
swival --subagents --self-review -q "Refactor auth, update tests, fix docs"

# Explore a read-only reference repo, write only to the project
swival --add-dir-ro /path/to/ref -q "Port the auth pattern from ref/"

# Audit all LLM traffic for compliance
swival --llm-filter ./compliance-log.py -q "..."

# Nested / automated invocation — disable interactive features
swival --no-lifecycle --no-mcp --no-a2a --no-history --no-continue --no-memory \
  -q "Run the migration"
```

## Configuration

| File | Purpose |
|------|----------|
| `~/.config/swival/config.toml` | Global Swival config |
| `~/.config/litellm/config.yaml` | Proxy model routing |
| `swival.toml` (project root) | Project-level overrides |

- Global: `swival --init-config` generates a template.
- Project: `swival --init-config --project` writes `swival.toml`
  under `--base-dir` (defaults to cwd) instead of the global path.
- Proxy manager: `swival-proxy start|stop|status|restart`.

## Troubleshooting

When `result.outcome` is `"error"`, `result.error_message` carries
the exception text. The four named `AgentError` subclasses:

| Error | Cause | Remedy |
|-------|-------|--------|
| `ConfigError` | Unknown provider, missing model, bad API key, malformed config | `swival --list-profiles`; check provider auth env (`HF_TOKEN`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, AWS chain) |
| `ContextOverflowError` | Prompt exceeds model context even after 50/25/10 % truncation retries | Trim the system prompt; `--proactive-summaries`; larger-context model; `--max-context-tokens` if supported |
| `ToolsNotSupportedError` | Model / provider lacks function calling | Switch to a tool-calling model; check `--extra-body` flags the provider needs |
| `LifecycleError` | Lifecycle hook failed under `--lifecycle-fail-closed` | Inspect the hook and its `SWIVAL_*` env; drop fail-closed to degrade |

Infrastructure failures outside these surface on stderr: expired
AWS SSO (`aws sso login`), 401/403/429 from the provider,
`ECONNREFUSED` against the proxy, and `E2BIG` when a giant system
prompt exceeds `ARG_MAX`.

## Limitations

- Native `bedrock` provider exists but has quirks (region in
  `--base-url`, limited model coverage); the litellm proxy is
  recommended for Bedrock cross-region inference profiles.
- No native Vertex AI provider — requires the litellm proxy. The
  native `google` provider targets the public Gemini API, not Vertex.
- No pane/tab TUI — Swival renders Markdown with preserved tags
  (so copy-paste keeps formatting) but doesn't draw a multi-pane
  interface.
- AgentFS requires separate installation via the upstream installer
  (`curl -fsSL https://agentfs.ai/install | bash`). No Homebrew
  formula exists.
- `--sandbox-strict-read` depends on strict-read support in AgentFS,
  which is not in the 0.6.x line as of 0.6.4 (March 2026).
