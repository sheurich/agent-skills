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

for package_dir in packages/*/; do
  [[ -d "$package_dir" ]] || continue
  package_name=$(basename "$package_dir")
  [[ "$package_name" == ".gitkeep" ]] && continue
  if [[ ! -f "tests/scenarios/${package_name}/scenario.md" ]]; then
    echo "Error: package '$package_name' has no test scenario (expected tests/scenarios/${package_name}/scenario.md)" >&2
    errors=$((errors + 1))
  fi
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

  # Plugin entry check: every plugins/ directory has a marketplace entry,
  # unless the plugin is Pi-only (declares `pi.extensions` in its
  # package.json). Pi extensions use a different discovery mechanism and
  # cannot be loaded by Claude Code.
  echo "Checking marketplace.json plugin entries"
  for plugin_dir in plugins/*/; do
    [[ -d "$plugin_dir" ]] || continue
    plugin_name=$(basename "$plugin_dir")
    [[ "$plugin_name" == ".gitkeep" ]] && continue

    # Skip Pi extensions — they declare themselves via the "pi.extensions"
    # field in package.json and are not installable by Claude Code.
    if [[ -f "${plugin_dir}package.json" ]] && \
       command -v jq >/dev/null 2>&1 && \
       jq -e '.pi.extensions' "${plugin_dir}package.json" >/dev/null 2>&1; then
      continue
    fi

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

# --- Vendored agent-validate VERSION file must exist ---

version_file="vendor/agent-validate/VERSION"

if [[ -f "$version_file" ]]; then
  echo "Checking agent-validate VERSION file"
  if ! grep -q '^version:' "$version_file"; then
    echo "Error: vendor/agent-validate/VERSION missing 'version:' field" >&2
    errors=$((errors + 1))
  fi
  if ! grep -q '^sha:' "$version_file"; then
    echo "Error: vendor/agent-validate/VERSION missing 'sha:' field" >&2
    errors=$((errors + 1))
  fi
else
  echo "Error: vendor/agent-validate/VERSION not found" >&2
  errors=$((errors + 1))
fi

# --- Review criteria and contribution guidelines must stay in sync ---
#
# .github/copilot-instructions.md and CONTRIBUTING.md cover overlapping
# rules for different audiences (automated reviewer vs contributors).
# When one changes, the other likely needs updating too. This check
# only runs in CI where the merge base is available.

if [[ -n "${GITHUB_BASE_REF:-}" ]] && command -v git >/dev/null 2>&1; then
  echo "Checking review criteria / contribution guide sync"
  changed=$(git diff --name-only "origin/${GITHUB_BASE_REF}"...HEAD 2>/dev/null || true)
  copilot_changed=false
  contributing_changed=false
  echo "$changed" | grep -q '^\.github/copilot-instructions\.md$' && copilot_changed=true
  echo "$changed" | grep -q '^CONTRIBUTING\.md$' && contributing_changed=true

  if [[ "$copilot_changed" == true ]] && [[ "$contributing_changed" == false ]]; then
    echo "Warning: .github/copilot-instructions.md changed but CONTRIBUTING.md did not" >&2
    echo "  These files share overlapping rules. Verify CONTRIBUTING.md is still accurate." >&2
  fi
  if [[ "$contributing_changed" == true ]] && [[ "$copilot_changed" == false ]]; then
    echo "Warning: CONTRIBUTING.md changed but .github/copilot-instructions.md did not" >&2
    echo "  These files share overlapping rules. Verify copilot-instructions.md is still accurate." >&2
  fi
fi

if [[ $errors -gt 0 ]]; then
  echo "Error: $errors repo-specific check(s) failed" >&2
  exit 1
fi

echo "All repo-specific checks passed"
