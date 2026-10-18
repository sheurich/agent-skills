---
name: pele
description: >-
  Validate and render Mermaid diagrams to themeable SVG or standalone
  interactive HTML using Pele (obsidianmd/pele, pele.run). Use when creating,
  editing, validating, previewing, or converting Mermaid diagrams in .mmd or
  Markdown files, or when integrating Pele into a web or Node application.
---

# Pele Diagram Validation & Rendering

Pele (`obsidianmd/pele`, `pele.run`) is a synchronous, zero-dependency Mermaid 12.1.0 renderer that outputs clean, themeable SVG styled via CSS custom properties (`--pele-*`) without a headless browser.

Use the bundled CLI wrapper at [./scripts/pele](./scripts/pele) (or `pele` if present on `PATH`). It caches `pele@1.6.0` under `${PELE_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/pele}/1.6.0` with `--ignore-scripts` on first run.

## Required Workflow

1. **Always validate before finishing:** Whenever you author or edit a Mermaid diagram—whether in a standalone `.mmd` file or inside fenced ``` ```mermaid ``` blocks in Markdown—run `--check` on the file.
2. **Fix reported line/column errors:** If `--check` exits `1`, read the `[<type>/<code>] (line N, column M)` diagnostic and caret snippet on `stderr`, fix the syntax (commonly unquoted parentheses/brackets in node labels or invalid arrow tokens), and re-run `--check` until it exits `0`.

## Task Selection

| Goal | Command |
| --- | --- |
| Validate all ``` ```mermaid ``` blocks in Markdown file(s) | `./scripts/pele --check README.md docs/arch.md` |
| Validate a single `.mmd` file or stdin | `./scripts/pele --check diagram.mmd` |
| Render Mermaid to themeable SVG | `./scripts/pele diagram.mmd -o diagram.svg` |
| Generate standalone HTML preview (light/dark + zoom/pan) | `./scripts/pele --html --title "Architecture" diagram.mmd -o preview.html` |
| Inspect layout dimensions and links as JSON | `./scripts/pele --json diagram.mmd` |
| Constrain width (adapts layout; switches wide `LR` to `TB` <640px) | `./scripts/pele --max-width 480 diagram.mmd -o narrow.svg` |
| Render untrusted diagram input safely | `./scripts/pele --no-links --no-images untrusted.mmd -o safe.svg` |

Run `./scripts/pele --help` for all CLI flags (`--font-size`, `--padding`, `--id-prefix`, `--no-responsive`, `--no-auto-direction`).

## Security Rules for Untrusted Diagrams

- Pass `--no-links --no-images` (CLI) or `{ links: false, images: false }` (JS API) when rendering untrusted Mermaid syntax so external image beacons and links are stripped.
- Render `PeleError.message` as plain text (`textContent`), never `innerHTML`, because error diagnostics echo source snippets.
- When embedding multiple rendered SVGs in one document, pass a distinct `--id-prefix` (or `idPrefix`) per diagram so accessibility `<title>`/`<desc>` IDs do not collide.

## Reference Material

- [theming-and-api.md](./references/theming-and-api.md) — CSS custom property palette (`--pele-*`), supported Mermaid 12.1.0 diagram types, and programmatic Node/browser JS/TS API (`render`, `mount`, `enableZoom`, `PeleError`).
