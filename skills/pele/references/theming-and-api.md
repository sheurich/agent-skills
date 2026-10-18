# Pele Theming, Diagram Types, and JS/TS API

## CSS Variable Theming

Every rendered `<svg>` has `class="pele"` and references CSS custom properties with built-in fallbacks. Set `--pele-*` variables on `.pele` or any ancestor element to switch light and dark themes with zero re-rendering:

```css
.pele {
  --pele-bg: #fffcf0;
  --pele-fg: #100f0f;
  --pele-muted: #6f6e69;
  --pele-line: #100f0f;
  --pele-surface: #f2f0e5;
  --pele-surface-alt: #e6e4d9;
  --pele-border: #cecdc3;
  --pele-accent: #205ea6;
  --pele-critical: #af3029;
  --pele-radius: 4px;
}

@media (prefers-color-scheme: dark) {
  .pele {
    --pele-bg: #100f0f;
    --pele-fg: #cecdc3;
    --pele-muted: #878580;
    --pele-line: #cecdc3;
    --pele-surface: #1c1b1a;
    --pele-surface-alt: #282726;
    --pele-border: #403e3c;
    --pele-accent: #4385be;
    --pele-critical: #d14d41;
  }
}
```

Categorical diagrams (`pie`, `gitGraph`, `xychart-beta`, `sankey-beta`, etc.) additionally use `--pele-series-1` through `--pele-series-8`.

## Supported Diagram Types (Mermaid 12.1.0)

- **Core:** `flowchart` / `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram` / `stateDiagram-v2`, `erDiagram`
- **Planning & Charts:** `gantt`, `gitGraph`, `pie`, `mindmap`, `kanban`, `timeline`, `journey`, `quadrantChart`, `xychart-beta`
- **Architecture & Systems:** `requirementDiagram`, `sankey-beta`, `architecture-beta`, `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`
- **Extended Beta:** `block-beta`, `agentflow-beta`, `railroad-beta`, `treeView-beta`, `cynefin-beta`, `wardley-beta`, `eventmodeling`, `usecase-beta`, `venn-beta`, `ishikawa-beta`, `packet-beta`, `radar-beta`, `treemap-beta`, `swimlane-beta`, `info`

## Programmatic JS/TS Usage

Install in a Node or browser project with `npm install pele`.

```ts
import {
  render,
  mount,
  enableZoom,
  detectType,
  PeleError,
  type RenderOptions,
  type RenderResult,
} from "pele";

// 1. Synchronous SVG rendering (Node or Browser)
const result: RenderResult = render("flowchart LR\n  A[Input] --> B[Output]", {
  maxWidth: 640,        // wraps labels, compacts spacing, switches wide LR -> TB below 640px
  fontSize: 16,
  padding: 16,
  idPrefix: "fig-1",    // unique prefix when embedding multiple SVGs on one page
  responsive: true,
  autoDirection: true,
  links: false,         // set false for untrusted input
  images: false,        // set false for untrusted input
});
// result: { svg: string, width: number, height: number, type: string, links: Array<...> }

// 2. Browser container mounting (observes container resize + web fonts, optional zoom/pan)
const handle = mount(document.querySelector("#diagram")!, "flowchart LR\n  A --> B", {
  zoom: "auto", // "auto" | true | false | { always?: boolean, maxScale?: number, controls?: boolean }
});
// Call handle.destroy() on unmount.
```

### Error Handling

`render()` throws `PeleError` on syntax, semantic, or limit errors:

```ts
try {
  render(untrustedSource, { links: false, images: false });
} catch (err) {
  if (err instanceof PeleError) {
    // err.code, err.type, err.line, err.column, err.snippet, err.message
    errorBanner.textContent = `Line ${err.line}:${err.column} [${err.code}] ${err.message}`;
  }
}
```
