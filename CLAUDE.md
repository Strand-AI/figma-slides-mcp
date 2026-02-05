# Strand AI — Slide Decks

Slide decks for Strand AI with PPTX creation and editing capabilities.

## Stack

- **PPTX Skill**: Native PowerPoint creation via PptxGenJS and template editing (see `skills/pptx/`)
- **Marp CLI** (legacy): For markdown-based slides (`slides/*.md`)
- **Custom theme**: `themes/strand.css` (for Marp decks, use `theme: strand`)
- **Font**: PP Telegraf (UltraLight 200, Regular 400, Bold 700, Black 900)
- **Deploy**: GitHub Actions → Cloudflare Pages (`slides.strandai.bio`, behind Cloudflare Access)

## PPTX Skill

For creating or editing PowerPoint presentations, use the skill in `skills/pptx/`. This provides:
- **Reading**: Extract text with `python -m markitdown presentation.pptx`
- **Editing**: Unpack/edit/repack workflow for template-based modifications
- **Creating**: PptxGenJS for programmatic slide creation from scratch

**Setup:**
```bash
# Python dependencies (using uv)
cd skills/pptx && uv sync

# Node dependencies
npm install
```

See `skills/pptx/SKILL.md` for full documentation.

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

![w:400](../assets/logo-white.svg)
```

The filename becomes the URL slug (e.g., `slides/insitro.md` → `slides.strandai.bio/insitro.html`).

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
- **Images**: place in `assets/`, reference as `![w:400](../assets/filename.svg)`
- **Footnotes**: `<small style="margin-top:auto;color:#666">*Note text</small>`

## Assets

All static files (SVGs, fonts, images) live in `assets/`. The CI pipeline copies `assets/` into `dist/` for deployment.

Available logos:
- `assets/logo-white.svg` — white logo (for dark/lead slides)
- `assets/logo-pthalo.svg` — pthalo green logo (for light slides)
- `assets/logomark-white.svg` — white logomark only
- `assets/logomark-pthalo.svg` — pthalo green logomark only

## Mermaid Diagrams

Marp doesn't support Mermaid natively. We have a preprocessing pipeline that converts fenced ```` ```mermaid ```` blocks into `<img>` tags with base64 SVG data URIs at build time.

**How it works**: `scripts/preprocess-mermaid.sh` finds mermaid code blocks, renders them to SVG via `mmdc` (@mermaid-js/mermaid-cli) with a custom theme (`scripts/mermaid-config.json`), and embeds the result as an `<img>` tag with a base64 data URI. The CI workflow runs this automatically before building.

**Why `<img>` and not inline SVG**: Inline SVGs inherit CSS from the parent Marp slide. On dark/lead slides, this causes text colors and arrows to become invisible. Using `<img>` with a data URI sandboxes the SVG from slide styles.

**Usage** — write standard mermaid in your markdown:

````markdown
```mermaid
graph LR
    A[H&E] --> B[Model] --> C[Predicted mIF]
```
````

**Theming**: The base theme in `scripts/mermaid-config.json` uses the Strand color palette (pthalo green nodes, white text, ash beige arrows — visible on both light and dark slides). To customize individual nodes, use `style` directives with brand colors:

````markdown
```mermaid
graph LR
    A["Input data"] --> B["Model"] --> C["Output"]
    style A fill:#F2F1ED,color:#00120A,stroke:#D9D1BB
    style C fill:#00120A,color:#F2F1ED,stroke:#00120A
```
````

Available node colors:
- **Default** (no style): pthalo green `#004D3B` fill, white text
- **Light input**: `fill:#F2F1ED,color:#00120A,stroke:#D9D1BB` (ash beige)
- **Dark emphasis**: `fill:#00120A,color:#F2F1ED,stroke:#00120A` (dark slate)

**Tips**:
- Keep node labels short — long text makes diagrams hard to read on slides
- Use `graph LR` (left-to-right) for process flows — fits slide aspect ratio better than `TB`
- Don't use `<b>` in node labels — the theme handles font weight
- Diagrams render at `max-height:400px` — keep them simple (3-5 nodes)

**Local dev**: `npm run dev` automatically preprocesses mermaid blocks into `.build/` and serves from there with live reload. It watches for file changes and re-preprocesses. Uses `fswatch` if available, otherwise polls every 2 seconds.

## Speaker Notes

Use HTML comments (that aren't Marp directives) as speaker notes:

```markdown
## Slide Title

Content here

<!--
- Talking point one
- Talking point two
-->
```

Visible in HTML presenter view (press **P**), PPTX (native notes), and PDF (`--pdf-notes` flag). Keep notes as short bulleted lists.

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
