# AgentFS Sandbox

OS-enforced filesystem isolation via
[AgentFS](https://github.com/tursodatabase/agentfs). File writes go
to a session overlay stored in a SQLite database. Changes persist
across runs that reuse the same session ID.

## Install

Quick install (upstream one-liner):

```bash
curl -fsSL https://agentfs.ai/install | bash
```

The installer downloads a prebuilt binary from the latest GitHub
release. It works on macOS (x86_64, arm64) and Linux (x86_64,
aarch64). No Homebrew formula exists as of v0.6.4 — only the Turso
`turso` CLI ships via their Homebrew tap.

### Safer install (pinned + checksum-verified)

Piping a remote script into `bash` leaves you exposed to the
upstream host being compromised or to a MITM swapping the payload.
If that's a concern, download a pinned release and verify against
the published `sha256.sum` first. Pick your platform triple and
version:

```bash
VERSION=v0.6.4
TRIPLE=aarch64-apple-darwin   # or x86_64-apple-darwin, x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu
BASE=https://github.com/tursodatabase/agentfs/releases/download/$VERSION

curl -fsSLO "$BASE/agentfs-$TRIPLE.tar.xz"
curl -fsSLO "$BASE/sha256.sum"
grep " agentfs-$TRIPLE.tar.xz\$" sha256.sum | shasum -a 256 -c -

tar -xJf "agentfs-$TRIPLE.tar.xz"
install -m 0755 "agentfs-$TRIPLE/agentfs" ~/.local/bin/agentfs
```

Inspect `agentfs-installer.sh` before running it if you prefer the
scripted flow but want to audit what it does:

```bash
curl -fsSL https://agentfs.ai/install -o agentfs-installer.sh
less agentfs-installer.sh
sh agentfs-installer.sh
```

### Platform notes

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
