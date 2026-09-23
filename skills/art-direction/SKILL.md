---
name: art-direction
description: >-
  Develops and adapts visual direction across media. Use when choosing or
  comparing visual styles, translating a design movement into reusable rules,
  or preparing a visual brief for web pages, slides, documents, diagrams,
  social graphics, or generated images before production.
---

# Art Direction

Converts a content brief into two or three visual directions, records the
selected direction as a medium-neutral system, adapts it to the target
medium, and routes production to an existing skill. This skill owns design
reasoning and acceptance criteria. It does not produce the final artifact.

## Workflow

1. Establish the brief.
2. Generate 2-3 directions.
3. Present the directions as a self-contained HTML comparison.
4. Wait for the user to select a direction.
5. Adapt the selected direction to the target medium.
6. Export the approved brief as Markdown.
7. Route production to the matching skill.
8. Critique the produced artifact against the brief.

## Step 1: Establish the brief

If the user supplied a complete art-direction brief, validate it against the
brief structure below and adapt it. Do not restart discovery.

Otherwise gather these facts before generating options:

- Subject: what the artifact represents.
- Audience: who reads or views it, and what they already expect.
- Purpose: the task the artifact must perform.
- Desired response: how the audience should feel or act.
- Medium: web page, HTML artifact, slide deck, document, diagram, social
  graphic, or generated image.
- Content hierarchy: what information matters most.
- Constraints: brand colors, fonts, existing identity, accessibility needs,
  or production limits.
- Existing identity: any visual system the artifact must fit or depart from.

Ask one question at a time, and only when the answer would change the
direction. Do not ask about details the medium adapter will confirm later.

## Step 2: Generate 2-3 directions

- Give each direction a different design logic, not a different palette on
  the same layout.
- Ground each direction in the subject's real materials, language, and
  audience. Reject generic branding adjectives.
- Give each direction one signature element that carries the concept.
- Load `references/style-families.md` to choose or translate a style family.
- A direction may combine at most two families. State what each family
  contributes.

## Step 3: Present the directions

Present the options as a single self-contained HTML page:

- Inline CSS and inline JavaScript only. No external stylesheets or scripts.
- System fonts or local assets only. Do not fetch remote fonts, images, or
  scripts from the generated HTML.
- For each direction, show: color swatches, type roles, a layout sketch, the
  signature element, and the design risks.
- Include a selection control (buttons, radio inputs, or an explicit prompt)
  that names the direction to pick.

## Step 4: Wait for selection

Stop after presenting the options. Do not produce the artifact, and do not
pick a direction on the user's behalf. The user selects one direction, or
asks to combine traits from at most two of the presented directions.

## Step 5: Adapt to the medium

Load only the `references/medium-adapters.md` section for the target medium.
Apply its `Confirm`, `Translate`, `Preserve`, and `Constrain` fields without
changing the selected direction's design logic. If an adapter constraint
weakens the direction, state the conflict and offer a compatible alternative
instead of silently dropping the constraint. Fold each adapter's `Acceptance
additions` into the brief's `Acceptance criteria` section, and use its
`Production route` in Step 7.

## Step 6: Export the brief

Export the approved direction using this exact Markdown structure:

```markdown
# Art direction

## Intent
Subject, audience, purpose, and desired response.

## Direction
Selected design family, optional secondary family, and rationale.

## Signature
The one distinctive element that carries the concept.

## System
- Composition and hierarchy
- Typography
- Color
- Imagery
- Shape and line
- Texture and material
- Motion, if applicable

## Content
Required information and its priority.

## Medium adaptation
Dimensions, viewing conditions, interaction, accessibility, and production limits.

## Avoid
Generic defaults, misleading imagery, prohibited traits, and irrelevant decoration.

## Acceptance criteria
Observable checks for the finished artifact.

## Production route
Target production skill and required inputs.
```

## Step 7: Route production

Route production to the skill that matches the medium. Do not produce the
artifact in this skill.

| Medium | Production skill |
| --- | --- |
| Web interfaces | `frontend-design` |
| Browser artifacts, diagrams, slide decks delivered as HTML | `html-artifacts` |
| Slide decks delivered as PPTX | `pptx` |
| Documents and reports | `docx` (or `pdf` when PDF production or inspection is explicitly requested) |
| Social graphics | the available visual production skill |
| Generated imagery | the available image-generation skill |

When an adapter's `Production route` is more specific than this table, the
adapter's route governs. The production skill receives the exported brief as
input. It retains authority over its native format, tools, and validation.
This skill does not override that authority.

## Step 8: Critique the result

After production, load `references/critique-rubric.md` and check the finished
artifact against the approved brief using its ten checks. Report only
acceptance failures, each naming the artifact evidence and the violated
brief requirement, or an explicit pass. Do not introduce a new direction
during critique.

## Safeguards

Apply these rules across every step:

- Stop when required content is missing or ambiguous.
- Revise a direction that conflicts with accessibility or medium constraints.
- Replace unavailable fonts, assets, or production methods explicitly instead of pretending they exist.
- Reject imagery that invents facts about a person, place, product, or event.
- Keep critical text out of generated imagery. Generate the visual layer, add verified text with a layout tool, then inspect the composite for visual defects (spelling, anatomy, perspective, factual claims, and scaling artifacts).
- Describe observable historical traits and cite their source. Do not imitate a living artist.
- Treat regional and folk traditions as situated practices, not decorative stereotypes.
- State when medium adaptation weakens the selected direction and offer a compatible alternative.

## References

| When | Load |
| --- | --- |
| Choosing or translating a style family | `references/style-families.md` |
| Adapting a direction to its target medium | `references/medium-adapters.md` |
| Critiquing a produced artifact against the brief | `references/critique-rubric.md` |
