# Secrets

## Never put a secret on a command line
- Rule: Pass credentials through the process environment, SSH `SendEnv`, or stdin — never argv; where a third-party CLI offers no non-argv path, document the exception at the call site and scope it to that one step, and prefer an environment variable over a flag in any CLI you write.
- Threat: A secret in argv is visible to every other process on the host through `ps` and `/proc`, far beyond the intended recipient.
- Mechanism: `coop` forbids building a command line that carries a secret, because `ps` and `/proc` expose it to other processes. It routes secrets through `prepare_env_forwarding`/`EnvForward`, `exec_with_stdin`, and `curl -H @-`, with named exceptions for `security` and `op`. The help text for `fickling`'s `--hf-token` recommends the `HF_TOKEN` environment variable so the token stays out of process listings.
- Sources: `coop/main/docs/trust-model.md`, `coop/main/.agents/skills/review/references/review-security.md`, `fickling/master/fickling/cli.py`

## Deny credential reads across home and workspace, and deny edits that plant persistence
- Rule: Deny reads of `~/.ssh/`, `~/.gnupg/`, `~/.aws/`, `~/.azure/`, `~/.config/gh/`, `~/.git-credentials`, `~/.docker/config.json`, `~/.kube/`, `~/.npmrc`, `~/.npm/`, `~/.pypirc`, `~/.gem/credentials`, and `~/Library/Keychains/`, additionally deny `**/.env`, `**/.env.*`, `**/*.pem`, and `**/*.key` inside the writable workspace itself, and deny `Edit` on `~/.bashrc`, `~/.zshrc`, and `~/.ssh/**`.
- Threat: A broad-read agent exfiltrates keys and cloud credentials into its context, and from there into logs, a model provider, or an attacker via injection; the likeliest secret in a real working tree is an un-gitignored project-local one; an edit to a shell startup file or the SSH directory plants a backdoor that outlives the session.
- Mechanism: `claude-code-config`'s `permissions.deny` `Read(...)` globs cover the home-directory list; `codex-config`'s `[permissions.tob-workspace.filesystem.":workspace_roots"]` sets `"." = "write"` and then re-denies the four project-local secret patterns; the same deny array carries `Edit(~/.bashrc)`, `Edit(~/.zshrc)`, and `Edit(~/.ssh/**)`, documented as preventing backdoor planting.
- Sources: `claude-code-config/main/settings.json`, `claude-code-config/main/README.md`, `codex-config/main/config.toml`

## Credential forwarding defaults to off and fails closed
- Rule: Forward no credential into a lower-trust execution context unless the invocation explicitly asks for it; support an explicit suppression flag, reject overrides of the managed variable names, fail closed on a failed retrieval, and treat any change that forwards a credential by default or makes it persistent as a review finding.
- Threat: A token forwarded by default, or written into a git credential helper inside an untrusted guest, becomes standing state that anything later running there can exfiltrate.
- Mechanism: The `coop` trust model sets `GITHUB_TOKEN` to Off by default. Active assignments refuse overrides of both managed names, `GITHUB_TOKEN` and `GH_TOKEN`, and abort on a missing reference or a failed retrieval. When the token is forwarded, `bootstrap_agents` runs `gh auth setup-git`, so the token becomes durable guest state. The model treats any change that forwards the token by default, or adds persistence that was absent, as a finding.
- Sources: `coop/main/docs/trust-model.md`

## Refuse credential-shaped variable names even when the operator asks
- Rule: Hard-refuse, not warn, any request to forward or persist an environment variable whose name matches `*SECRET*`, `*TOKEN*`, `*API_KEY*`, or similar, regardless of how deliberate the request is.
- Threat: A toolchain variable allowlist is used to forward a secret, whose value is then written into a persisted result file or audit artifact.
- Mechanism: `post-patch-validation`'s runner enforces two disjoint refusal classes — credential-shaped names (the value would land in `result.json`) and execution-altering names — both non-negotiable regardless of `--allow-env` intent.
- Sources: `skills/main/plugins/post-patch-validation/skills/post-patch-validation/SKILL.md`

## Containment is not credential protection
- Rule: Treat every credential reachable inside a container, VM, or keyring session as fully usable and exfiltratable by anything running there; scope what is forwarded to the minimum the task needs, and do not count moving a secret into a keyring as removing it from a compromised environment's reach.
- Threat: The operator assumes a container-scoped or keyring-stored credential is protected, when the compromise boundary has not moved.
- Mechanism: `claude-code-devcontainer` lists credential theft from inside the container as a known risk: Claude, GitHub, and other tokens given to the container are readable there. It also forwards an SSH agent, so container code can authenticate as the operator. `coop` warns that code controlling the guest can use or pull out anything its keyring session can unlock. Each bootstrap deletes stray `~/.codex/auth.json` files, and `coop codex` refuses to launch unless keyring mode is actually selected.
- Sources: `claude-code-devcontainer/main/README.md`, `coop/main/docs/trust-model.md`

## Give a sandbox access to an API, not possession of the key
- Rule: Where a proxy is feasible, keep the real upstream credential on the trusted side and hand the lower-trust context only a narrowly scoped, per-instance capability token that a jailed proxy exchanges for the real credential against a fixed upstream; resolve each credential on the host and pass it over stdin, never argv or disk, and fail the boot closed if resolution fails.
- Threat: A full-scope, long-lived API key inside an untrusted environment is reusable far beyond the single session by whoever compromises it.
- Mechanism: `coop`'s `[proxy]` mode hands the guest only a capability token for each instance. Claude gets it through `settings.json`, and Codex gets it as the bearer `env_key` of the `coop_local` provider. The proxy relays only the provider operations its documentation lists, to one fixed upstream per provider, with one process and tunnel per VM and provider.
- Sources: `coop/main/docs/trust-model.md`, `coop/main/docs/credential-proxy.md`

## Make secret leakage into logs structurally impossible
- Rule: Wrap secrets in a type whose debug rendering never prints the value, and redact argv in command traces, so logging a credential requires actively defeating the type system rather than merely forgetting a convention.
- Threat: One missed call site puts a credential into logs, which are retained longer and shared more widely than the session that produced them.
- Mechanism: `Cmd::redacted_arg` masks argv in traces, and custom `Debug` impls on `EnvForward` and `Secret<T>` keep values out of debug output. The trust model also says never to log a resolved secret. Architectural invariant 5 in `ARCHITECTURE.md` keeps secrets off argv and logs: use env, `SendEnv`, or stdin, and redact in traces.
- Sources: `coop/main/docs/trust-model.md`, `coop/main/docs/ARCHITECTURE.md`

## Configuration holds a retrieval path, never a secret value
- Rule: Store a retrieval command or keychain reference in config, and resolve it at point of use. Default credential stores to the OS keyring. Ship placeholders in checked-in templates. Keep populated values in gitignored files. Allow a plaintext credential file only on a throwaway machine dedicated to one job.
- Threat: A plaintext token in a config file, template, or committed `.env` is a standing disclosure risk independent of any runtime control.
- Mechanism: `coop`'s `config.toml` holds a `cmd:...` retrieval command resolved at VM start. `codex-config` sets `cli_auth_credentials_store = "keyring"` and `mcp_oauth_credentials_store = "keyring"`. Its README warns that the `"file"` setting writes credentials to disk as plaintext and does not belong on a shared workstation. `mcp-template.json` ships `"EXA_API_KEY": "your-exa-api-key-here"`. CompChomper's `.env` contains only empty assignments and is gitignored.
- Sources: `coop/main/docs/trust-model.md`, `codex-config/main/config.toml`, `codex-config/main/README.md`, `claude-code-config/main/mcp-template.json`, `CompChomper/main/.gitignore`

## Route every secret-file write through one permission-enforcing helper
- Rule: Store secret files at mode 0600 in a 0700 directory, and funnel all writes through a single atomic-write helper that never relaxes permissions, rather than trusting each call site.
- Threat: A secret written with inherited permissions is readable by other local users or processes.
- Mechanism: PAT files live at `<state_dir>/github-pat/<account>.txt`, written via `secret_store.rs:store_file`. The trust model says every managed write passes through `fs_util::atomic_write_with_mode` or `atomic_write_ssh`, and neither ever loosens permissions.
- Sources: `coop/main/docs/trust-model.md`

## Encrypt stored credentials, key them outside the store, and never return a value
- Rule: Encrypt tokens and per-repository secrets at rest with AES-256-GCM, decrypt only at point of use, keep the encryption key in deployment configuration rather than in the database holding the ciphertext, and expose only key names through any client-facing API — never a stored value, on any code path.
- Threat: Anyone with read access to the database, a backup, or an exfiltrated snapshot obtains live credentials.
- Mechanism: `encryptToken`/`decryptToken` use `env.TOKEN_ENCRYPTION_KEY`, with a separate `REPO_SECRETS_ENCRYPTION_KEY` for repo secrets in D1. The docs say secrets reach sandboxes at startup, clients never see them, and only key names are visible. `GET /repos/:owner/:name/secrets` is documented as listing secret keys.
- Sources: `background-agents/main/packages/control-plane/README.md`, `background-agents/main/docs/HOW_IT_WORKS.md`

## A tool holding an API credential reads it from the environment and states its privilege
- Rule: Have every MCP server or agent tool read its credential from an environment variable with no persistence and no logging, build auth headers fresh per request, and document in its README the effective privilege the token carries so operators scope it correctly.
- Threat: A logged, cached, or model-visible credential becomes a secondary exfiltration target for prompt injection or log exposure.
- Mechanism: `HackerOneClient.__init__` reads `HACKERONE_API_USERNAME`/`HACKERONE_API_TOKEN`/`HACKERONE_PROGRAM_HANDLE` from `os.environ`, and `_auth_header()` rebuilds the Basic header per request. The README names the environment as the only credential source, with no logging or persistence. It tells operators to guard the API token as a secret carrying the full access of their HackerOne user account. `micro` injects only the active provider's key into the child process environment just before spawn.
- Sources: `hackerone-mcp/main/README.md`, `hackerone-mcp/main/hackerone_mcp/client.py`, `micro/main/micro/micro.py`

## Audit the environment-variable channel, not just credential files
- Rule: When a harness inherits the full host environment into an agent session, treat every exported cloud, CI, and registry credential as reachable regardless of any filesystem deny-list, and restrict what is inherited instead of assuming the file rules cover it.
- Threat: A well-specified deny-list on `~/.aws/**` and `~/.npmrc` gives false assurance while the same credentials sit in environment variables the agent can read.
- Mechanism: `codex-config`'s `[shell_environment_policy] inherit = "all"` passes the entire host environment into the sandboxed session alongside its own credential-file denials, with no equivalent restriction on the variable channel.
- Sources: `codex-config/main/config.toml`

## A repository that ever held secrets is recreated, not rewritten, before going public
- Rule: Scan full history with `gitleaks git .` or `trufflehog git file://.` before any other open-sourcing step, check Actions logs and artifacts, releases, issue and PR history, and the wiki as well, and when secrets are confirmed create a fresh repository from the current tree and archive the old one privately.
- Threat: History rewrites do not reach existing forks, clones, CI logs, old releases, or the wiki, so the secret stays publicly reachable after a clean-looking rewrite; a revoked key still discloses infrastructure names and patterns.
- Mechanism: A dedicated secrets-audit step, which the skill says comes before anything else, lists three excuses to reject. The first is that the key was already revoked, so history is fine. The second is that a `git-filter-repo` rewrite will do. The third is that the data is only test data.
- Sources: `skills/main/plugins/open-sourcing/skills/open-sourcing/SKILL.md`

## Apply fallback-secret and fail-open review to your own agent infrastructure
- Rule: Review the operator's own CI configs, MCP settings, sandbox configs, and infrastructure-as-code for the same defects audited in application code: a secret with a working default, a seeded default account, or an authentication switch that defaults to off; the decisive test is whether the system runs with the fallback (`env.get(X, Y)` runs, `env[X]` crashes).
- Threat: The agent-running infrastructure itself carries the class of defect the agent is pointed at other code to find.
- Mechanism: Paired vulnerable and secure examples per category (fallback secrets, default credentials, fail-open switches) with an explicit skip clause for genuinely test-scoped or per-boot-random defaults.
- Sources: `skills/main/plugins/insecure-defaults/references/fallback-secrets.md`, `skills/main/plugins/insecure-defaults/references/default-credentials.md`, `skills/main/plugins/insecure-defaults/references/fail-open-security.md`
