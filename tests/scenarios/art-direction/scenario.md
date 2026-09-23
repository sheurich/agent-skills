# Scenario: art-direction

## Context

An open-source API-latency visualization tool for SREs ("Night Watch") needs
visual directions for its public website. The audience distrusts marketing hype
and expects precision. The request asks for visual directions only, not the
finished web page.

## Task

Develop visual directions for the public website of Night Watch, an
open-source API-latency visualization tool for SREs. The audience distrusts
hype. The site must feel precise without becoming a generic dark developer
dashboard. Show direction options only. Do not build the page.

## Criteria

- [ ] Presents 2-3 directions
- [ ] Each direction is tied to Night Watch's specific subject (latency data, SRE audience, precision), not generic adjectives
- [ ] Directions use distinct design logic, not only different color palettes
- [ ] Comparison is a self-contained HTML artifact (no remote assets)
- [ ] Does not produce or draft the actual web page
- [ ] Stops and asks the user to select a direction rather than proceeding

## Baseline

- Date: 2026-09-19
- Agent: pi (`--no-skills --no-extensions`)

| Criterion | Result | Observation |
| --- | --- | --- |
| 2-3 directions | Pass | Produced three: Calibration Bench, Systems Monograph, Night-Adapted Console. |
| Subject-specific | Pass | Each direction ties to latency measurement (oscilloscope panels, CDF curves, packet telemetry), not generic branding. |
| Distinct design logic | Pass | Instrument-panel logic, editorial/paper logic, and night-console telemetry logic differ in structure, not only palette. |
| Self-contained HTML comparison | Fail | Output is plain Markdown with ASCII layout sketches; no HTML file, no inline CSS/JS comparison artifact. |
| No page production | Pass | No web page markup or code produced. |
| Stops for selection | Fail | Ends on the third direction's "Trust Strategy" paragraph with no explicit prompt to choose. |

## With-Skill

- Date: 2026-09-19
- Agent: pi (`--skill skills/art-direction`)

| Criterion | Result | Observation |
| --- | --- | --- |
| 2-3 directions | Pass | Produced three: The Calibrated Instrument, The Systems Journal, The Bare-Metal Console. |
| Subject-specific | Pass | Each direction cites Night Watch specifics (percentile datum axis, tail-latency forensic diff, live invariant diagnostic bar), not generic branding adjectives. |
| Distinct design logic | Pass | Specification-sheet logic, systems-journal/editorial logic, and terminal-console logic differ in structure and information layout, not only palette. |
| Self-contained HTML comparison | Pass | Wrote a single `night-watch-visual-directions.html` file with an inline `<style>` block, inline `<script>` tab/selection logic, and no `<link>` or `<script src>` to a remote host. |
| No page production | Pass | No Night Watch web page or site code was produced; the artifact is the comparison page itself. |
| Stops for selection | Pass | Ends with "Select Option 1, Option 2, or Option 3 to proceed," with radio-pill selection controls and an explicit confirm action. |

## Analysis

Baseline: 4 of 6. With-skill: 6 of 6. The unaided agent already reasons well about
subject-specific, distinct directions, but defaults to a Markdown design memo instead
of a self-contained HTML comparison artifact, and never pauses for selection. With
`art-direction` loaded, the agent produces the required self-contained HTML artifact
(inline CSS/JS, no remote assets), keeps the directions tied to latency measurement
with distinct design logic, and stops for user selection instead of proceeding to
build the site.
