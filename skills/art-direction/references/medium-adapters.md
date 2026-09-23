# Medium adapters

Six adapters translate an approved direction into the constraints of a
target output. Each adapter keeps the direction's design logic and changes
only the implementation details the medium requires. Design safeguards and
inspection principles adapt guidance from John Hartnup's [Poster Prompts](https://john.hartnup.uk/poster-prompts/)
usage guide to multi-medium production.

Every adapter gives six fields: `Confirm`, `Translate`, `Preserve`,
`Constrain`, `Acceptance additions`, and `Production route`.

Do not invent a dimension, font size, or export format when the user has
not supplied enough production context. Ask for the missing constraint
instead of guessing one.

## Web and HTML

- Confirm: whether the target is an interactive web interface or a
  self-contained browser artifact, the viewport range, and any existing
  design system to fit or depart from.
- Translate: the direction's hierarchy into a responsive layout that
  reflows across breakpoints, not a single fixed-width composition.
- Preserve: the signature element and the palette across every breakpoint
  and interaction state.
- Constrain:
  - Responsive hierarchy holds at narrow, medium, and wide viewports.
  - Every interactive element has a visible keyboard focus state.
  - Markup uses semantic structure (headings, landmarks, lists), not
    generic containers styled to look structured.
  - Text and interface colors meet WCAG contrast minimums.
  - Motion respects `prefers-reduced-motion` and has a static fallback.
  - Loading cost stays low: no unnecessary remote fonts, scripts, or
    large images.
- Acceptance additions: state the target viewport range, the contrast
  ratio achieved, and the reduced-motion fallback.
- Production route: route web interfaces to `frontend-design`. Route
  self-contained browser artifacts to `html-artifacts`.

## Slide decks

- Confirm: the requested aspect ratio, the delivery format (PPTX or self-contained HTML), the room and remote viewing mix, and whether speaker notes are in scope.
- Translate: the direction's hierarchy into one main claim per slide, with
  supporting detail demoted to secondary position or speaker notes.
- Preserve: the signature element and palette across every slide, and both
  named style families if the direction combines two.
- Constrain:
  - Layout honors the requested aspect ratio; do not substitute a
    different ratio.
  - Type stays readable at the venue's viewing distance for room
    attendees and at the frame size for remote attendees.
  - Each slide carries one main claim; supporting points stay
    subordinate.
  - Text and critical lines meet at least 4.5:1 contrast against adjacent
    backgrounds (WCAG 2.1 SC 1.4.3), and diagrams remain readable when converted to grayscale.
  - Charts and diagrams keep their data-ink legible at presentation
    scale, not screen-editing scale.
  - A speaker-note boundary states what belongs on the visible slide and
    what belongs in speaker notes.
- Acceptance additions: state the aspect ratio, the room and remote
  viewing minimums, and the speaker-note boundary.
- Production route: `pptx` for presentation files. Route to `html-artifacts` when slide decks are delivered as self-contained HTML or browser artifacts.

## Documents and reports

- Confirm: the page size, the export target (screen, print, or both), and
  whether assistive-technology support is required.
- Translate: the direction's hierarchy into heading levels, running
  navigation, and a pagination scheme instead of a single continuous
  layout.
- Preserve: the signature element as a recurring structural device (for
  example, a running head or section marker), not a one-time flourish.
- Constrain:
  - Page size and margins are fixed and stated, not left implicit.
  - Layout works on screen and, when print is requested, on a standard
    office printer.
  - Running navigation (headers, footers, or a table of contents) helps
    orientation across the document.
  - Page breaks avoid splitting a table, a figure, or a heading from its
    following paragraph.
  - Tables have a defined column, header, and multi-page repetition
    treatment.
  - Footnotes have a defined placement and reference style.
  - Links have a stated treatment for both screen and print (for
    example, visible URLs in print).
  - The document supports assistive technology: reading order, semantic
    headings, and alt text for any retained imagery.
  - Exclude decorative imagery when the brief requests it.
- Acceptance additions: state the page size, the accessibility standard
  targeted, and the table and footnote treatment.
- Production route: `docx`. Route to `pdf` only when PDF production or
  inspection is explicitly requested.

## Diagrams and information graphics

- Confirm: what the diagram must show (entities, boundaries, flows,
  states) and the viewing conditions (zoom level, color availability).
- Translate: the direction's visual vocabulary into a fixed semantic
  assignment: what each shape, line weight, line style, and grouping
  means.
- Preserve: one meaning per visual trait. Do not reuse a shape, color, or
  line style for two different meanings.
- Constrain:
  - Shapes, lines, arrows, groups, and labels each carry a stated,
    consistent meaning.
  - A legend documents every symbol and line treatment used.
  - Layout controls edge crossings so flows and paths stay traceable.
  - The diagram remains understandable in grayscale; color is never the
    only signal for a distinction.
  - Labels and lines stay legible at the confirmed zoom level (defaulting
    to 100 percent), not only at a zoomed-in editing scale.
- Acceptance additions: state the legend contents and the grayscale and
  zoom checks performed.
- Production route: `html-artifacts` for browser-rendered or inline-SVG
  diagrams.

## Social graphics

- Confirm: the exact channel dimensions requested and any brand colors,
  fonts, or marks that must carry over unchanged.
- Translate: the direction's hierarchy into a crop-safe layout for each
  requested aspect ratio, not one layout scaled to fit every size.
- Preserve: every named brand color, font, and mark exactly as given, and
  the signature element within each aspect ratio.
- Constrain:
  - Layout matches the exact requested channel dimensions.
  - A defined safe area keeps essential content clear of crop and platform
    UI overlays for each aspect ratio (square versus vertical).
  - Type hierarchy stays legible at small, in-feed display sizes, with a
    stated minimum size for title, date, venue, and URL text.
  - Layout clears the bands platform interfaces typically occupy (for
    example, top and bottom bands on vertical formats).
  - Brand tokens (colors, fonts, marks) carry over unchanged.
  - Copy stays concise enough to read at a glance.
  - Alt text is required for every graphic produced.
- Acceptance additions: state the safe-area dimensions and the minimum
  legible text size for each aspect ratio.
- Production route: the available visual graphic design skill or tool.

## Image-generation prompts

- Confirm: the aspect ratio, resolution, and whether the image must depict
  a real, identifiable subject (a person, place, product, or event).
- Translate: the direction's imagery and material fields into an explicit
  prompt: subject, composition, style traits, and what to exclude.
- Preserve: the signature element as the composition's focal point, not a
  minor background detail.
- Constrain:
  - State the aspect ratio and resolution explicitly.
  - State the subject and composition explicitly; do not leave framing
    implicit.
  - State the style traits drawn from the selected family.
  - State negative constraints: traits, objects, or artifacts to exclude.
  - When the subject is a real, unphotographed place, person, product, or
    event, refuse to invent a specific likeness. Request a reference
    photograph or propose an abstract or symbolic alternative instead.
  - Keep critical text (titles, dates, venues, URLs) out of the generated
    image. Generate imagery separately, then add verified text with a
    layout tool.
  - Route image generation and layout or text production as separate
    steps, each with its own inspection.
  - Inspect generated imagery and the composite for visual defects
    (spelling, anatomy, perspective, factual claims, and scaling
    artifacts) before handoff.
  - Deliver complete alternative text describing visual content and
    composition alongside the generated asset.
- Acceptance additions: state the negative constraints applied, confirm
  that critical text lives in a separate, verified layer, confirm that visual
  defects (spelling, anatomy, perspective, factual claims, and scaling
  artifacts) were checked, and provide alternative text.
- Production route: the available image-generation skill for imagery, and
  a layout tool or `html-artifacts` for the verified text layer.
