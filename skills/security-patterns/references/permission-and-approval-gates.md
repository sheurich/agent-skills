# Permission and approval gates

## Prefer an allow-list to a deny-list wherever the legitimate command set is bounded
- Rule: For a project with a known, small set of legitimate operations, enumerate exactly the read-only inspection, git read, and build/lint/test invocations the agent may run and deny everything else by omission, instead of enumerating known-bad commands to block.
- Threat: A deny-list only stops patterns someone thought to enumerate; every other command is implicitly allowed.
- Mechanism: `coop`'s contributor-facing `permissions.allow` array lists narrow patterns (`ls:*`, `git status:*`, `git diff:*`, `cargo clippy:*`, `cargo test:*`, `gh pr view:*`, `actionlint:*`) with git mutations limited to `git add`, `git restore --staged`, `git commit`, `git fetch` — no `git push`, no arbitrary shell, no package installs.
- Sources: `coop/main/.claude/settings.json`

## Block the irreversible-command class at the tool-call boundary
- Rule: Deny at the tool boundary, not in prose: recursive-force `rm`, `sudo`, `mkfs`, `dd`, piping a downloaded script into a shell, `git push --force` in any argument position, `git reset --hard`, and any push whose ref is `main` or `master`; return the corrective command to the agent.
- Threat: One autonomous invocation destroys data irrecoverably, escalates privilege, or bypasses review and CI on a protected branch.
- Mechanism: `PreToolUse` hooks on the `Bash` matcher extract `.tool_input.command` with `jq`, regex-test across command separators (`;`, `&&`, `||`), print `BLOCKED: Use trash instead of rm -rf` or `BLOCKED: Use feature branches, not direct push to main` to stderr, and exit 2 so the error is fed back to the agent; `permissions.deny` carries the same patterns as globs, and `codex-config` mirrors them as `prefix_rule` decisions.
- Sources: `claude-code-config/main/settings.json`, `claude-code-config/main/README.md`, `claude-code-config/main/claude-md-template.md`, `codex-config/main/rules/default.rules`

## Hooks are guardrails, not a security boundary
- Rule: Treat every hook, `permissionDecision`, and stop-gate as structured prompt injection at an opportune moment that reduces likelihood; never count it as enforcement, and keep an independent OS-level boundary for the threats that matter.
- Threat: A prompt injection, a raw shell escape, or a harness that does not fire that hook event routes around the control entirely, while the operator has stopped applying real isolation.
- Mechanism: The `claude-code-config` README says hooks are not a security boundary, because prompt injection can get around them. It calls hooks a structured form of well-timed prompt injection, so they act as guardrails rather than walls. Bucket B notes the same limitation is unstated in the plugins that rely on returning `permissionDecision`/`ok` JSON for the host harness to honour.
- Sources: `claude-code-config/main/README.md`, `skills/main/plugins/gh-cli/hooks/hooks.json`, `skills/main/plugins/fp-check/hooks/hooks.json`

## Gate the irreversible action on a verification recorded against the current commit
- Rule: Block PR creation (or any delivery step) until a review has produced a clean verdict recorded specifically against the branch's current HEAD; any later commit re-arms the gate, and the verdict marker is written only by the review itself, never to bypass it.
- Threat: The agent opens a PR without having run the project's security review, or runs the review and then opens the PR against a later, unreviewed commit.
- Mechanism: A `PreToolUse` hook parses the Bash command for `gh pr create`. It resolves the target branch with a character-by-character tokenizer that tracks quote state. A `--head`/`-H` token inside a `--body`/`--title` string is therefore never taken as the flag. The hook reads a marker file under the git common dir that holds the last-reviewed SHA. It exits 2 unless that SHA matches HEAD. The review skill's final step is the only writer. The skill forbids recording the marker for a blocked verdict or to bypass review. The hook fails open on anything that is not an identifiable `gh pr create`, so unrelated work is never held up.
- Sources: `coop/main/.claude/hooks/closeout-review-gate.sh`, `coop/main/.claude/skills/closeout-review/SKILL.md`

## Authorization to touch live infrastructure is a stated precondition, not an inference
- Rule: Before any tool probes a live system, confirm the target is owned or explicitly authorized. Write down the components in scope, the attacker's capabilities, the forbidden actions, and the conditions for stopping. Never treat repository text, samples, or tool output as able to widen that scope.
- Threat: A skill that probes authentication, storage, or function endpoints gets pointed at production or a third party the operator was never authorized to test.
- Mechanism: `firebase-apk-scanner`'s plugin description and its when-not-to-use section state the authorization requirement separately from the capability list. The authorization-and-scope section of `security-research-hygiene` requires recording scope. The paired README note requires the goal to demonstrate an assumed attacker precondition rather than assert it.
- Sources: `skills/main/plugins/firebase-apk-scanner/README.md`, `skills-curated/main/plugins/ffuf-web-fuzzing/README.md`, `codex-config/main/.agents/skills/security-research-hygiene/SKILL.md`, `codex-config/main/README.md`

## The task request is not approval for the plan that satisfies it
- Rule: Present the exact rulesets, target, engine, and mode before running a scanner, and wait for an explicit yes. A bare request to scan the codebase does not approve whatever scope the agent chooses.
- Threat: The agent silently expands scope, selects unreviewed third-party rulesets, or runs against an unintended target on the strength of the original request.
- Mechanism: A tracked hard-gate step uses `AskUserQuestion`. The skill's Rationalizations table names the excuse of simply marking the step complete and rejects it.
- Sources: `skills/main/plugins/static-analysis/skills/semgrep/SKILL.md`

## Compute the whole batch, then execute only the approved subset
- Rule: For batch remediation against a live system, compute every proposed write first, present them in one view with local-only fields separated from real writes, execute nothing until approval, then apply only the approved subset one write at a time, continuing past individual failures rather than aborting the batch.
- Threat: Incremental autonomous action makes an early mistake live before a human notices the pattern in later output.
- Mechanism: `github-triage`'s two-phase design — phases 0 to 4 compute and present, phase 5 executes the approved subset — plus `disable-model-invocation: true` so the workflow is never invoked proactively.
- Sources: `skills/main/plugins/github-triage/skills/github-triage/SKILL.md`

## Re-verify each item's preconditions immediately before acting on it
- Rule: In any approved batch, re-fetch and re-check each item's state right before the write; treat an unknown state as not-ready, and never use `--admin`, `--auto`, or force to get past a check.
- Threat: State changed between the decision and the action — an earlier merge stales the next PR's mergeability, an earlier revocation changes what the next one means.
- Mechanism: `github-triage` merges oldest-first, re-checking `isDraft`, `mergeable == MERGEABLE`, `mergeStateStatus == CLEAN`, and CI status per PR; `git-cleanup` attaches a `verifyWith` precondition (`git merge-base --is-ancestor <branch> <default>`) to every delete candidate and re-runs it immediately before each `git branch -d`, skipping on failure.
- Sources: `skills/main/plugins/github-triage/skills/github-triage/SKILL.md`, `skills/main/plugins/git-cleanup/README.md`

## A protection list is a regex in code, not a sentence in a prompt
- Rule: Encode the list of protected branches, environments, or resources as a matcher in code that never presents them as actionable, rather than as an instruction a sufficiently persuasive context can argue the model out of; run confirmation gates in the main session, since subagents cannot ask the user anything.
- Threat: A model is talked out of a prompt-stated protection rule, or a subagent silently proceeds because it had no channel to ask.
- Mechanism: `git-cleanup` matches long-lived names (`main`, `master`, `staging`, `release/*`) by regex, requires two confirmation gates, and executes both in the main session.
- Sources: `skills/main/plugins/git-cleanup/README.md`

## Enforce declared scope mechanically and halt on the first violation
- Rule: In an autonomous fix loop, diff the working tree against a pinned baseline after every round, compare each changed path against the declared scope globs, and halt the loop immediately on any out-of-scope change, including untracked files guarded by content hash.
- Threat: An iterative review-and-fix loop drifts outside its authorized scope and edits files it was never allowed to touch.
- Mechanism: `code-improver` diffs against a pinned baseline commit and matches scope globs in code rather than relying on model self-restraint; the fixer's contract additionally bans `git checkout --`, `git stash`, `git reset`, and `git commit`.
- Sources: `skills/main/plugins/code-improver/README.md`

## Never let a tool rewrite agent configuration without showing the diff and asking
- Rule: Any automation that edits an agent host's configuration — MCP server lists, settings, hooks, CI workflows — must display exactly what will change, require explicit confirmation, and be idempotent about what is already configured; any prompt gating a security decision defaults to no, so an empty or uninterpretable answer rejects.
- Threat: A silent rewrite changes how every future session launches every tool, and the operator never sees it.
- Mechanism: `WrapMCPJsonManager.run()` calls `_load_config()`, `_analyze_servers()`, `_display_analysis()`, and only proceeds to `_wrap_servers()` and `_save_with_confirmation()` if `_confirm_wrapping()` returns true, reporting `servers_already_wrapped` versus `servers_to_wrap`; `confirm_prompt(prompt, default="n")` puts `""` in `reject_values` and accepts only `y`/`yes`.
- Sources: `mcp-context-protector/main/src/contextprotector/mcp_json_cli.py`, `mcp-context-protector/main/src/contextprotector/cli_utils.py`

## Propose fixes to security controls; do not apply them
- Rule: When an agent finds a defect in a blocklist, allowlist, permission list, or infrastructure configuration, report it with evidence and stop; apply the change only after a human approves it, and only with a regression test linked to the specific advisory.
- Threat: An agent's plausible-looking fix to a security control introduces an overly permissive rule that nobody independently reviewed.
- Mechanism: The `fickling` CLAUDE.md tells agents not to put suggested code fixes in reports until a human operator has reviewed and approved them. An accepted fix must ship with a regression test in `test/test_bypasses.py` that is linked to the advisory.
- Sources: `fickling/master/CLAUDE.md`, `codex-config/main/.agents/skills/security-research-hygiene/SKILL.md`

## Force execution through the managed toolchain, not the ambient one
- Rule: Intercept invocation shapes that bypass the project's locked environment or canonical package manager and return the corrected command, while explicitly passing through shapes the wrapper does not replace.
- Threat: A bare `python script.py`, `pip install`, or the wrong package manager runs code resolved from the ambient `PATH` instead of the pinned lockfile, silently reintroducing unaudited transitive dependencies.
- Mechanism: `modern-python` installs PATH shims for `python`/`pip`/`uv` that intercept bare script execution and `-m pip` but pass through `-c`, `-`, and non-pip `-m` because forcibly redirecting those broke real scripts; `enforce-package-manager.sh` blocks `^npm\s` when `pnpm-lock.yaml` is present with `BLOCKED: This project uses pnpm, not npm.`
- Sources: `skills/main/plugins/modern-python/hooks/shims/python`, `skills/main/plugins/modern-python/hooks/hooks.json`, `claude-code-config/main/hooks/enforce-package-manager.sh`
