# Multi-agent controls

## Control flow downstream of untrusted content is itself untrusted
- Rule: Never let a subagent that touched untrusted content decide what runs next. A task to summarize a URL must not authorize delegation to a code-execution agent because the fetched page says so. An orchestrator must treat a subagent's output, including code it wrote and tool results it reports, as attacker-influenceable input to verify.
- Threat: A read-only fetch becomes arbitrary code execution when attacker text passes up to the orchestrator and back down to a more powerful agent — the multi-agent confused deputy.
- Mechanism: `pajaMAS` frames this as MAS hijacking and cites Triedman et al. 2025. It ships seven `simple_mas` HTML payloads. These steer the orchestrator's sub-agent selection purely through page content the web surfer reads. The same class is catalogued in entries about multi-agent systems running arbitrary malicious code and about rerouting LLM routers.
- Sources: `pajaMAS/main/README.md`, `pajaMAS/main/simple_mas/agent.py`, `pajaMAS/main/simple_mas/README.md`, `awesome-ml-security/main/README.md`

## Pin the subagent spawn-depth limit, and know what team mode changes
- Rule: Set the maximum subagent spawn depth explicitly rather than relying on a built-in default, and review whether unsupervised team formation is acceptable before enabling an experimental agent-teams mode, which turns a named delegate into a full independent teammate.
- Threat: The effective nesting limit arrives by remote feature flag and can move without a release, producing runaway recursive delegation; team mode expands the blast radius of autonomous action without the operator requesting it.
- Mechanism: `env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "3"` in `settings.json`, which the README says the harness enforces at spawn time, not through prompt guidance. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` sits alongside it and is documented as experimental.
- Sources: `claude-code-config/main/settings.json`, `claude-code-config/main/README.md`

## Delegate only genuinely independent work, with a bounded per-agent load
- Rule: Delegate large, genuinely parallel tracks only; do not spawn a subagent for work finishable in a few tool calls or merely to double-check routine output; cap the number of items per agent and split overflow into more agents rather than truncating coverage or scaling coordination without limit; on long autonomous runs, add a periodic fresh-context verifier that checks work against the spec.
- Threat: Indiscriminate fan-out multiplies independently acting processes without a matching increase in oversight, and an over-large per-agent batch silently returns a partial verdict list.
- Mechanism: Prose delegation rules in the CLAUDE.md template. `insecure-defaults` caps verifiers at 16 findings each and documents that total coverage has no cap while per-agent batch size does. `git-cleanup` sets a hard agent ceiling, stressing that eleven is a maximum rather than a typical count, with batches growing instead.
- Sources: `claude-code-config/main/claude-md-template.md`, `skills/main/plugins/insecure-defaults/README.md`, `skills/main/plugins/git-cleanup/README.md`

## Remove the tool that would let a checked agent derive its own answer key
- Rule: When an agent's output is graded against something a script in the same repository can compute, strip that agent's ability to run the script: give review, sweep, and dedup agents only read and search tools, and keep shell only for the agents whose job is literally to run commands, accepting those as trusted rather than controlled.
- Threat: A review agent with shell access reproduces the coverage ledger's answer key instead of reading the code. The source demonstrates this end to end: a report of 100% coverage with zero violations, produced without opening a single source file.
- Mechanism: A dedicated `agents/c-review-worker.md` tool list (`Read, Grep, Glob, Write`), contrasted explicitly with the detect and assemble agents that keep Bash, with the tradeoff stated.
- Sources: `skills/main/plugins/c-review/README.md`, `skills/main/plugins/c-review/AGENTS.md`

## Authenticate every internal call between harness components
- Rule: Require HMAC authentication on every control-plane-to-executor endpoint that creates, warms, snapshots, or restores sandboxes, generate the shared key with a CSPRNG, and compare signatures in constant time rather than with the language's string equality.
- Threat: Components that trust each other by network position let anything that can reach the endpoint manipulate sandboxes for any session; a non-constant-time comparison lets a remote attacker forge a signature incrementally by timing.
- Mechanism: `src/auth/internal.py` provides HMAC authentication for requests from the control plane, with every sandbox-management endpoint marked auth-required and `MODAL_API_SECRET="$(openssl rand -hex 32)"`. `verify.ts`'s `timingSafeEqual` accumulates with `result |= a.charCodeAt(i) ^ b.charCodeAt(i)` and explains why the length check does not leak timing.
- Sources: `background-agents/main/packages/modal-infra/README.md`, `background-agents/main/packages/github-bot/src/verify.ts`, `background-agents/main/packages/slack-bot/src/callbacks.ts`

## In a shared agent system, the shared credential's scope is the access control
- Rule: When one credential backs every user's actions, treat that credential's own scope as the enforcement point. Install the app on only the specific repositories in scope, never on all repositories. Put the interface behind SSO or VPN, since the system authorizes no user individually.
- Threat: A single shared installation grants every user of the tool everything the credential can reach, and an internet-reachable interface grants it to anyone who can load the page.
- Mechanism: The `background-agents` docs say to install the GitHub App only on the intended repositories, because the installation scope sets what the system can reach. They also say to use GitHub's repository selection. Three documents repeat the instruction to deploy behind the organization's SSO/VPN. That way only authorized employees reach the web interface.
- Sources: `background-agents/main/README.md`, `background-agents/main/docs/HOW_IT_WORKS.md`, `background-agents/main/packages/control-plane/README.md`
