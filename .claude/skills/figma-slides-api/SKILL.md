---
name: figma-slides-api
description: Reference for Figma Slides plugin API gotchas and quirks. ALWAYS load this skill when working with Figma slides in any capacity — editing, reviewing, creating, or debugging. Contains critical API pitfalls that cause silent bugs if ignored.
---

# Figma Slides Plugin API — Gotchas & Reference

Consult this before making changes to slides via the `figma-slides` MCP server.

## Brand Schema

Brand/style tokens are **data, not code** — they live in a project dotfile, never hardcoded in `execute` scripts.

**Before any styling or layout work**, read the schema (first match wins):

1. `./.figma-brand.json` (repo root — project-specific, preferred)
2. `~/.config/figma-brand.json` (global fallback)

If neither exists, sample a polished slide (title/subtitle/body colors, fonts, sizes, left margin, background fill) and **offer to write** a `.figma-brand.json` before proceeding.

**How to apply it:**

- Style by *intent*, mapping each element to a role in `roles`:
  | Element | Role |
  |---------|------|
  | Slide title | `header` |
  | One-line summary under the title | `subtitle` |
  | In-body section heading | `subhead` |
  | Paragraph / body copy | `body` |
- Resolve `color` and `font` fields through the `colors` and `fonts` maps — they are **names**, not literals (e.g. `"color": "brandGreen"` → `colors.brandGreen`).
- Use `grid` (`leftMargin`, `headerY`, `subtitleY`) and role `x`/`y` for placement so new elements land on the deck's grid.
- **Never** write raw hex, font names, or sizes into `execute` code — always resolve them from the schema so one edit to the dotfile restyles every slide.
- Load fonts (`loadFont`) for every family + style referenced by the roles you apply (see Font Loading below).

## Skipping Slides

To hide a slide from a presentation, use `isSkippedSlide` — NOT `visible`.

```js
// CORRECT — slide is skipped in presentation, visible in editor (crossed out)
slide.isSkippedSlide = true;

// WRONG — makes the entire frame invisible in the editor too
slide.visible = false;
```

## Node Lookup

Use `figma.getNodeByIdAsync()`, not `figma.getNodeById()`. The plugin uses `documentAccess: "dynamic-page"` which requires async access.

```js
// CORRECT
const node = await figma.getNodeByIdAsync(id);

// WRONG — throws "Cannot call with documentAccess: dynamic-page"
const node = figma.getNodeById(id);
```

## Font Loading

You must call `figma.loadFontAsync()` before modifying any text node's `characters`. This applies to every font family + style used in the text.

- **PP Telegraf** (our heading font) only loads if installed on the system. Font files must be in `~/Library/Fonts/`. Figma Desktop must be restarted after installing.
- **Inter** loads without issue (bundled with Figma).

```js
await figma.loadFontAsync({ family: "PP Telegraf", style: "Regular" });
await figma.loadFontAsync({ family: "PP Telegraf", style: "Bold" });
await figma.loadFontAsync({ family: "Inter", style: "Light" });
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
```

The `loadFont(family, style)` helper in the plugin sandbox wraps `figma.loadFontAsync`.

## Slide Discovery

The `findSlides()` helper traverses SLIDE_GRID > SLIDE_ROW > SLIDE hierarchy. Slides are returned in presentation order.

```js
const slides = findSlides();       // all slides in order
const slide = getSlide(0);         // slide by index
const info = serialize(slide);     // JSON-friendly summary
```

## Template Slide Reference

| Index | Layout | Background | Use |
|-------|--------|------------|-----|
| 0 | Title | Dark (textured) | Model name + subtitle |
| 1 | Hook | Dark (pthalo) | Provocative question + pitch |
| 2 | Problem | Dark (pthalo) | Heading + 3 pain points |
| 3 | Solution | Light (ash beige) | Input > Model > Output diagram |
| 4 | Benchmarks | Light (ash beige) | Comparison table + advantages |
| 5 | Cost/Value | Dark (pthalo) | Side-by-side comparison |
| 6 | Timeline | Light (ash beige) | 4-phase roadmap + details |
| 7 | How we work | Light (ash beige) | 2-step engagement |
| 8 | Closing | Dark (textured) | Logo only |

## File Duplication

The Figma REST API has no file duplication endpoint. Duplicate files manually in the Figma UI (right-click > Duplicate).

## REST API vs Plugin API

- **REST API** (`https://api.figma.com/v1/...`): Team/project/file listing, thumbnails. Uses `X-Figma-Token` header with PAT.
- **Plugin API** (`figma.*`): Manipulate the currently open file. Runs inside the plugin sandbox, accessed via MCP `execute` tool.

The `/projects/:id/files` endpoint does NOT return `editorType`, so you can't filter for Slides-only files at the API level.
