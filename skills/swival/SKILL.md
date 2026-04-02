---
name: swival
description: >-
  Delegate tasks to Swival for self-reviewed code changes, sandboxed
  execution, secret-safe operations, cached analysis, and A2A agent
  serving. Use when a task benefits from automated review loops,
  filesystem sandboxing, credential encryption, LLM response caching,
  or exposing an agent as an HTTP endpoint.
---

# Swival

Swival is a CLI coding agent backed by litellm. It has features that
other agents lack: built-in self-review, layered sandboxing, secret
encryption, response caching, and A2A server mode. Use it as a
delegate for tasks that benefit from these capabilities.

## Prerequisites

Swival connects to LLM providers through a litellm proxy.
Verify both are installed before proceeding:

```bash
command -v swival       || echo "swival not found — see setup.md"
command -v swival-proxy || echo "swival-proxy not found — see setup.md"
swival-proxy status     # check if running
swival-proxy start      # start if not
```

If `swival` or `swival-proxy` are not installed, see
[setup.md](references/setup.md).

## Security Model

Swival enforces security at three layers: filesystem, commands, and
LLM content. Choose the right combination for the task.

### Filesystem sandbox

By default, file tools are restricted to the base directory (CWD).
`--yolo` disables all restrictions.

| Flag | Effect |
|------|--------|
| (default) | Reads and writes confined to CWD |
| `--add-dir <path>` | Grant read+write to an extra directory |
| `--add-dir-ro <path>` | Grant read-only to an extra directory |
| `--base-dir <path>` | Change the base directory |
| `--yolo` | Disable all filesystem and command restrictions |

The read-before-write guard prevents overwriting files the agent
hasn't read. Disable with `--no-read-guard` if the agent creates
files from scratch.

### AgentFS (OS-enforced sandbox)

For stronger isolation, `--sandbox agentfs` re-execs Swival inside
an [AgentFS](https://github.com/tursodatabase/agentfs) overlay.
Changes go to a session overlay, not to disk, until you approve
them. See [agentfs.md](references/agentfs.md) for install and usage.

### Command whitelist

Without `--yolo`, only commands listed in `allowed_commands` can run.
The default set is in `config.toml`:

```toml
allowed_commands = ["ls", "git", "cat", "head", "tail", "find",
  "rg", "grep", "make", "uv", "curl", "diff", "patch", "python3"]
```

Commands are resolved to absolute paths at startup. Shell syntax
(`&&`, `|`, `>`) is blocked — one command at a time.

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

### Security flag combinations

| Scenario | Flags |
|----------|-------|
| Untrusted task, review before applying | `--sandbox agentfs --self-review` |
| Credential handling, nothing leaves machine | `--encrypt-secrets --llm-filter ./redact.py` |
| Explore freely, no restrictions | `--yolo` |
| Read a reference repo, write only to project | `--add-dir-ro /path/to/ref` |
| Audit all LLM traffic for compliance | `--llm-filter ./compliance-log.py` |

## Self-Review

A second LLM pass reviews the result and retries on rejection.
Up to 15 rounds. Use for changes where you want automated QA
before inspecting the result.

```bash
swival --self-review -q "Add input validation to cmd/serve.go"
```

For custom review criteria:

```bash
swival --self-review --review-prompt "Verify error messages include the field name" \
  -q "Add input validation to cmd/serve.go"
```

## Other Capabilities

| Feature | Flag | Example |
|---------|------|---------|
| Cached analysis | `--cache` | `swival --cache -q "Analyze dependencies"` |
| JSON report | `--report FILE` | `swival --report out.json -q "Review this diff"` |
| A2A endpoint | `--serve` | `swival --serve --serve-port 8080 --serve-name "Reviewer"` |
| Parallel workers | `--subagents` | `swival --subagents -q "Refactor auth and update tests"` |

## Model Selection

Override the default model per invocation:

```bash
swival --model claude-haiku-4-5 -q "Quick question"     # fast/cheap
swival --model claude-sonnet-4-6 -q "Refactor this"     # mid-tier
swival --model claude-opus-4-6 -q "Complex analysis"    # strongest
swival --model gemini-3.1-pro -q "Summarize this repo"  # Vertex
```

Available models depend on the litellm proxy config at
`~/.config/litellm/config.yaml`.

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
in the same directory.

## Configuration

| File | Purpose |
|------|----------|
| `~/.config/swival/config.toml` | Global Swival config |
| `~/.config/litellm/config.yaml` | Proxy model routing |
| `swival.toml` (project root) | Project-level overrides |

Proxy manager: `swival-proxy start|stop|status|restart`

## Limitations

- No native Bedrock/Vertex provider — requires the litellm proxy.
- No rich TUI — output is plain terminal text.
- No extension/package ecosystem.
- AgentFS requires separate installation (`brew install tursodatabase/tap/agentfs`).
