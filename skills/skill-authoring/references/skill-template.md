# Skill Template

Copy this template when generating a new skill. Ensure you follow the frontmatter requirements in [format-spec.md](format-spec.md).

```markdown
---
name: [kebab-case-name]
description: >-
  [Third-person description with specific triggers. Example: "Detects infinite
  recursion vulnerabilities in AST visitors from cyclic data structures. Use
  when: (1) RecursionError during tree traversal, (2) analyzing untrusted
  serialized data, (3) visitor pattern without cycle detection."]
---

# [Human Readable Title]

## When to Use

- [Specific scenario 1]
- [Specific scenario 2]
- [Exact error message if applicable]

## When NOT to Use

- [Scenario where this does not apply]
- [Better alternative for related but different problem]

## Problem

[Clear description of what this solves and why it is non-obvious]

## Solution

### Step 1: [Action]

[Instructions with code examples]

### Step 2: [Action]

[Continue with clear steps]

## Verification

1. [How to confirm it worked]
2. [Expected outcome]

## Evaluation artifacts

Format: [single-page HTML preferred; see format preference list below]
Path:   `/tmp/[kebab-case-name]-$(date +%Y%m%d).html`
Open:   `open /tmp/[kebab-case-name]-$(date +%Y%m%d).html`  # macOS
        `xdg-open /tmp/[kebab-case-name]-$(date +%Y%m%d).html`  # Linux

[Required when the skill produces output a human must review before acting.
Omit this section for skills with no reviewable output.

Format preference (highest to lowest):
1. Single-page HTML - tables, hyperlinks, self-contained, copy-paste ready
2. Structured Markdown with embedded images
3. Plain Markdown
4. Terminal text (last resort)

Emit the artifact before presenting findings.
Print the open command appropriate for the reviewer's OS.]

## References

- [Link to official docs if researched]
- [Web source if consulted]
```

## Validation Checklist

Before saving, verify:

- [ ] Frontmatter uses only spec-defined fields (see [format-spec.md](format-spec.md) for the complete list) unless extending with harness-specific keys.
- [ ] Name is kebab-case, max 64 characters
- [ ] Description is third-person ("Fixes X" not "I help with X")
- [ ] Description includes specific trigger conditions
- [ ] "When to Use" section is present and specific
- [ ] "When NOT to Use" section is present
- [ ] Solution has concrete steps
- [ ] No hardcoded user paths (`/Users/...`, `/home/...`)
- [ ] Under 500 lines total
- [ ] Evaluation artifacts section present if the skill produces reviewable output
