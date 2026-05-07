---
name: skill-authoring
description: Write and refine agent skills. Use when generating skills from docs, extracting from sessions, designing tool interfaces, managing lifecycle, or writing for dual-harness patterns.
---

# Skill Authoring

TDD for agent instructions. Test, write, shorten.

## What Are You Doing?

Use the right reference file for your task:

- [extracting-from-sessions.md](references/extracting-from-sessions.md) — Saving knowledge from a work session into a new skill.
- [generating-from-docs.md](references/generating-from-docs.md) — Creating a new skill by crawling documentation websites.
- [skill-lifecycle.md](references/skill-lifecycle.md) — Updating, deprecating, or archiving an existing skill.
- [tool-design.md](references/tool-design.md) — Designing tool interfaces and APIs for agents.
- [skill-template.md](references/skill-template.md) — Copy-paste template for new skills.
- [format-spec.md](references/format-spec.md) — Frontmatter fields, directory patterns, naming rules, external tool conventions, and content organization.
- [platform-guide.md](references/platform-guide.md) — What each agent platform discovers, loads, and ignores, plus dual-harness compatibility patterns.

*Note: Skill reference files must be resilient to context compaction. If an agent summarizes this routing table, ensure the distinct purpose of each file remains clear.*

## Decide Whether to Create

Create a skill when:

- The technique isn't obvious to agents
- The pattern applies across projects
- You'd reference it again in future sessions

Don't create skills for one-off solutions, standard practices, or
constraints enforceable with automation.

## Does This Skill Reduce Review Time?

The evaluator is the bottleneck, not the agent. A skill that increases agent throughput without collapsing a review step makes the backlog worse.

Every proposed skill and every major edit must answer three questions in the SKILL.md or PR description: (1) Which review step does this skill eliminate or shorten? Name the concrete human action — reading a log, cross-referencing a spec, verifying a checklist — that this skill absorbs. (2) What evidence supports the claim? A before/after measurement, a session transcript, or a worked example showing the evaluator doing less. (3) What does the human stop doing? If the answer is "nothing" or "they still review the same artifacts," the skill fails this gate.

Some patterns reliably fail. Orchestration for its own sake — skills whose value proposition is "coordinates other agents" without identifying which review artifact disappears. Parallelism without a serialization bottleneck downstream — splitting work across agents when the human still reviews each output individually, meaning wall-clock savings accrue to the agent while review cost stays constant or increases. "Agent swarm" framings that treat agent utilization as the metric instead of evaluator time freed. Meta-skills that exist only as routing layers for other skills, adding indirection without absorbing any review surface.

A skill that genuinely passes this filter will have an obvious answer to question one. If you struggle to articulate which human action shrinks, the skill is optimizing the wrong side of the pipeline.

## What to Include

Only instructions that change agent behavior in ways the codebase
can't convey on its own.

| Keep | Cut |
|------|-----|
| Specific tooling (`use uv`, `run shellcheck`) | Motivational framing |
| Concrete constraints (paths, commands) | Rationalization tables |
| Checklists and decision tables | Narrative examples |
| Error messages and stop conditions | Mandatory gates |
| Cross-references to other skills | Overviews and directory listings |

## Write the Description

The description is the activation trigger. Include WHAT and WHEN.
Describe triggering conditions only — not the skill's workflow.

```yaml
# Good — triggering conditions
description: >-
  Create git commits with intelligent file grouping.
  Use when committing changes.

# Bad — summarizes workflow (agents follow this instead of reading the skill)
description: >-
  Use when committing - groups files by concern, writes
  conventional messages, runs pre-commit hooks
```

## Size Budget

Context window is shared. Every paragraph must justify its cost.

| Scope | Target |
|-------|--------|
| Frequently-loaded skills | <200 lines |
| Standard skills | <500 lines |
| Reference material | `references/` directory |

Prefer `--help` over documenting flags. Cross-reference other skills
instead of repeating content. One good example beats many mediocre ones.

## Structure for Progressive Disclosure

```text
skills/skill-name/
├── SKILL.md         # Core instructions (loaded on activation)
├── references/      # Heavy content (loaded on demand)
├── scripts/         # Deterministic operations (executed, not read)
└── assets/          # Templates, images (used in output, never loaded)
```

At startup, agents see only name + description (~100 tokens).
On activation, SKILL.md loads. References and scripts load only
when the agent needs them during execution.

### When to split to `references/`

Split by content type, not just length:

| Content type | Where | Example |
|--------------|-------|---------|
| Workflow and decisions | SKILL.md | "If drift detected, choose…" |
| Lookup tables | `references/` | Backend config per cloud provider |
| Platform-specific details | `references/` | Installation commands per agent |
| API specs or field lists | `references/` | Frontmatter field reference |

**Heuristic:** If the skill covers 3+ independent subtopics and an
agent only needs one at a time, each belongs in a reference file.
SKILL.md routes to the right one.

Don't wait until you hit 500 lines. A 200-line SKILL.md with three
unrelated lookup tables is already a candidate for splitting.

## TDD Cycle

### RED — Baseline

Run a pressure scenario without the skill. Record what the agent
did and where it went wrong.

### GREEN — Write Minimal Skill

Address the specific failures from RED. Don't add content for
hypothetical cases. Re-run — the agent should now comply.

### REFACTOR — Shorten

If the agent still fails, the instruction isn't clear enough —
rewrite it shorter, not longer. A clear 3-line instruction
outperforms a 30-line version. Cut until compliance breaks,
then restore the last cut.

## Match Specificity to Risk

| Freedom | When | Format |
|---------|------|--------|
| High | Multiple valid approaches | Prose |
| Medium | Preferred pattern, variation OK | Pseudocode |
| Low | Fragile ops, must be consistent | Scripts |

## Anti-Patterns

- Workflow summaries in descriptions (agents follow the summary
  instead of reading the full skill)
- "When to use" in body instead of description
- Rationalization scaffolding and authority appeals
- Mandatory gates (`<HARD-GATE>`, "MUST use before ANY...")
- README.md in plugin root (not loaded into agent context)
- Nesting skills under `skills/<plugin>/<skill>/` (not discovered)

## Reference

- See the **What Are You Doing?** section above for all reference files.
