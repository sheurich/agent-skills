---
name: semgrep-scan
description: >-
  Scan changed files with Semgrep for security and correctness issues.
  Use when verifying code before committing, reviewing implementation
  security, or running pre-commit quality gates.
compatibility: Requires uvx (uv) for running semgrep.
---

# Semgrep Scan

Security and correctness gate on changed files.

## When to Use

- Before committing implementation work
- As part of verification-before-completion
- After refactoring security-sensitive code

## When NOT to Use

- Writing or testing custom Semgrep rules (use the `semgrep_scan_with_custom_rule` MCP tool)
- Full-repo baseline scans (`uvx semgrep scan --config auto .` directly)
- Dependency / supply chain scanning (use the `semgrep_scan_supply_chain` MCP tool)

## Process

### 1. Identify targets

```bash
git diff --name-only HEAD --diff-filter=ACMR
```

Initial commit (no HEAD): `git diff --cached --name-only --diff-filter=ACMR`

Stop if no changed files.

### 2. Scan

```bash
uvx semgrep scan --config auto --json --quiet <files...>
```

If `.semgrep/rules/` or `.semgrep.yml` exists at the repo root, add
`--config .semgrep/` to include project-specific rules.

### 3. Interpret findings

Parse `results[]` from the JSON output.

| Field | Location |
|-------|----------|
| Rule ID | `results[].check_id` |
| Severity | `results[].extra.severity` |
| Message | `results[].extra.message` |
| File + line | `results[].path`, `results[].start.line` |
| Fix suggestion | `results[].extra.fix` (when present) |
| CWE | `results[].extra.metadata.cwe` |

### 4. Act on findings

| Severity | Action |
|----------|--------|
| ERROR | Fix before committing — these are real vulnerabilities |
| WARNING | Review and fix, or suppress with `# nosemgrep: <rule-id>` if false positive |
| INFO | Note for awareness — do not block commit |

### 5. Confirm

Re-scan after fixes until clean. Report finding count or
"Semgrep scan clean — no findings on N files."
