# CI and repository hardening

## Pin what CI executes and give it the least token it needs
- Rule: Pin every third-party action by its full commit SHA. Put the version in a comment at the end of the line, looked up fresh rather than recalled from memory. Pin base images by digest, with the readable tag as a comment. Pin one-off binary installs to a bot-tracked version. Set `permissions:` explicitly at workflow or job level. Default to `contents: read` plus only the one write scope the job needs. Set `persist-credentials: false` on checkout unless a later step must push.
- Threat: A mutable tag can be repointed to malicious code without the workflow changing; a default read-write `GITHUB_TOKEN` and a persisted credential let any later step, including a dependency's postinstall script, modify the repository.
- Mechanism: `uses: actions/checkout@<full-sha>  # vX.Y.Z` with `persist-credentials: false` as the documented pattern, matched in practice by `anamorpher/main/.github/workflows/ci.yml`; `micro`'s sample workflows declare `permissions: {actions: read, contents: read, security-events: write}`; the devcontainer Dockerfile pins `FROM ...@sha256:...` with renovate comments driving `ARG *_VERSION`.
- Sources: `claude-code-config/main/rules/github-actions.md`, `anamorpher/main/.github/workflows/ci.yml`, `micro/main/README.md`, `micro/main/action.yml`, `claude-code-devcontainer/main/Dockerfile`, `claude-code-devcontainer/main/renovate.json`, `fickling/master/CLAUDE.md`

## Never interpolate event data into a run block, and prefer the unprivileged trigger
- Rule: Pass untrusted workflow input (`github.event.issue.title`, branch names, PR bodies) through `env:` and reference the variable rather than interpolating it into a `run:` block, and prefer `pull_request` over `pull_request_target`, which runs with secrets and a read-write token even for fork PRs.
- Threat: An attacker who controls that text injects shell commands into the runner, or reaches base-repository secrets from an attacker-modified head ref.
- Mechanism: Rule text in the path-scoped `github-actions.md`, loaded automatically when the agent touches `.github/workflows/**`.
- Sources: `claude-code-config/main/rules/github-actions.md`

## Run the security-specific workflow auditor, and write shell that cannot delete the wrong tree
- Rule: Run `zizmor .github/workflows/` in addition to `actionlint` before committing workflow changes; start every script with `set -euo pipefail`, quote every expansion, prefer `[[ ]]`, and confirm a variable is set and non-empty before using it in a path, especially ahead of a recursive delete.
- Threat: Workflow misconfigurations are a distinct vulnerability class that generic linters miss; an unset or empty variable inside `rm -rf "$dir/$sub"` deletes a much broader tree, and `set -u` alone does not catch the empty-but-set case.
- Mechanism: `zizmor` appears under the Before committing heading next to `actionlint`, and in the tools table as the GitHub Actions security auditor. `rules/bash.md` loads automatically for `*.sh` and `*.bash`.
- Sources: `claude-code-config/main/rules/github-actions.md`, `claude-code-config/main/rules/bash.md`, `claude-code-config/main/claude-md-template.md`

## When an agent runs unsandboxed in CI, constrain the runner, the token, and the output channel
- Rule: If a CI job runs an agent with approvals and sandboxing disabled, compensate deliberately: a fresh disposable runner discarded after the run, a token with no write to contents, a pinned agent CLI version, the provider secret injected only into the child process, and a single narrow output channel such as a code-scanning upload — and recognize these are different controls substituting for per-action approval, not an equivalent to it.
- Threat: An agent scanning a repository that may contain adversarial content, with its own last line of defence disabled, can write anywhere its credentials reach.
- Mechanism: `_command()` builds `codex exec ... --dangerously-bypass-approvals-and-sandbox` or `claude -p ... --dangerously-skip-permissions`, inside an `ubuntu-latest` job with `contents: read` whose only privileged step is `github/codeql-action/upload-sarif` against `/tmp/micro/RESULTS.sarif`.
- Sources: `micro/main/micro/micro.py`, `micro/main/action.yml`, `micro/main/README.md`

## Keep dependency automation flowing, gated on evidence, and put the repo's own gate in its agent instructions
- Rule: Verify the update bot covers every detected ecosystem with the correct ecosystem value, a weekly schedule, a cooldown of several days, and grouped updates; before merging any bump, build a baseline dependency tree, run build and tests, diff the resulting tree flagging downgrades and major bumps, and auto-merge only on a clean pass; and state the repository's own test and lint gate in its `AGENTS.md` so every harness picks it up.
- Threat: Missing ecosystem coverage or a flooded PR queue gets updates rubber-stamped, an unverified bump introduces a compromised transitive dependency, and a fresh release has had no community exposure.
- Mechanism: `/merge-dependabot`'s Phase 0 checks five conditions, including `cooldown.default-days: 7` and `groups` with `patterns: ["*"]`. Phases 1 to 4 gate `gh pr merge --squash --admin` on a PASS verdict. WARN or FAIL is never auto-merged. `anamorpher`'s `dependabot.yml` sets `cooldown: default-days: 7` for both groups. The whole of `hackerone-mcp`'s `agents.md` tells the agent to run `uv run pytest` and `uv run ruff check`. It must fix every failure before it treats a coding task as finished.
- Sources: `claude-code-config/main/commands/merge-dependabot.md`, `anamorpher/main/.github/dependabot.yml`, `hackerone-mcp/main/agents.md`
