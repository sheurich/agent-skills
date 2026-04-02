# AgentFS Sandbox

OS-enforced filesystem isolation via
[AgentFS](https://github.com/tursodatabase/agentfs). File writes go
to a session overlay instead of disk. Review and apply or discard
after the task completes.

## Install

```bash
brew install tursodatabase/tap/agentfs
```

## Usage

```bash
# Run sandboxed — changes go to overlay, not disk
swival --sandbox agentfs -q "Refactor the auth module"

# Review what changed
agentfs diff swival-<hash>

# Apply or discard
agentfs apply swival-<hash>   # commit changes to disk
agentfs reset swival-<hash>   # discard all changes
```

## Session IDs

Swival auto-generates a deterministic session ID from the project
directory (`swival-<sha256-prefix>`). Re-running in the same
directory reuses the overlay.

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
4. After the session, `agentfs diff` shows changes and `agentfs apply`
   commits them.

## Combining with other security features

```bash
# Full defense in depth: OS sandbox + self-review + secret encryption
swival --sandbox agentfs --self-review --encrypt-secrets \
  -q "Rotate credentials in config/"

# Sandbox + read-only reference directory
swival --sandbox agentfs --add-dir-ro /path/to/reference \
  -q "Port the auth pattern from the reference repo"
```
