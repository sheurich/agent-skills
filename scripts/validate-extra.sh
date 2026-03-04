#!/usr/bin/env bash
# validate-extra.sh — Repo-specific validation
#
# Called automatically by agent-validate via the extra hook.

set -euo pipefail

errors=0

# --- Every skill needs a test scenario ---

echo "Checking test coverage"
for skill_dir in skills/*/; do
  [[ -d "$skill_dir" ]] || continue
  skill_name=$(basename "$skill_dir")
  [[ "$skill_name" == ".gitkeep" ]] && continue
  if [[ ! -f "tests/scenarios/${skill_name}/scenario.md" ]]; then
    echo "Error: skill '$skill_name' has no test scenario (expected tests/scenarios/${skill_name}/scenario.md)" >&2
    errors=$((errors + 1))
  fi
done

for plugin_dir in plugins/*/; do
  [[ -d "$plugin_dir" ]] || continue
  plugin_name=$(basename "$plugin_dir")
  [[ "$plugin_name" == ".gitkeep" ]] && continue
  # Check each skill inside the plugin
  for skill_dir in "$plugin_dir"/skills/*/; do
    [[ -d "$skill_dir" ]] || continue
    skill_name=$(basename "$skill_dir")
    if [[ ! -f "tests/scenarios/${skill_name}/scenario.md" ]]; then
      echo "Error: plugin skill '$skill_name' has no test scenario (expected tests/scenarios/${skill_name}/scenario.md)" >&2
      errors=$((errors + 1))
    fi
  done
done

# --- marketplace.json checks (require jq) ---

marketplace=".claude-plugin/marketplace.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "Warning: jq not found, skipping marketplace.json checks" >&2
elif [[ -f "$marketplace" ]]; then

  echo "Checking marketplace.json skills list"

  # Collect all simple skill paths that should be listed
  expected=()
  for skill_dir in skills/*/; do
    [[ -d "$skill_dir" ]] || continue
    name=$(basename "$skill_dir")
    [[ "$name" == ".gitkeep" ]] && continue
    [[ -f "$skill_dir/SKILL.md" ]] && expected+=("./skills/$name")
  done

  # Forward check: every skills/ directory listed in plugins[0].skills
  for path in "${expected[@]}"; do
    if ! jq -e --arg p "$path" '.plugins[0].skills | index($p) != null' "$marketplace" >/dev/null 2>&1; then
      echo "Error: '$path' missing from marketplace.json plugins[0].skills" >&2
      errors=$((errors + 1))
    fi
  done

  # Reverse check: every entry in plugins[0].skills points to an existing directory
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    if [[ ! -d "$path" ]]; then
      echo "Error: marketplace.json plugins[0].skills lists '$path' but directory does not exist" >&2
      errors=$((errors + 1))
    fi
  done < <(jq -r '.plugins[0].skills // [] | .[]' "$marketplace" 2>/dev/null)

  # Plugin entry check: every plugins/ directory has a marketplace entry
  echo "Checking marketplace.json plugin entries"
  for plugin_dir in plugins/*/; do
    [[ -d "$plugin_dir" ]] || continue
    plugin_name=$(basename "$plugin_dir")
    [[ "$plugin_name" == ".gitkeep" ]] && continue
    plugin_source="./plugins/$plugin_name"
    if ! jq -e --arg s "$plugin_source" '[.plugins[] | .source] | index($s) != null' "$marketplace" >/dev/null 2>&1; then
      echo "Error: plugin '$plugin_name' has no entry in marketplace.json (expected source: '$plugin_source')" >&2
      errors=$((errors + 1))
    fi
  done

  # Reverse plugin check: every non-root plugin entry points to an existing directory
  while IFS= read -r source; do
    [[ -z "$source" || "$source" == "./" || "$source" == "./skills" ]] && continue
    if [[ ! -d "$source" ]]; then
      echo "Error: marketplace.json plugin source '$source' does not exist" >&2
      errors=$((errors + 1))
    fi
  done < <(jq -r '.plugins[] | .source' "$marketplace" 2>/dev/null)

fi

if [[ $errors -gt 0 ]]; then
  echo "Error: $errors repo-specific check(s) failed" >&2
  exit 1
fi

echo "All repo-specific checks passed"
