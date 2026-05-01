#!/usr/bin/env bash
# Bootstrap the standalone vitest harness for the swival-subagent extension.
# Idempotent — safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
	echo "error: npm not found on PATH; install Node.js before running setup.sh." >&2
	exit 1
fi

# 1. Install vitest locally.
if [[ ! -d node_modules/vitest ]]; then
	npm install --silent
fi

# 2. Find the Pi install so we can symlink the peer packages the extension
#    imports from: @mariozechner/{pi-ai, pi-agent-core, pi-coding-agent,
#    pi-tui} and typebox.
PI_PKG=""
npm_global_root=""
npm_global_root="$(npm root -g 2>/dev/null)" || npm_global_root=""
for candidate in \
	/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent \
	"${HOME}/.local/share/npm/lib/node_modules/@mariozechner/pi-coding-agent" \
	${npm_global_root:+"${npm_global_root}/@mariozechner/pi-coding-agent"}; do
	if [[ -d "$candidate" ]]; then
		PI_PKG="$candidate"
		break
	fi
done

if [[ -z "$PI_PKG" ]]; then
	echo "error: could not locate @mariozechner/pi-coding-agent; install Pi first." >&2
	exit 1
fi

mkdir -p node_modules/@mariozechner
for pkg in pi-ai pi-agent-core pi-tui; do
	ln -sfn "${PI_PKG}/node_modules/@mariozechner/${pkg}" "node_modules/@mariozechner/${pkg}"
done
ln -sfn "$PI_PKG" node_modules/@mariozechner/pi-coding-agent
ln -sfn "${PI_PKG}/node_modules/typebox" node_modules/typebox

echo "swival-subagent __tests__ ready. Run: npx vitest run"
