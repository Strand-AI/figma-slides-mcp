# Strand AI — Slide Decks

Marp-based slide decks for Strand AI. Each `.md` file in the repo root with `marp: true` frontmatter is a slide deck.

## Stack

- **Marp CLI** for rendering markdown → HTML / PDF / PPTX
- **Custom theme**: `themes/strand.css` (always use `theme: strand`)
- **Font**: PP Telegraf (UltraLight 200, Regular 400, Bold 700, Black 900)
- **Deploy**: GitHub Actions → Cloudflare Pages (`slides.strandai.bio`, behind Cloudflare Access)

## Creating a New Deck

Every deck starts with this frontmatter and title slide:

```markdown
---
marp: true
theme: strand
paginate: true
footer: "Strand AI  ·  Confidential"
---

<!-- _class: lead -->
<!-- _footer: "" -->
<!-- _paginate: false -->

![w:400](assets/logo-white.svg)
```

The filename becomes the URL slug (e.g., `insitro.md` → `slides.strandai.bio/insitro.html`).

## Theme Classes

Set per-slide with `<!-- _class: name -->`:

- **(default)** — white background, dark text, pthalo green headings
- **`dark`** — pthalo green (#004D3B) background, light text
- **`lead`** — pthalo green background, centered, for title/section divider slides
- **`beige`** — ash beige (#F2F1ED) background
- **`slate`** — dark slate (#00120A) background, lightest text

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Pthalo | `#004D3B` | Primary brand, headings, `strong` text |
| Dark Slate | `#00120A` | Body text, darkest backgrounds |
| Ash Beige | `#F2F1ED` | Light backgrounds, code blocks |
| Ash Beige Dark | `#D9D1BB` | Borders, secondary text on dark |
| White | `#FFFFFF` | Light slide background |

## Slide Conventions

- **Pagination**: set `<!-- _paginate: false -->` on every slide (existing decks do this per-slide). The title/lead slide always has `<!-- _footer: "" -->` too.
- **Two-column layouts**: use a flex div pattern:
  ```html
  <div style="display:flex;gap:60px;margin-top:20px">
  <div style="flex:1">

  ### Left Column
  - content

  </div>
  <div style="flex:1">

  ### Right Column
  - content

  </div>
  </div>
  ```
- **Bold** text renders in pthalo green (via theme CSS) — use it for emphasis
- **Images**: place in `assets/`, reference as `![w:400](assets/filename.svg)`
- **Footnotes**: `<small style="margin-top:auto;color:#666">*Note text</small>`

## Assets

All static files (SVGs, fonts, images) live in `assets/`. The CI pipeline copies `assets/` into `dist/` for deployment.

Available logos:
- `assets/logo-white.svg` — white logo (for dark/lead slides)
- `assets/logo-pthalo.svg` — pthalo green logo (for light slides)
- `assets/logomark-white.svg` — white logomark only
- `assets/logomark-pthalo.svg` — pthalo green logomark only

## Local Dev

```bash
npm run dev        # Live-reload server
npm run build      # Build HTML to dist/
npm run pdf        # Build PDF
npm run pptx       # Build PPTX
npm run check      # Validate slide layouts (overflow & collision detection)
```

## Tone

These are pitch decks for biopharma, biotech, and investors. Keep slides concise — one core idea per slide, assertion-style headings, evidence in bullets. Avoid filler. Bold the key phrases.
