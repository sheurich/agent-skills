# Sandboxing and isolation

## Name the isolation boundary, then enumerate every crossing
- Rule: For each agent execution environment, state in one document what the security boundary is, what is inside it (and therefore not worth further hardening), and every channel by which data or control crosses back out.
- Threat: Without a named boundary, contributors and reviewers disagree about what counts as safe. Nobody owns the crossings where privilege could escalate, so bugs there go unreviewed.
- Mechanism: `coop`'s SECURITY.md declares the VM to be the security boundary. Its trust-model labels the guest VM Untrusted and lists taint sources. Passwordless `sudo` and `defaultMode: bypassPermissions` inside the guest are therefore documented as deliberate and correct. `background-agents` defines its boundary at the organization level. It supports single-tenant deployment only and treats every user as a trusted member of one organization. It performs no per-user repository access validation.
- Sources: `coop/main/SECURITY.md`, `coop/main/docs/trust-model.md`, `coop/main/AGENTS.md`, `background-agents/main/README.md`, `background-agents/main/docs/HOW_IT_WORKS.md`, `claude-code-devcontainer/main/README.md`

## Bypass mode requires a real isolation boundary, established first
- Rule: Never run `--dangerously-skip-permissions`, `--dangerously-bypass-approvals-and-sandbox`, `defaultMode: bypassPermissions`, `approval_policy = "never"`, or `:danger-full-access` outside a VM, container, or disposable cloud instance that already contains the blast radius; set bypass mode from inside the isolation's own provisioning, not from a host alias.
- Threat: An agent with no approval prompts and no sandbox executes destructive or exfiltrating commands on the operator's primary machine with no remaining control.
- Mechanism: The `claude-code-config` README says it runs Claude Code in bypass-permissions mode and relies on the sandbox to contain any damage. The `codex-config` README limits `:danger-full-access` and `approval_policy = 'never'` to external sandboxes, such as a devcontainer or a throwaway VPS. `claude-code-devcontainer`'s `post_install.py` sets `settings["permissions"]["defaultMode"] = "bypassPermissions"` only in the container's own settings. `micro` pairs the bypass flags with a discarded `ubuntu-latest` runner, `contents: read`, and SARIF-only output.
- Sources: `claude-code-config/main/README.md`, `codex-config/main/README.md`, `codex-config/main/AGENTS.md`, `coop/main/docs/trust-model.md`, `claude-code-devcontainer/main/post_install.py`, `micro/main/micro/micro.py`, `micro/main/action.yml`

## Escalating isolation tiers, matched to engagement risk
- Rule: Pick the isolation tier from the work: OS sandbox for routine local work, devcontainer with only project files mounted for untrusted or client code, disposable remote instance destroyed after the session for the highest-risk work such as CA infrastructure. Below all of these, give a separate identity or engagement its own config home (`CODEX_HOME=$HOME/.codex-isolated`) so history, skills, and prior trust decisions do not carry across contexts.
- Threat: A single isolation posture is either too weak for hostile code or too heavy for daily work, and operators default to the weaker one.
- Mechanism: `claude-code-config` documents the three tiers explicitly. It points to `trailofbits/claude-code-devcontainer` for isolation from the host filesystem, SSH keys, and cloud credentials. It points to `trailofbits/dropkit` for a throwaway droplet that you SSH into, run Claude Code on, and destroy afterward.
- Sources: `claude-code-config/main/README.md`, `codex-config/main/README.md`

## Sandbox reads are unrestricted by default; a config deny-list is not a sandbox
- Rule: Assume a native agent sandbox restricts writes only, and pair it with explicit read/edit deny rules; conversely assume settings deny-rules bind only the harness's own tools and not raw shell, so run both together.
- Threat: The operator believes `/sandbox` protects credentials while the agent can still read `~/.ssh` and `~/.aws`, or believes `permissions.deny` blocks `cat ~/.ssh/id_rsa` when a Bash invocation bypasses it entirely.
- Mechanism: The `claude-code-config` README says the sandbox limits writes to the current working directory but leaves reads open. The agent can still read `~/.ssh`, `~/.aws`, and similar paths. It also says that without `/sandbox`, deny rules cover only Claude's built-in tools, and Bash commands skip them. With `/sandbox` on, the OS enforces the same rules through Seatbelt or bubblewrap. The README advises using both.
- Sources: `claude-code-config/main/README.md`, `claude-code-config/main/settings.json`

## Set the capability profile and the approval trigger as two separate axes
- Rule: Configure what the sandbox permits and when the agent may ask for more as independent settings, and check that no legacy setting silently overrides the profile.
- Threat: An operator sets one control assuming it governs the other, producing a harness that is more permissive than intended.
- Mechanism: `codex-config` sets `default_permissions = "tob-workspace"` plus `approval_policy = "on-request"`. Its README warns against setting `sandbox_mode` in this config. Any active config layer that defines it makes Codex use that value in place of `default_permissions`.
- Sources: `codex-config/main/config.toml`, `codex-config/main/README.md`

## Test a permission profile against a command that must be denied
- Rule: After installing or changing any sandbox profile, run it against one command that should fail and one that should pass, instead of trusting the profile's declared intent.
- Threat: Declared rules and actual enforcement diverge, and the gap surfaces only after a real leak.
- Mechanism: `codex sandbox macos --permissions-profile tob-workspace -C . -- cat ~/.ssh/id_rsa` alongside `... -- git status`.
- Sources: `codex-config/main/README.md`

## Mount narrowly, mount read-only, never mount the Docker socket
- Rule: Bind-mount only purpose-specific paths into an agent container, pass a read-only flag whenever the container does not need to write, and never mount the host Docker socket.
- Threat: Mounting `$HOME` gives the in-container agent read-write access to everything under it; a mounted Docker socket is a direct full host-compromise path.
- Mechanism: `devc mount ~/secrets /secrets --readonly`. The README warns that any mount lets the container write to it unless `--readonly` is given, which weakens the filesystem isolation the project provides. It also states that the Docker socket is not mounted.
- Sources: `claude-code-devcontainer/main/README.md`

## Container-writable paths that host tooling later reads are escape vectors
- Rule: Mount read-only every path the container can write but the host later executes or trusts: `.git/config`, `.git/hooks`, `.devcontainer/`. Never grant `SYS_ADMIN`, because it permits remounting read-write. For untrusted repositories, use a terminal workflow instead of the editor's reopen-in-container command.
- Threat: Container-planted git hooks or devcontainer commands execute on the host during an ordinary later git action or rebuild; the editor's remote-container RPC path lets container code drive host-only editor commands by design.
- Mechanism: A comment in `install.sh` explains that `.devcontainer/` is mounted read-only inside the container. A compromised process therefore cannot plant mounts or commands in `devcontainer.json` that run on the host during a rebuild. The protection holds only if `SYS_ADMIN` is never added to `runArgs`. The README does not recommend the VS Code and Cursor reopen-in-container path for untrusted code. Container code can run host commands through that path by design.
- Sources: `claude-code-devcontainer/main/install.sh`, `claude-code-devcontainer/main/devcontainer.json`, `claude-code-devcontainer/main/README.md`

## Treat every sandbox-to-host crossing as tainted
- Rule: Treat every path, filename, and archive member originating in a sandbox as tainted; extract only through mechanisms that reject `..` and absolute-path members and verify containment, require confirmation before copying container-authored data to the host, constrain the destination to a fixed file type and namespaced path, and never interpolate output read back from the sandbox into `sh -c` or any host shell string.
- Threat: A guest-controlled tar member or filename is the classic path-traversal and symlink-escape primitive from a lower-trust environment into a higher-trust one, and an unconstrained sync lets a container plant files anywhere the operator's tools will later read.
- Mechanism: `coop`'s trust-model calls workspace pull the broadest guest→host channel. It also names it the most likely landing spot for a path-traversal or symlink escape. For the loop-mounted `/etc/hosts`, the host uses pinned directory descriptors, rejects symlinked `/etc`, reads only regular files via `O_PATH`, and replaces atomically. The loop-mounted hostname and network-config writes still lack path validation. `devc sync` warns that syncing is safe only for container contents you trust. It requires `y/N` unless `--trusted`, copies only `*.jsonl`, and namespaces everything under a `-devcontainer-<project>` key. On output, the trust-model says `check_guest_dirty` reads `git status --porcelain` from the guest. The result currently only gates control flow or is shown to the user. The host never feeds it to `sh -c`, and that must stay true.
- Sources: `coop/main/docs/trust-model.md`, `coop/main/.agents/skills/review/references/review-security.md`, `claude-code-devcontainer/main/install.sh`, `claude-code-devcontainer/main/README.md`

## Repository-supplied environment configuration is sandbox-scoped input only
- Rule: Apply repo-supplied setup scripts and devcontainer configuration (including OCI Feature install scripts) as untrusted, guest-scoped input; never let a value from a fetched config file reach a host command evaluation, run such scripts after clone with a bounded timeout, and treat their failure as non-fatal.
- Threat: A malicious repository achieves host code execution simply by being cloned and opened, or denies service by shipping a hanging setup script.
- Mechanism: `coop` states that config values from the repository only configure the guest. They must stay out of any host shell, including evaluation of a host `cmd:` value. It treats Feature install scripts as untrusted project code. Its report shows the resolved digest and the `install.sh` SHA-256 before setup proceeds. `background-agents` logs setup failures without blocking session start. Its default timeout is 5 minutes, configurable via `SETUP_TIMEOUT_SECONDS`.
- Sources: `coop/main/docs/trust-model.md`, `coop/main/docs/devcontainer.md`, `background-agents/main/README.md`, `background-agents/main/docs/HOW_IT_WORKS.md`

## Isolate parallel sandboxes from each other with two independent controls, asserted every start
- Rule: Block sandbox-to-sandbox traffic with mechanisms that cover different layers, re-assert them on every start rather than once at setup, verify the mechanism actually took effect, and fail closed when it cannot be established.
- Threat: One compromised sandbox reaches a sibling engagement's sandbox; a single control covering only one traffic path leaves the other open.
- Mechanism: bridge port isolation (`bridge link set … isolated on`) for L2 plus `iptables -I FORWARD 1 -i br0 -o br0 -j DROP` for L3. The trust-model says both controls are needed, since dropping either one reopens the path. Both are asserted on every `setup_tap` call. It reads the bridge flag back and fails if the port is not isolated, because kernels older than 4.18 silently drop that attribute. Isolation needs Linux 4.18 or later and `iproute2` 4.19 or later.
- Sources: `coop/main/docs/trust-model.md`

## Jail the component that holds the credential
- Rule: Self-confine any process that holds a real credential and terminates connections from an untrusted peer, before it binds a listener: deny filesystem writes and program exec as a hard floor, restrict egress to the ports actually needed, and abort startup if the floor cannot be established.
- Threat: A credential-holding proxy is new high-value attack surface; if compromised it can write files, exec programs, or make arbitrary egress using the credential it holds.
- Mechanism: Landlock applied in `coop-proxy`'s `main` before binding so every worker inherits the domain, tiered by kernel version (below 5.13 fails closed). On macOS, `sandbox-exec` runs a deny-by-default Seatbelt profile that permits only file reads, name lookups, the loopback listener, and `:443`/`:53`. If the proxy cannot establish the floor on filesystem writes and program `exec`, it exits before serving and the VM start aborts.
- Sources: `coop/main/docs/trust-model.md`, `coop/main/src/seatbelt-proxy.sb`

## Document what the isolation does not cover
- Rule: Publish, next to each isolation control, the residual gaps it leaves and which platform has the weaker implementation, rather than presenting the control as complete containment.
- Threat: An operator who reads only the feature list takes on more risk than the boundary actually absorbs.
- Mechanism: `claude-code-devcontainer`'s Threat Model table lists what the container does not protect against. These include container escape (the README calls escape difficult yet possible) and deferred escape via planted files. They also include the editor RPC path, dynamic iptables rewrite given `NET_ADMIN` plus passwordless sudo, and exfiltration of in-container credentials. `coop`'s trust-model has a dedicated list of residual gaps. Follow-up work is planned for them, and they remain open. It also states that the Firecracker story is stronger than Lima's. `post-patch-validation` says its environment controls do not amount to a host sandbox. It says so in the same section that describes them.
- Sources: `claude-code-devcontainer/main/README.md`, `coop/main/docs/trust-model.md`, `skills/main/plugins/post-patch-validation/skills/post-patch-validation/SKILL.md`

## Worktree isolation must be real, not assumed
- Rule: Give every parallel writing agent an explicit worktree (`git worktree add .worktrees/<branch>` or the harness's `isolation: "worktree"`); never accept a silent fallback to `git checkout -b` in a shared directory, and remember a `cd` inside a subagent isolates nothing.
- Threat: Two subagents that both believe they have isolated workspaces write to the same directory and clobber each other; the agent then reasons as if it had isolation it does not have.
- Mechanism: The `claude-code-config` README says the real danger is not the blocked write. The agent drops to `git checkout -b` inside the shared directory and then wrongly assumes it is isolated. The CLAUDE.md template notes that subagents share the parent's working directory. Agents writing files in parallel therefore need genuine isolation.
- Sources: `claude-code-config/main/README.md`, `claude-code-config/main/claude-md-template.md`

## An auditor must not build or execute what it audits
- Rule: Design audit tooling to work from manifests, lockfiles, source, and compiler-emitted artifacts only; never install, build, or run the audited project to gather evidence, and state that boundary so nobody expects build checking as a side effect.
- Threat: An auditor that installs or builds the target inherits the target's supply-chain risk and can be compromised by the thing it is auditing.
- Mechanism: `supply-chain-risk-auditor` reads only registry, advisory, and repository metadata. `zeroize-audit` runs read-only against the target codebase. It puts its analysis artifacts in a temporary working directory. It derives IR and assembly evidence from operator-controlled `clang`/`cargo` invocations.
- Sources: `skills/main/plugins/supply-chain-risk-auditor/skills/supply-chain-risk-auditor/SKILL.md`, `skills/main/plugins/zeroize-audit/skills/zeroize-audit/SKILL.md`

## Run untrusted check code under a fixed minimal environment, blind to what it is being tested against
- Rule: Execute contributor- or agent-supplied validation code with a fixed minimal environment (`PATH`, `HOME`, `LANG=C`, `TZ=UTC`, `PYTHONHASHSEED=0`), refuse to forward variables that change what executes, and hide from the check which revision it is running against.
- Threat: A check reads ambient secrets, changes what runs via `LD_PRELOAD`/`BASH_ENV`/`NODE_OPTIONS`/`GIT_SSH_COMMAND`, or infers vulnerable-versus-patched and fakes its own result.
- Mechanism: Two disjoint refusal classes enforced by the runner (credential-shaped names, execution-altering names), plus side-blind execution: no `{side}` placeholder, no `PPV_SIDE` variable, randomly named checkout directories, and anonymous capture descriptors.
- Sources: `skills/main/plugins/post-patch-validation/skills/post-patch-validation/SKILL.md`
