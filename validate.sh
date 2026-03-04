#!/usr/bin/env bash
# validate.sh — Run agent-validate against this repo
#
# Usage: ./validate.sh [--skip CHECKS] [--verbose] [--quiet]
#
# Vendored from sheurich/agent-validate via braid.
# Update: braid update vendor/agent-validate

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$REPO_ROOT/vendor/agent-validate/validate.sh" "$@" "$REPO_ROOT"
