# AgentFS Sandbox

OS-enforced filesystem isolation via
[AgentFS](https://github.com/tursodatabase/agentfs). File writes go
to a session overlay stored in a SQLite database. Changes persist
across runs that reuse the same session ID.

## Install

```bash
curl -fsSL https://agentfs.ai/install | bash
```

The installer downloads a prebuilt binary from the latest GitHub
release. It works on macOS (x86_64, arm64) and Linux (x86_64,
aarch64). No Homebrew formula exists as of v0.6.4 — only the Turso
`turso` CLI ships via their Homebrew tap.

On Linux the `agentfs run` overlay requires FUSE and user
namespaces. macOS uses NFS + Apple Sandbox with no additional
dependencies.

## Usage

```bash
# Run sandboxed — writes go to an overlay database, not to disk
swival --sandbox agentfs -q "Refactor the auth module"

# Inspect overlay changes
agentfs diff <session-id>
```

There is no `agentfs apply` or `agentfs reset` command. The overlay
lives in `.agentfs/<session-id>.db`:

- **Keep changes for next run:** reuse the same session ID.
- **Discard changes:** delete `.agentfs/<session-id>.db`, or start
  a new session with a different ID.
- **Pull files out:** use `agentfs fs <session-id> cat <path>` or
  mount with `agentfs mount <session-id> <mount-point>` and copy.

The overlay does not automatically merge back into the real
filesystem.

## Session IDs

Swival auto-generates a deterministic session ID from the project
directory. Re-running in the same directory reuses the overlay.

Override with `--sandbox-session <id>` to name sessions explicitly
or run multiple independent sessions in the same project.

Disable auto-session with `--no-sandbox-auto-session` to get a
fresh overlay every time.

## Strict read isolation

`--sandbox-strict-read` restricts reads to the allowed directories
as well. Requires a version of AgentFS with strict read support
(not yet released as of v0.6.x).

## How it works

1. Swival detects `--sandbox agentfs` and locates the `agentfs` binary.
2. It re-execs itself via `agentfs run --allow <base-dir> -- swival ...`.
3. AgentFS interposes filesystem calls at the OS level. Writes go to
   the overlay; reads see the overlay merged with the real filesystem.
4. After the session, `agentfs diff` shows changes against the base.

## Combining with other security features

```bash
# OS sandbox + self-review + secret encryption
swival --sandbox agentfs --self-review --encrypt-secrets \
  -q "Rotate credentials in config/"

# Sandbox + read-only reference directory
swival --sandbox agentfs --add-dir-ro /path/to/reference \
  -q "Port the auth pattern from the reference repo"
```
