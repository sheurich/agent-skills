# Skill Lifecycle

Skills evolve over time. This guide covers updating, deprecating, and archiving skills.

## Updating Existing Skills

### When to Update

Update an existing skill when:
- You've discovered additional edge cases or exceptions
- A better solution exists than what's documented
- The original solution had errors or gaps
- New versions of tools or libraries change the approach
- You've found clearer ways to explain the concept

### How to Update

1. **Add, don't replace** (unless the original was wrong)
   - Add new edge cases to a "Variations" or "Edge Cases" section
   - Keep the original solution if it still works for the common case

2. **Add a changelog** at the bottom for significant updates
   ```markdown
   ## Changelog
   - 2025-01-15: Added workaround for v2.0 API changes
   - 2024-06-01: Initial extraction
   ```

3. **Update triggers** in the description if new symptoms were discovered

### What NOT to Do When Updating

- Don't remove working solutions just because you found a "better" one - document both
- Don't change the skill name unless the scope has fundamentally changed
- Don't update based on a single new case - wait for a pattern

## Deprecating Skills

### When to Deprecate

Deprecate a skill when:
- The underlying tool, library, or API has changed significantly
- The problem the skill solved no longer exists (e.g., a bug was fixed upstream)
- A better skill now covers the same ground
- The approach is now considered bad practice

### How to Deprecate

1. **Add a deprecation notice** at the top of the skill:
   ```markdown
   > **DEPRECATED (2025-01-15):** This skill applies to v1.x only.
   > For v2.x, see [new-skill-name](path/to/new-skill).
   ```

2. **Update the description** to include "DEPRECATED":
   ```yaml
   description: |
     DEPRECATED - See new-skill-name instead. [Original description...]
   ```

3. **Keep the skill** for users who might still be on older versions
   - Don't delete immediately
   - Move to deprecation after 6+ months if the old version is truly dead

### Deprecation vs Deletion

- **Deprecate** when some users might still need it
- **Delete** only when the skill is actively harmful or completely irrelevant

## Archiving Skills

### When to Archive

Archive a skill when:
- It's been deprecated for 6+ months with no usage
- The technology it covers is completely obsolete
- It was project-specific and the project is dead

### How to Archive

1. **Move** to an `archived/` directory or simply remove it from the active skills directory.
2. **Document why** in a brief note if keeping:
   ```markdown
   > Archived 2025-01-15: Python 2 is EOL, this is no longer relevant.
   ```

## Review Cadence

Review existing skills when:

- A major version of the underlying tool or library ships
- A skill triggers but doesn't help (the agent loads it and ignores it)
- 6–12 months have passed since the last review

## Lifecycle Summary

| Stage | Trigger | Action |
|-------|---------|--------|
| **Create** | New non-obvious knowledge | Extract from session or docs |
| **Update** | Edge cases, improvements, corrections | Edit existing SKILL.md |
| **Deprecate** | Tool changed, better approach exists | Add deprecation notice |
| **Archive** | Long-deprecated, obsolete | Move or delete |
