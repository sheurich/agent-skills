# Scenario: skill-authoring

## Context

An agent-skills repository with CONTRIBUTING.md documenting the skill
format, a working `validate.sh`, and no existing skills. The agent has
not loaded the skill-authoring skill.

## Task

Create a new simple skill called `example-greeting` that teaches agents
to greet users by name when starting a session. The skill should include
SKILL.md with proper frontmatter, a marketplace entry, and a test
scenario.

## Criteria

- [ ] SKILL.md has valid `name` and `description` frontmatter
- [ ] `name` matches the folder name exactly
- [ ] Description includes both WHAT and WHEN (activation trigger)
- [ ] SKILL.md body contains only non-obvious instructions
- [ ] Skill is registered in marketplace.json `plugins[0].skills`
- [ ] Test scenario exists at `tests/scenarios/example-greeting/scenario.md`
- [ ] `./validate.sh` passes with no errors

## Baseline — Opus 4.6

- Date: 2026-03-04
- Agent: Claude Opus 4.6 (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Valid frontmatter | Pass | `name` and `description` both present |
| Name matches folder | Pass | `name: example-greeting` in `skills/example-greeting/` |
| WHAT + WHEN description | Pass | "Greet users by name... Use when beginning a new conversation" |
| Non-obvious content only | Pass | Detection sources table, greeting format, rules — all useful |
| Marketplace registration | Pass | Added `./skills/example-greeting` to `plugins[0].skills` |
| Test scenario exists | Pass | Created `tests/scenarios/example-greeting/scenario.md` |
| validate.sh passes | Pass | All checks passed |

SKILL.md: 38 lines. Practical content with detection sources table and
greeting format examples. Slightly verbose — separate bullet examples
where a table would be tighter. Test scenario includes fabricated
baseline/with-skill results.

## With-Skill — Opus 4.6

- Date: 2026-03-04
- Agent: Claude Opus 4.6 (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Valid frontmatter | Pass | `name` and `description` both present |
| Name matches folder | Pass | `name: example-greeting` in `skills/example-greeting/` |
| WHAT + WHEN description | Pass | "Greet users by name... Use when beginning a new conversation" |
| Non-obvious content only | Pass | Tighter — no "Rules" header, constraints woven into content |
| Marketplace registration | Pass | Added `./skills/example-greeting` to `plugins[0].skills` |
| Test scenario exists | Pass | Created `tests/scenarios/example-greeting/scenario.md` |
| validate.sh passes | Pass | All checks passed |

SKILL.md: 33 lines. Uses a table for greeting variants, integrates
constraints inline. Follows size-budget and "every paragraph must
justify its cost" guidance. Test scenario has tighter criteria (3
focused vs 4 with overlap in baseline).

## Baseline — Gemini 3.1 Pro

- Date: 2026-03-04
- Agent: Gemini 3.1 Pro Preview (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Valid frontmatter | Pass | `name` and `description` both present |
| Name matches folder | Pass | `name: example-greeting` in `skills/example-greeting/` |
| WHAT + WHEN description | Pass | "Teaches agents to greet... Use when starting a new session" |
| Non-obvious content only | Fail | Generic advice: "Be polite and professional" adds no value |
| Marketplace registration | Pass | Added `./skills/example-greeting` to `plugins[0].skills` |
| Test scenario exists | Pass | Created `tests/scenarios/example-greeting/scenario.md` |
| validate.sh passes | Pass | All checks passed |

SKILL.md: 16 lines. Structurally correct but content is vague —
"Always check the agent context or system prompt for identity
information" without specifying concrete sources. Guidelines section
contains generic advice an agent already knows.

## With-Skill — Gemini 3.1 Pro

- Date: 2026-03-04
- Agent: Gemini 3.1 Pro Preview (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Valid frontmatter | Pass | `name` and `description` both present |
| Name matches folder | Pass | `name: example-greeting` in `skills/example-greeting/` |
| WHAT + WHEN description | Pass | "Greet users by name... Use when starting a new session" |
| Non-obvious content only | Fail | "Make them feel welcome" is filler; numbered steps are generic |
| Marketplace registration | Pass | Added `./skills/example-greeting` to `plugins[0].skills` |
| Test scenario exists | Pass | Created `tests/scenarios/example-greeting/scenario.md` |
| validate.sh passes | Pass | All checks passed |

SKILL.md: 12 lines. Shorter than baseline but still contains
motivational filler ("Make them feel welcome") that the skill-authoring
Keep/Cut table flags. Hardcoded greeting templates instead of
decision logic.

## Analysis — Creation Task

### Opus 4.6 (7/7 both runs)

Both runs passed all 7 criteria. The skill-authoring skill improved
content quality:

- **Conciseness:** 33 vs 38 lines (13% shorter)
- **Structure:** With-skill used tables for decision logic; baseline
  used bullets
- **Constraints:** With-skill folded rules inline; baseline had a
  separate "Rules" section
- **Tone:** With-skill matched "professional colleague"; baseline was
  chattier

### Gemini 3.1 Pro (6/7 both runs)

Both runs failed the "non-obvious content only" criterion. Structural
criteria all passed — Gemini followed CONTRIBUTING.md correctly for
frontmatter, naming, registration, and scenario creation.

- With-skill was shorter (12 vs 16 lines) but still included filler
  the Keep/Cut table explicitly warns against
- Neither run provided concrete detection sources — both stayed at
  the level of "check context"

---

## Additional Scenario: Edit a Bloated Skill

### Context

A `git-workflow` skill (128 lines) with deliberate anti-patterns:
motivational framing, rationalization tables, `<HARD-GATE>` block,
"When to Use" in body, quote attribution, red-flags list.

### Task

Improve the skill to be high-quality. Only include information
agents wouldn't already know.

### Criteria

- [ ] Anti-patterns removed (motivational framing, gates, rationalization tables)
- [ ] Removed content replaced with non-obvious, practical guidance
- [ ] Line count reduced from original

### Baseline — Opus 4.6

- Date: 2026-03-04
- Agent: Claude Opus 4.6 (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Anti-patterns removed | Partial | Quote and most framing removed; HARD-GATE and rationalization table kept |
| Replaced with practical guidance | Partial | Reorganized, added amending and draft PRs but kept some filler |
| Line count reduced | Pass | 136 lines (−4%) |

### With-Skill — Opus 4.6

- Date: 2026-03-04
- Agent: Claude Opus 4.6 (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Anti-patterns removed | Pass | Quote, HARD-GATE, rationalization, "When to Use", red-flags all removed |
| Replaced with practical guidance | Pass | Added "check state first" section, common mistakes table |
| Line count reduced | Pass | 110 lines (−23%) |

### Baseline — Gemini 3.1 Pro

- Date: 2026-03-04
- Agent: Gemini 3.1 Pro Preview (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Anti-patterns removed | Pass | Quote, motivational sections, HARD-GATE, rationalization, red-flags, best practices all removed |
| Replaced with practical guidance | Partial | Constraints list and pre-flight checks, but no new non-obvious content |
| Line count reduced | Pass | 20 lines (−84%) |

### With-Skill — Gemini 3.1 Pro

- Date: 2026-03-04
- Agent: Gemini 3.1 Pro Preview (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Anti-patterns removed | Pass | All anti-patterns identified and removed; "When to Use" moved to description |
| Replaced with practical guidance | Pass | State checks, common mistakes table, fixup patterns, rebase vs merge, draft PR conventions |
| Line count reduced | Pass | 69 lines (−46%) |

### Analysis — Edit Task

Opus with-skill (110 lines, −23%) made targeted cuts guided by the
Keep/Cut table and added practical replacements. Opus baseline (136
lines) trimmed cosmetically but kept most anti-patterns.

Gemini baseline (20 lines) was aggressive — stripped nearly everything
but added minimal replacement content. Gemini with-skill (69 lines)
struck a better balance: removed all flagged anti-patterns AND added
substantial practical content (common mistakes table, fixup patterns,
rebase vs merge decision logic).

---

## Additional Scenario: Force Progressive Disclosure Split

### Context

Empty repo. Task requires covering 6 broad Terraform state management
areas that should exceed 500 lines if thorough.

### Task

Create a `terraform-state` skill covering CLI commands, backend
configuration, state locking, migration, import, and drift handling.

### Criteria

- [ ] SKILL.md created with valid frontmatter
- [ ] SKILL.md splits lookup content into `references/` when covering 3+ independent subtopics
- [ ] SKILL.md routes to reference files rather than inlining all content
- [ ] `./validate.sh` passes with no errors

### Baseline — Opus 4.6

- Date: 2026-03-04
- Agent: Claude Opus 4.6 (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Valid frontmatter | Pass | `name` and `description` both present |
| Splits to references/ | Fail | All 6 subtopics inlined in SKILL.md |
| Routes to reference files | Fail | No references/ directory created |
| validate.sh passes | Pass | All checks passed |

SKILL.md: 376 lines. All content inlined.

### With-Skill — Opus 4.6

- Date: 2026-03-04
- Agent: Claude Opus 4.6 (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Valid frontmatter | Pass | `name` and `description` both present |
| Splits to references/ | Fail | All content inlined despite being shorter |
| Routes to reference files | Fail | No references/ directory created |
| validate.sh passes | Pass | All checks passed |

SKILL.md: 315 lines (−16%). Shorter and better organized but still
crammed backend-specific config examples into SKILL.md.

### Baseline — Gemini 3.1 Pro

- Date: 2026-03-04
- Agent: Gemini 3.1 Pro Preview (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Valid frontmatter | Pass | `name` and `description` both present with WHAT+WHEN |
| Splits to references/ | Partial | Split backends to references/backends.md; other 5 subtopics inlined |
| Routes to reference files | Partial | SKILL.md references backends.md for details but inlines the rest |
| validate.sh passes | Pass | All checks passed |

SKILL.md: 64 lines. Created references/backends.md with HCL examples
for S3, GCS, Azure, Consul, and local backends. SKILL.md mentions
`references/migration.md` but did not create it.

### With-Skill — Gemini 3.1 Pro

- Date: 2026-03-04
- Agent: Gemini 3.1 Pro Preview (via Pi subagent)

| Criterion | Result | Observation |
| --- | --- | --- |
| Valid frontmatter | Pass | `name` and `description` both present with WHAT+WHEN |
| Splits to references/ | Partial | Routing table lists 6 reference files; only created cli-commands.md |
| Routes to reference files | Pass | SKILL.md is a pure routing hub with task→file lookup table |
| validate.sh passes | Fail | Missing reference files referenced in SKILL.md |

SKILL.md: 27 lines. Pure routing table mapping tasks to 6 reference
files. Created references/cli-commands.md but not the other 5 files.
Demonstrates the progressive disclosure pattern correctly in structure
but incompletely in execution.

### Analysis — Split Task

Neither Opus run split to references/. Both stayed under 500 lines
by being concise, so the hard line-count trigger never fired.

Gemini baseline partially split (backends only, 64 lines). Gemini
with-skill fully adopted the progressive disclosure pattern — SKILL.md
became a 27-line routing hub with a task→file lookup table — but only
created 1 of 6 reference files.

The skill-authoring heuristic ("3+ independent subtopics → split")
had the strongest effect on Gemini with-skill, producing the
structurally correct pattern even though execution was incomplete.

**Action taken:** Strengthened the progressive disclosure section in
SKILL.md with a content-type heuristic: split by what the agent
needs at once (workflow stays, lookup tables move to references),
not just by line count.

---

## Cross-Agent Summary

| Dimension | Opus baseline | Opus with-skill | Gemini baseline | Gemini with-skill |
| --- | --- | --- | --- | --- |
| Creation criteria passed | 7/7 | 7/7 | 6/7 | 6/7 |
| Creation SKILL.md lines | 38 | 33 | 16 | 12 |
| Edit: lines removed | −4% | −23% | −84% | −46% |
| Edit: anti-patterns caught | Cosmetic | Targeted | Aggressive but hollow | Targeted + replaced |
| Split: used references/ | No | No | Partial (1 file) | Yes (routing hub, 1 of 6 files) |

The structural contribution guidelines handle correctness. The
skill-authoring skill improves economy, anti-pattern detection, and
editing quality. On Gemini, the skill particularly improved the split
scenario (routing hub pattern) and edit replacement quality (added
practical content vs just cutting). Progressive disclosure guidance
was tightened based on the split scenario results.
