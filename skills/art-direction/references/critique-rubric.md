# Critique rubric

Ten checks compare the finished artifact against the approved brief. Evaluation criteria adapt quality and honesty principles from John Hartnup's [Poster Prompts](https://john.hartnup.uk/poster-prompts/) usage guide and the design specification. Run every check. Do not add non-blocking suggestions, and do not introduce a new direction during critique.

## The ten checks

1. Content fidelity: all required information from the brief's `Content` section is present and complete.
2. Hierarchy and legibility: the reading order is obvious, and type is readable at the intended viewing distance.
3. Concept rather than decoration: structural devices encode the brief's concept. No device is decorative without purpose.
4. Design-system consistency: palette, type roles, and the signature element match the approved brief.
5. Medium and viewing-condition fit: dimensions, aspect ratio, resolution, and format constraints from the medium adaptation hold.
6. Accessibility: contrast minimums, keyboard focus, semantic structure, reading order, and alt text pass.
7. Factual honesty: imagery does not invent unverified facts, likenesses, or architectural details.
8. Production realism: fonts, assets, and production limits are physically achievable, not assumed.
9. Generic AI defaults: the artifact has no unmotivated glossy highlights, floating glass, neon cyberpunk glows, or stock layouts.
10. Acceptance criteria compliance: every condition specified in the brief's `Acceptance criteria` section holds.

## Output contract

When one or more checks fail, emit one line per blocker. Name the artifact evidence first, then the violated brief requirement.

```markdown
# Art-direction critique

- Blocker: The 11 px timeline labels are unreadable at presentation scale. The brief requires room-readable labels.
```

When every check passes, emit exactly:

```markdown
# Art-direction critique

- Blocker: none
```

State only blockers, or the explicit pass. Do not add non-blocking suggestions. Do not propose a new direction.
