---
name: swival
description: >-
  Delegate tasks to Swival for self-reviewed code changes, sandboxed
  execution, secret-safe operations, cached analysis, local-model
  inference, and A2A agent serving or clientele. Use when a task
  benefits from automated review loops against acceptance criteria,
  filesystem sandboxing, credential encryption, LLM response
  caching, or orchestrating a network of A2A agents.
---

# Swival

Swival is a CLI coding agent with native providers for local
inference (`lmstudio`, `llamacpp`, `huggingface`), `openrouter`,
`chatgpt`, `google` (Gemini), and `bedrock`, plus a `generic`
OpenAI-compatible provider for anything else including litellm
proxies. It has features other agents lack: a built-in reviewer
loop, layered sandboxing (builtin + AgentFS), format-preserving
secret encryption, outbound request filtering, A2A server **and**
client, lifecycle hooks, and command middleware. Use it as a
delegate for tasks that benefit from these capabilities.

## Prerequisites

Swival talks to most providers directly. The litellm proxy is
only needed for Vertex AI and for Bedrock cross-region inference
profiles that the native `bedrock` provider doesn't handle.

```bash
command -v swival >/dev/null 2>&1 || { echo "swival not found — see setup.md"; exit 1; }

# Only when routing through litellm (Vertex / cross-region Bedrock):
if [ "$SWIVAL_NEEDS_PROXY" = 1 ]; then
  command -v swival-proxy >/dev/null 2>&1 || { echo "swival-proxy not found — see setup.md"; exit 1; }
  swival-proxy status || swival-proxy start
fi
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
Writes go to a per-session SQLite-backed overlay instead of the real
filesystem. Inspect changes with `agentfs diff <session-id>`; there
is no built-in merge-back command, so persist changes by reusing the
session ID or copy files out manually. See
[agentfs.md](./references/agentfs.md) for install and usage.

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

### Request auditing (`--llm-filter`)

Intercept every outbound LLM request. The filter script receives
JSON on stdin, writes filtered messages to stdout. Non-zero exit
or `{"allow": false}` blocks the request.

```bash
swival --llm-filter ./audit.py -q "Refactor the auth module"
```

### Prompt-injection posture

Tool and MCP output are tagged as untrusted before being fed to
the model. Markdown comments in skills are ignored rather than
hidden, so the rendered version matches what the agent actually
interprets. Relevant when loading skills authored by third parties.

### `--yolo` still has guards

`--yolo` is a shorthand for `--files all --commands all`, but two
mode-independent safety mechanisms remain:

- Files deleted via Swival's `remove` tool are moved to
  `.swival/trash/<id>/` rather than unlinked. Recovery is possible
  if the agent deletes the wrong file.
- The read-before-write guard still requires a file to be read
  before it is overwritten (unless `--no-read-guard` is passed).

There is no hard-coded denylist of dangerous commands in full
mode — if you need one, pass `--command-middleware` with a gate
script, or use `--commands ask` so high-risk buckets trigger
confirmation prompts.

### Security flag combinations

| Scenario | Flags |
|----------|-------|
| Untrusted task, review before applying | `--sandbox agentfs --self-review` |
| Credential handling, nothing leaves machine | `--encrypt-secrets --llm-filter ./redact.py` |
| Explore freely, no restrictions | `--yolo` |
| Read a reference repo, write only to project | `--add-dir-ro /path/to/ref` |
| Audit all LLM traffic for compliance | `--llm-filter ./compliance-log.py` |

## Reviewer Loop

A reviewer runs after each answer and can force a retry. Up to 15
rounds by default (`--max-review-rounds N`, 0 disables retries).

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

## Other Capabilities

| Feature | Flag | Example |
|---------|------|---------|
| Cached analysis | `--cache` | `swival --cache -q "Analyze dependencies"` |
| JSON report | `--report FILE` | `swival --report out.json -q "Review this diff"` |
| HF-compatible trace | `--trace-dir DIR` | `swival --trace-dir ./traces -q "..."` |
| A2A endpoint (server) | `--serve` | `swival --serve --serve-port 8080 --serve-name "Reviewer"` |
| A2A client config | `--a2a-config FILE` | `swival --a2a-config ./a2a.toml -q "Ask the docs agent..."` |
| Parallel workers | `--subagents` | `swival --subagents -q "Refactor auth and update tests"` |
| Lifecycle hooks | `--lifecycle-command CMD` | `swival --lifecycle-command ./scripts/sync -q "..."` |
| Command middleware | `--command-middleware CMD` | `swival --command-middleware ./scripts/gate.py -q "..."` |

**Lifecycle hooks** run at startup and exit as `<cmd> startup|exit
<base_dir>` with `SWIVAL_*` env vars for Git and project metadata.
Default is fail-open; add `--lifecycle-fail-closed` to abort on
hook failure. Useful for syncing memory/AGENTS.md across machines
without committing them.

**Command middleware** runs before each `run_command` /
`run_shell_command` call. It receives JSON on stdin and replies
with `{"action": "allow"}`, `{"action": "allow", "mode": ...,
"command": ...}` to rewrite, or `{"action": "deny", "reason": ...}`
to block.

**A2A client config** (`--a2a-config`) points to a TOML file with
`[a2a_servers.*]` tables and lets Swival dispatch subtasks to
other A2A agents — for example, a dedicated documentation agent
running a smaller local model.

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
swival --provider lmstudio -q "Refactor this"                          # LM Studio on :1234
swival --provider llamacpp -q "Refactor this"                          # llama.cpp server
swival --provider openrouter --model anthropic/claude-sonnet-4.5 -q "..."
swival --provider chatgpt -q "..."                                     # ChatGPT Plus/Pro OAuth
swival --provider bedrock --base-url us-east-2 --model <bedrock-id> -q "..."
```

Proxied model names depend on `~/.config/litellm/config.yaml`.
Direct providers use their vendor's model identifiers.

## Combining Flags

Flags compose:

```bash
# Sandboxed + self-reviewed + credential-safe
swival --sandbox agentfs --self-review --encrypt-secrets \
  -q "Rotate the API keys in config/"

# Cached self-review
swival --cache --self-review -q "Add comprehensive error handling"

# Parallel subagents with self-review
swival --subagents --self-review -q "Refactor auth, update tests, fix docs"
```

## Interactive REPL

```bash
swival --repl
```

| Command | Effect |
|---------|--------|
| `/init` | Three-pass project scan, writes AGENTS.md |
| `/learn` | Reviews session for mistakes, persists to memory |
| `/save [label]` | Context checkpoint |
| `/restore` | Collapse context since checkpoint |
| `/remember <text>` | Append fact to AGENTS.md |
| `/compact` | Compress context |
| `/tools` | List available tools |
| `!command` | Run script from `~/.config/swival/commands/` |

Session state saves on Ctrl-C and resumes on next `swival --repl`
in the same directory via `.swival/continue.md`.

### Memory and `/learn`

Auto-memory lives in `.swival/memory/` per project and aggregates
into `MEMORY.md`. `/learn` reflects on the session at its end and
writes concise, durable notes about mistakes to avoid repeating.
Subsequent runs retrieve budgeted slices of `MEMORY.md` into the
prompt.

- `--no-memory` — skip auto-memory loading.
- `--memory-full` — inject all of `MEMORY.md` instead of a
  budgeted retrieval.
- `/remember <text>` (REPL) — append a durable fact to `AGENTS.md`.

## Configuration

| File | Purpose |
|------|----------|
| `~/.config/swival/config.toml` | Global Swival config |
| `~/.config/litellm/config.yaml` | Proxy model routing |
| `swival.toml` (project root) | Project-level overrides |

Proxy manager: `swival-proxy start|stop|status|restart`

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
