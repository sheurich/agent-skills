# swival-subagent

A Pi extension that delegates tasks to a [swival](https://github.com/sheurich/agent-skills/tree/main/skills/swival)
subprocess. Mirrors the shape of Pi's built-in `subagent` extension but swaps
the spawn target to `swival`, so the delegated work runs inside swival's
reviewer loop, sandbox, and secret-encryption machinery.

Companion to the [`swival` skill](../../skills/swival/SKILL.md), which
teaches any agent how to invoke the CLI directly. Use `swival-subagent`
when you want Pi itself to dispatch work into swival.

## Why this exists

Pi's built-in subagent gives you isolated context and parallel execution.
Swival adds:

- Reviewer loop (`--self-review` or test-as-contract `--reviewer`) that
  iterates until the reviewer exits 0.
- AgentFS sandbox (`--sandbox agentfs`) that captures writes in an overlay.
- Format-preserving secret encryption (`--encrypt-secrets`).
- LLM request auditing (`--llm-filter`).

This plugin lets you dispatch to those capabilities via Pi's normal
subagent dispatch idiom. The two extensions coexist — use `subagent` when
you want a pi subagent, `swival-subagent` when you want swival's features.

## Install

```bash
pi install https://github.com/sheurich/agent-skills
```

Or install the plugin directly:

```bash
pi install /path/to/agent-skills/packages/swival-subagent
```

The plugin exposes one tool (`swival-subagent`) and four agent
definitions (`swival`, `reviewed-worker`, `test-runner`,
`sandboxed-explorer`) in `agents/`. Copy or symlink them into
`~/.pi/agent/swival-agents/` to make them discoverable.

### Agent selection

| Agent | Use when |
|-------|----------|
| `swival` | Generic delegate — no system prompt, no review. Also the implicit default when `agent` is omitted. |
| `reviewed-worker` | Multi-file code changes or any task where a second pass catches mistakes |
| `test-runner` | Task has a runnable test command (caller must pass `reviewerOverride`) |
| `sandboxed-explorer` | Exploratory changes you want to inspect before applying |

When `task` is provided without `agent`, the tool defaults to the
generic `swival` agent.

## Layout

```text
packages/swival-subagent/
├── README.md           # this file
├── package.json        # Pi extension manifest (pi.extensions)
├── extensions/
│   ├── index.ts        # the extension
│   └── agents.ts       # agent discovery
├── agents/             # swival agent definitions
│   ├── swival.md
│   ├── reviewed-worker.md
│   ├── test-runner.md
│   └── sandboxed-explorer.md
└── __tests__/          # self-contained vitest harness
```

## Agent frontmatter

Swival agents extend the pi-subagent frontmatter with swival-specific
fields. All fields are optional except `name` and `description`.

```yaml
---
# Required
name: my-agent
description: What this agent does

# Provider / model — omit to inherit from config.toml (recommended)
# Only set these if the agent requires a specific model regardless of environment.
provider: generic          # lmstudio | llamacpp | huggingface | openrouter | generic | google | chatgpt | bedrock
profile: fast              # named profile from config.toml
model: claude-sonnet-4-6   # provider-specific model id
baseUrl: http://127.0.0.1:4000

# Sampling / limits
temperature: 0.2                  # --temperature
topP: 0.95                        # --top-p
seed: 42                          # --seed
reasoningEffort: medium           # --reasoning-effort
maxOutputTokens: 32768            # --max-output-tokens
maxTurns: 100                     # --max-turns

# Caching
cache: true                       # --cache
cacheDir: .swival/cache           # --cache-dir

# Reviewer loop
selfReview: true                  # --self-review
reviewer: ./scripts/test.sh       # --reviewer SCRIPT (test-as-contract)
reviewPrompt: "Verify X and Y"    # --review-prompt
verify: ./acceptance.md           # --verify FILE
maxReviewRounds: 5                # --max-review-rounds N

# Filesystem / commands
sandbox: builtin | agentfs        # --sandbox
files: none | some | all          # --files
commands: all | none | ask | "ls,git,rg"  # --commands
baseDir: /abs/path                # --base-dir (default: pi cwd)
addDir: ["/path1", "/path2"]      # repeated --add-dir
addDirRo: ["/ref/repo"]           # repeated --add-dir-ro
encryptSecrets: true              # --encrypt-secrets
noReadGuard: true                 # --no-read-guard
yolo: true                        # --yolo (mutually exclusive with sandbox/files/commands)

# Prompt / memory
noInstructions: true              # --no-instructions (recommended for subagents)
noMemory: true                    # --no-memory
noSkills: false                   # --no-skills

# Nested-invocation hygiene (default: all true)
noLifecycle: true
noMcp: true
noA2a: true
noHistory: true
noContinue: true

# Output
quiet: false                      # -q (suppress swival diagnostics)

# Escape hatch
extraArgs: ["--max-context-tokens", "128000"]
---

System prompt body here.
```

## Usage from Pi

Single (default agent, no review):

```text
Use `swival-subagent` with task: "Refactor the auth module".
```

Single (self-reviewed):

```text
Use `swival-subagent` with agent: "reviewed-worker"
and task: "Add input validation to cmd/serve.go".
```

Test-as-contract:

```text
Use `swival-subagent` with agent: "test-runner",
reviewerOverride: "./run-tests.sh",
and task: "Make the failing tests pass".
```

Parallel:

```text
Use `swival-subagent` with tasks: [
  { agent: "reviewed-worker", task: "Refactor auth module" },
  { agent: "reviewed-worker", task: "Add error handling to parser" }
]
```

Chain:

```text
Use `swival-subagent` with chain: [
  { agent: "sandboxed-explorer", task: "Summarize the auth module" },
  { agent: "reviewed-worker",    task: "Given this summary: {previous}\nAdd input validation." }
]
```

Each chain step's `task` may contain the literal token `{previous}`, which
is replaced before dispatch with the prior step's final answer (from
`report.result.answer`). Steps run sequentially; the chain stops on the
first non-zero swival exit.

All chain steps share the single dispatch-time overrides object. For
different overrides per step, call the tool multiple times in single mode
and pass each step's output as context to the next.

### Dispatch-time overrides

All agent frontmatter is canonical. Callers may override specific fields
per call:

| Tool param                  | swival flag                |
|-----------------------------|----------------------------|
| `modelOverride`             | `--model`                  |
| `profileOverride`           | `--profile`                |
| `providerOverride`          | `--provider`               |
| `baseUrlOverride`           | `--base-url`               |
| `selfReviewOverride`        | `--self-review`            |
| `reviewerOverride`          | `--reviewer`               |
| `reviewPromptOverride`      | `--review-prompt`          |
| `maxReviewRoundsOverride`   | `--max-review-rounds`      |
| `maxTurnsOverride`          | `--max-turns`              |
| `maxOutputTokensOverride`   | `--max-output-tokens`      |
| `temperatureOverride`       | `--temperature`            |
| `topPOverride`              | `--top-p`                  |
| `seedOverride`              | `--seed`                   |
| `reasoningEffortOverride`   | `--reasoning-effort`       |
| `cacheOverride`             | `--cache`                  |
| `cacheDirOverride`          | `--cache-dir`              |
| `verifyOverride`            | `--verify`                 |
| `encryptSecretsOverride`    | `--encrypt-secrets`        |

Overrides apply to every step in parallel and chain modes.

## Tradeoffs vs pi's subagent

| Feature                   | pi `subagent`        | `swival-subagent`    |
|---------------------------|----------------------|----------------------|
| Per-tool-call streaming   | yes (`--mode json`)  | post-run replay (trace tail at session end) |
| Reviewer loop             | no                   | yes                  |
| Test-as-contract          | no                   | yes                  |
| AgentFS sandbox           | no                   | yes                  |
| Secret encryption         | no                   | yes                  |
| Parallel execution        | yes                  | yes                  |
| Chain mode (`{previous}`) | yes                  | yes                  |

Use `subagent` when you want fine-grained visibility into every tool call.
Use `swival-subagent` when correctness or isolation matters more than
display fidelity.

## Report surface (schema version 1)

The extension reads swival's `--report` JSON and uses it as the authoritative
source of final output and stats, falling back to stdout only when the report
is missing. Fields consumed:

| Key                          | Surfaced as                                       |
|------------------------------|---------------------------------------------------|
| `result.answer`              | final output (not the 16KB stdout tail)           |
| `result.outcome`             | `accepted` ("success") / `rejected` ("failed")    |
| `stats.review_rounds`        | header "N rounds"                                 |
| `stats.tool_calls_total`     | header "N tool calls"                             |
| `stats.tool_calls_by_name`   | expanded stats line                               |
| `stats.total_llm_time_s`     | expanded stats line                               |
| `stats.total_tool_time_s`    | expanded stats line                               |
| `stats.llm_calls`            | expanded stats line                               |
| `stats.compactions`          | expanded stats line                               |
| `timeline[].type == review`  | last reviewer feedback on rejection               |
| `model`, `provider`          | header prefix                                     |

Header format example:

```text
✓ reviewed-worker  claude-opus-4-6 · 3 rounds · 8 tool calls · 12.4s · accepted
```

The swival report does **not** include token or cost totals. If you need
those, run swival with `--cache` and inspect the cache DB, or parse
`--trace-dir` JSONL externally.

## Error classification

Common failure modes get a one-line headline instead of a raw stderr dump:

- AWS SSO session expired / credentials missing
- LLM provider 401 / 403 / 429
- Connection refused / DNS failure (proxy or MLX server down)
- swival `ConfigError`, unknown provider, missing AgentFS binary
- oversized system prompt (ARG_MAX)
- reviewer budget exhausted (`report.outcome=failed` with rounds set)

## Known limitations

- Per-tool-call streaming comes from tailing swival's `--trace-dir` JSONL
  output. The extension creates a private trace directory per run and
  watches it with `fs.watch`. On platforms without reliable `fs.watch`
  semantics (some network filesystems), updates may lag until the file
  handle flushes.
- System prompt body is passed as `--system-prompt` argv. At extreme
  sizes (hundreds of KB) this will hit platform ARG_MAX. Keep bodies
  reasonable or split long guidance into a skills dir passed via
  `extraArgs`.

## Running the tests

The `__tests__/` harness covers the pure `buildSwivalArgs`,
`summarizeReport`, and `classifyFailure` functions.

```bash
cd packages/swival-subagent/__tests__
./setup.sh          # first time only; installs vitest + symlinks pi deps
npx vitest run
```

The harness never runs an actual `swival` process; everything under test
is pure. Use the golden fixtures in `__tests__/fixtures/` as the source
of truth for the swival report schema we depend on — any schema drift
breaks the snapshots, not live runs.

## License

[MIT](../../LICENSE)
