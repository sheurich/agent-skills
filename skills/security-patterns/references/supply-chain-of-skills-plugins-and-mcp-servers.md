# Supply chain of skills, plugins, and MCP servers

## Install skills and plugins only from a marketplace that has been code-reviewed
- Rule: Restrict installation to an explicit list of approved marketplaces, keep internal, public, and vetted-third-party sets in separate marketplaces with different trust levels, require an approval workflow for any new marketplace or individual skill, and bake the approved list into images at build time rather than leaving marketplace selection to runtime agent behaviour.
- Threat: A skill executes with the same trust as the agent's own instructions, and published skills have a documented history of backdoors and malicious hooks; the public ecosystem has no built-in gate.
- Mechanism: Three marketplaces have stated tiers: `trailofbits/skills` (public, first-party), `trailofbits/skills-internal` (private, first-party), and `trailofbits/skills-curated`. The curated one holds third-party skills and outside marketplaces that were vetted and approved, and every addition gets code review. `skills-curated` also has a fixed approved-marketplace table, and `claude plugin marketplace add` calls run during container build.
- Sources: `claude-code-config/main/README.md`, `skills-curated/main/README.md`, `claude-code-devcontainer/main/Dockerfile`

## Read every line of every hook and script before accepting a skill
- Rule: Require a code owner's approval and a line-by-line static review of all shell and Python in hooks and scripts by default. Never run submitted hooks or scripts on the host. Before any runtime tests, require separate explicit operator approval and a disposable VM or container under operator-controlled, unprivileged configuration with no host mounts, no credentials, and no network. Do not use candidate-defined isolation, host lifecycle or setup hooks, added privileges or capabilities, host devices or namespaces, or control sockets. These prerequisites do not grant execution permission or override a static-only review or audit scope. Apply the same scrutiny to version bumps as to new submissions, and reject undocumented network requests, hooks that inject unrelated behaviour into tool calls, obfuscated code (base64, `eval`, encoded strings), and content with no real value.
- Threat: A description-only review misses network calls, destructive commands, and obfuscated logic in code the harness will run with full agent trust.
- Mechanism: `skills-curated`'s Curation Policy and PR Checklist, with the reject list stated explicitly. This repository adds the stricter local static-review and runtime-isolation requirements.
- Sources: `skills-curated/main/CLAUDE.md`

## A deterministic scanner is the floor, not the ceiling
- Rule: Run a pattern scanner over every imported plugin before merge with BLOCK as a hard failure and WARN as required PR discussion, and keep the human deep-review step load-bearing because the scanner cannot see reviewer-directed persuasion, bulk environment enumeration, or payloads inside files it classifies as binary.
- Threat: A submitted skill carries unicode tricks, network exfiltration, destructive commands, execution sinks, credential-path access, encoded payloads, privilege escalation, or shipped bytecode that a fast human read would miss — and conversely, a clean scan is read as a clean skill.
- Mechanism: `scan_plugin.py` implements eight regex and unicode-category families (bidi and zero-width codepoints, homoglyphs, network commands and URLs with punycode as a hard BLOCK, destructive shell commands, pipe-to-shell and `eval`/`exec`/`Function()`, credential paths, encoded payloads, privilege escalation, compiled bytecode) with exit codes 0, 2, and 3; its `_read_file_text` skips any file with a null byte in the first 8 KB.
- Sources: `skills-curated/main/scripts/scan_plugin.py`, `skills-curated/main/.claude/commands/review-plugin.md`

## Reject vendor-shipped Python bytecode outright
- Rule: Treat any `.pyc`, `.pyo`, or `__pycache__` entry in a skill or plugin submission as a hard block regardless of what the corresponding source says, and regenerate bytecode at install time.
- Threat: The reviewed `.py` is clean while the shipped bytecode differs arbitrarily; CPython will load the cached bytecode when its embedded metadata appears valid, so the executed code is the attacker's.
- Mechanism: Demonstrated live by `simple-formatter`, whose clean formatter source ships alongside a poisoned `__pycache__/utils.cpython-3xx.pyc` that steals environment variables; `scan_plugin.py` already encodes `BYTECODE_EXTENSIONS = {".pyc", ".pyo"}`.
- Sources: `overtly-malicious-skills/main/skills/simple-formatter/SKILL.md`, `overtly-malicious-skills/main/skills/simple-formatter/scripts/__pycache__/*.pyc`, `skills-curated/main/scripts/scan_plugin.py`

## Hidden payloads survive a partial read or ride in a bundled asset
- Rule: Compare each shipped script's total line count against its apparent complexity and read the full source before installing; a preview, a paginated read, or a head-only inspection is not evidence about the rest of the file; review every bundled binary, archive, or document asset as source code, and treat an instruction to convert a bundled document and then act on the conversion output as likely payload delivery.
- Threat: A script whose real body ends after 11 lines is followed by roughly 100,000 blank lines and then code that dumps every environment variable to stdout — invisible to any reviewer or scanner that truncates.
- Mechanism: Demonstrated live in `csv-summarizer/scripts/summarize.py` (100,015 lines, payload at 100,012 to 100,015), a working script that genuinely prints CSV row and column counts before exfiltrating `os.environ.items()`. `context-loader` ships `.instructions.docx.txt`, actually a DOCX, and instructs `pandoc --track-changes=all .*.docx -o output.md` then `cat`, so the payload sits in Word's tracked-changes machinery and surfaces only through the conversion the skill asks for.
- Sources: `overtly-malicious-skills/main/skills/csv-summarizer/scripts/summarize.py`, `overtly-malicious-skills/main/skills/context-loader/SKILL.md`, `overtly-malicious-skills/main/skills/context-loader/.instructions.docx.txt`, `overtly-malicious-skills/main/README.md`

## Pin every MCP server and agent CLI you fetch and execute
- Rule: Pin MCP server sources and agent-CLI installs to a specific tag, commit, or version; never let a session start by resolving and executing whatever is currently at an upstream branch head, especially where the resulting binary receives API keys or runs with approvals disabled.
- Threat: A compromised or simply updated upstream is fetched and executed on every session with the operator's credentials.
- Mechanism: `zeroize-audit`'s `.mcp.json` runs `uvx --from git+https://github.com/oraios/serena serena start-mcp-server` with no pin; `micro`'s action installs `@openai/codex` and `@anthropic-ai/claude-code` with `npm install -g` and no version qualifier, then runs them with bypass flags.
- Sources: `skills/main/plugins/zeroize-audit/.mcp.json`, `micro/main/action.yml`

## Install agent configuration from local files, never over the network
- Rule: Install harness configuration — settings, hooks, rules, skills — only from files already checked into the local clone; do not fetch configuration from a raw content host at install or update time.
- Threat: A compromised hosting origin, a MITM, or a paraphrasing fetch tool injects attacker content directly into the agent's own policy files during a routine update.
- Mechanism: The install skill tells the agent to rely solely on files in the local repository and never to fetch configuration over the network, GitHub included. `AGENTS.md` reinforces this as a surface boundary.
- Sources: `codex-config/main/.agents/skills/install-codex-config/SKILL.md`, `codex-config/main/AGENTS.md`

## Verify self-update with a mandatory checksum and state what provenance does not prove
- Rule: Validate the version tag as semver before it enters a URL, require a checksum manifest and refuse to install without it, verify every artifact against it, additionally attempt provenance attestation, extract with `--no-same-owner --no-same-permissions`, install by atomic rename, document which layer is mandatory versus best-effort, and check every override that redirects where trust-critical artifacts come from for whether it also drops provenance verification.
- Threat: An unverified self-update compromises every future invocation; conversely, presenting checksum plus attestation as one uniform guarantee hides that attestation is skippable, not revocation-checked, and pinned to the repository rather than a workflow or ref.
- Mechanism: `update.rs` provides `normalize_tag` and `verify_sha256`, plus a `gh attestation verify` call pinned with `--repo trailofbits/coop` and `--bundle attestations.jsonl`. The trust model says provenance is not assured on hosts without `gh`, so the checksum is the minimum guarantee. It also says any workflow on any ref in the repository holding `id-token: write` and `attestations: write` satisfies the check. On overrides: `COOP_UPDATE_API_BASE_URL` moves the update origin and turns off attestation. The checksum then proves integrity only against that server's own `SHA256SUMS` and gives no provenance. The model says to flag any change that broadens where the override is honored.
- Sources: `coop/main/docs/trust-model.md`, `coop/main/SECURITY.md`

## Verify that a declared tool restriction actually applies
- Rule: Cross-check three things. Agent files must use the agent key and skills must use the skill key for tool scoping. Frontmatter must parse at all. Every subagent dispatch must use a namespaced `<plugin>:<agent>` identifier that resolves to a real owned agent. Never accept the mere presence of frontmatter as proof that the restriction binds.
- Threat: A key swap parses fine and silently grants every tool; an unquoted colon drops the whole metadata block so the skill never triggers; a bare dispatch name resolves to the wrong agent with different tool scope, or inherits everything.
- Mechanism: `validate_plugin_metadata.py` inspects `AGENT_TOOLS_KEY` versus `SKILL_TOOLS_KEY` per file type, scans frontmatter scalars for unquoted colon-space and space-hash sequences, and cross-references every `subagent_type` string against known agents; `make check` failures are merge blockers.
- Sources: `skills/main/AGENTS.md`, `skills/main/.github/scripts/validate_plugin_metadata.py`, `skills/main/Makefile`

## One canonical metadata source, and a version that always increases
- Rule: Keep exactly one authoritative metadata file per plugin, forbid client-specific sidecar copies, and bump the version on every substantive change with CI enforcing the increment.
- Threat: Divergent sidecar metadata means different clients trust different tool and permission declarations for the same plugin name; a security fix without a version bump never reaches any installed client.
- Mechanism: `find_forbidden_sidecars` fails the build on duplicate metadata under `.codex/`, `.opencode/`, `.agents/`, or `plugins/*/.codex-plugin/`; `validate_version_increment` diffs against `--base-ref` for changed plugins, with a `no-version-bump` label for typo-only fixes.
- Sources: `skills/main/AGENTS.md`, `skills/main/.github/scripts/validate_plugin_metadata.py`

## Shipped skills disclose no local paths and record their provenance
- Rule: Scan every shipped file for absolute home-directory paths before publishing and use the harness's base-directory placeholder instead; require every imported third-party skill's README to link the original repository and list the modifications made during import.
- Threat: A shared or open-sourced plugin leaks an engineer's or client's filesystem layout and username; an unattributed import leaves a later reviewer unable to determine what diverged from upstream or whom to notify.
- Mechanism: `find_hardcoded_paths` regex-scans `.md`, `.py`, `.json`, `.sh`, `.bats`, `.yml`, and `.toml` under plugin directories, exempting fixtures and placeholder paths; the attribution requirement is documented and exemplified by the `humanizer` plugin's README.
- Sources: `skills/main/AGENTS.md`, `skills/main/.github/scripts/validate_plugin_metadata.py`, `skills-curated/main/README.md`

## Dependency policy covers more than advisories
- Rule: Deny wildcard version requirements, deny unknown registries and git sources, restrict crates or packages to a license allowlist with per-entry justifications, and explicitly ban competing implementations of a security-critical dependency such as a second TLS stack.
- Threat: A vulnerability-only policy misses license incompatibilities, wildcard requirements that silently accept any future release, and an unaudited second crypto surface pulled in behind the intended one.
- Mechanism: `deny.toml` sets `[bans] wildcards = "deny"`, `[sources] unknown-registry = "deny"` and `unknown-git = "deny"` with `allow-registry` pinned to `crates.io`, and bans `openssl`, `openssl-sys`, `native-tls`. A comment explains that the OpenSSL and system-TLS path must stay out of the dependency graph. That way nothing quietly pulls it in beside the `rustls` and `aws-lc-rs` stack.
- Sources: `coop/main/deny.toml`

## Per-language install gates, set environment-wide rather than per-project
- Rule: Block install-time script execution, require a minimum publish age, pin exact versions, commit lockfiles, and run the ecosystem's audit before installing: `NPM_CONFIG_IGNORE_SCRIPTS=true`, `NPM_CONFIG_MIN_RELEASE_AGE=1`, `NPM_CONFIG_AUDIT=true`, `NPM_CONFIG_SAVE_EXACT=true`; `pnpm audit --audit-level=moderate` with `minimumReleaseAge` and `ignore-scripts`; `pip-audit` with `==` pins and `uv pip install --require-hashes`; `cargo deny check`. Justify each new dependency as attack surface. Where a transitive constraint is load-bearing, encode it three ways — a documented reason, an ignore rule in the update bot, and a test asserting it — so an agent told to update dependencies cannot break it by accident.
- Threat: Postinstall scripts are a standard supply-chain execution vector, and a freshly published version has had no community exposure; an unpinned or lockfile-less project re-resolves against whatever is current at install time.
- Mechanism: `devcontainer.json`'s `containerEnv` sets the four `NPM_CONFIG_*` values container-wide rather than per project; path-scoped rule files carry the per-language gates and load only when the agent touches matching files; `check_dependabot_lockfiles` requires a committed `uv.lock` for every bot-watched directory; `anamorpher` documents `numpy>=1.24.0,<2.0.0` with its ABI reason, carries `ignore: - dependency-name: numpy versions: [">=2.0.0"]` in `dependabot.yml`, and asserts it in `tests/test_dependency_constraints.py`.
- Sources: `claude-code-devcontainer/main/devcontainer.json`, `claude-code-config/main/rules/typescript.md`, `claude-code-config/main/rules/python.md`, `claude-code-config/main/rules/rust.md`, `claude-code-config/main/claude-md-template.md`, `skills/main/.github/scripts/validate_plugin_metadata.py`, `anamorpher/main/CONTRIBUTING.md`, `anamorpher/main/.github/dependabot.yml`, `anamorpher/main/tests/test_dependency_constraints.py`

## Do not install tools by piping a remote script into a shell
- Rule: Apply the same scrutiny to `curl | bash` and `wget | bash` in your own Dockerfiles, install scripts, and CI as you would to an agent proposing that command; prefer a pinned binary download with checksum verification.
- Threat: Remote script content executes with no integrity check and no version pin, so a compromised origin or MITM changes what runs on every build.
- Mechanism: The same Dockerfile that pins git-delta and fzf to renovate-tracked versions installs Claude Code, fnm, and Oh My Zsh via `curl -fsSL <url> | bash`; `datasig`'s release workflow runs `curl -LsSf https://astral.sh/uv/install.sh | sh` in a job holding `id-token: write` and `contents: write`.
- Sources: `claude-code-devcontainer/main/Dockerfile`, `datasig/main/.github/workflows/release.yml`, `claude-code-config/main/settings.json`
