# Extracting Skills from Sessions

Extracts reusable knowledge from work sessions and saves it as an agent skill.

## When to Use

- Just solved a non-obvious problem through investigation
- Discovered a workaround that required trial-and-error
- Found a debugging technique that would help in similar situations
- Learned a project-specific pattern worth preserving
- Fixed an error where the root cause wasn't immediately apparent

## When NOT to Use

- Simple documentation lookups (just bookmark the docs)
- Trivial fixes (typos, obvious errors)
- One-off project-specific configurations
- Knowledge that's already well-documented elsewhere
- Unverified solutions (wait until it actually works)

## Finding Extraction Candidates

Use these prompts to identify knowledge worth extracting:

- "What did I just learn that wasn't obvious before starting?"
- "If I faced this exact problem again, what would I wish I knew?"
- "What error message or symptom led me here, and what was the actual cause?"
- "Is this pattern specific to this project, or would it help in similar projects?"
- "What would I tell a colleague who hits this same issue?"

If you can't answer at least two of these with something non-trivial, it's probably not worth extracting.

## Extraction Process

### Step 0: Check for Existing Skills

Before creating a new skill, search for existing ones that might cover the same ground.
Look in both user-level and project-level skill directories (e.g., `~/.agents/skills/` and `.agents/skills/`).

If a related skill exists, consider **updating it** instead of creating a new one. See [skill-lifecycle.md](skill-lifecycle.md) for guidance on when to update vs create.

### Step 1: Identify the Learning

If the user provides a context hint (e.g., "extract the cyclic data DoS fix"), use it to focus the extraction on that specific topic.

Analyze the conversation to identify:
- What problem was solved?
- What made the solution non-obvious?
- What would someone need to know to solve this faster next time?
- What are the exact trigger conditions (error messages, symptoms)?

Present a brief summary to the user:
```
I identified this potential skill:

**Problem:** [Brief description]
**Key insight:** [What made it non-obvious]
**Triggers:** [Error messages or symptoms]
```

### Step 2: Quality Assessment

Evaluate the candidate skill against these criteria:

- **Reusable** - Helps future tasks, not just this instance
- **Non-trivial** - Required discovery, not docs lookup
- **Verified** - Solution actually worked
- **Specific triggers** - Exact error messages or scenarios
- **Explains WHY** - Trade-offs and judgment, not just steps
- **Value-add** - Teaches judgment, not just facts the agent could look up

Present assessment to user and ask: "Proceed with extraction? [yes/no]"
Respect their judgment - if they say yes, extract; if no, skip.

#### Example: Good Extraction Candidate

> **Problem:** `RecursionError` when traversing an AST built from
> untrusted serialized data.
>
> **Key insight:** The visitor pattern assumes acyclic trees, but
> deserialized data can contain reference cycles. Adding a `seen`
> set to the visitor is cheap and prevents infinite recursion.
>
> **Triggers:** RecursionError during tree traversal, visitor pattern
> on untrusted input, deserializing nested structures.
>
> **Assessment:** Reusable ✔, Non-trivial ✔ (root cause wasn't
> obvious from the stack trace), Verified ✔, Specific triggers ✔,
> Explains WHY ✔ (acyclic assumption). Proceed.

#### Quality Standards & Anti-Patterns

Skills should provide guidance the agent doesn't already have.

**DO:**
- Behavioral guidance - When and how to apply knowledge
- Explain WHY - Trade-offs, decision criteria, judgment calls
- Anti-patterns WITH explanations - Why something is wrong, not just that it's wrong

**DON'T:**
- Reference dumps - Don't paste entire specs or docs (agents can search)
- Step-only instructions - "Do X, then Y" without explaining when or why
- Vague guidance - "Be careful with X" without specifics

**Bad Description Triggers:** "Helps with security" or "Database tool" (Will never trigger or trigger too often)
**Good Description Triggers:** "Detects reentrancy vulnerabilities in Solidity. Use when auditing external calls."

### Step 3: Gather Details

Ask the user:
1. **Skill name** - Suggest a kebab-case name based on context, let them override
2. **Scope** - User-level or project-level

### Step 4: Optional Research

If the topic involves a specific library or framework:
- Use web search to find current best practices
- Check official documentation
- Include relevant sources in the References section

Skip research for project-specific internal patterns or generic programming concepts.

### Step 5: Generate the Skill

Use the template from [skill-template.md](skill-template.md).
Follow [format-spec.md](format-spec.md) for frontmatter and [platform-guide.md](platform-guide.md) for cross-harness compatibility.

### Step 6: Validate Before Saving

Run through the validation checklist in [skill-template.md](skill-template.md). If validation fails, fix the issues before saving.

### Step 7: Save the Skill

Create the directory and save the `SKILL.md` file in the appropriate location (user or project directory).

Report success and show the first line of the description so the user knows when it will trigger.

## Memory Consolidation

When extracting, consider how the new knowledge relates to existing skills:

**Combine or separate?**
- **Combine** if the new knowledge is a variation or edge case of an existing skill
- **Separate** if it has distinct trigger conditions or solves a fundamentally different problem
- When in doubt, start separate - you can always merge later

**Update vs create:**
- **Update** an existing skill when you've discovered additional edge cases, better solutions, or corrections
- **Create** a new skill when the knowledge has different trigger conditions, even if the domain is related

**Cross-referencing:**
- If skills are related but separate, add a "See also" section linking them

## Rationalizations to Reject

If you catch yourself thinking any of these, do NOT extract:
- "This might be useful someday" - Only extract verified, reusable knowledge
- "Let me just save everything" - Quality over quantity
- "The user didn't confirm but it seems valuable" - Always get explicit confirmation
- "I'll skip the 'When NOT to Use' section" - It's mandatory for good skills
- "The description can be vague" - Specific triggers are essential for discovery
