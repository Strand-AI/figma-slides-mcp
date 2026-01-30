#!/usr/bin/env node

/**
 * Generates dist/index.html with slide deck thumbnails and download links.
 * Expects Marp HTML/PDF/PPTX files already built in dist/.
 * Generates first-slide thumbnails via `marp --image png`.
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

/** Find .md files with marp: true frontmatter. */
function findDecks() {
  return readdirSync(ROOT)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => {
      const content = readFileSync(path.join(ROOT, f), "utf-8");
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      return match && /^marp:\s*true/m.test(match[1]);
    })
    .map((f) => f.replace(/\.md$/, ""));
}

/** Generate first-slide thumbnail for a deck. */
function generateThumbnail(name) {
  // Use the preprocessed file if it exists (.build/ from CI), otherwise the source .md
  const buildSrc = path.join(ROOT, ".build", `${name}.md`);
  const src = existsSync(buildSrc) ? buildSrc : path.join(ROOT, `${name}.md`);
  const out = path.join(DIST, `${name}-thumb.png`);

  if (existsSync(out)) return; // already generated

  try {
    execSync(
      `npx marp ${src} --html --allow-local-files --theme-set themes/ --image png -o ${out}`,
      { cwd: ROOT, stdio: "pipe" }
    );
  } catch {
    console.warn(`  Warning: could not generate thumbnail for ${name}`);
  }
}

/** Title-case a slug: "modulari-t" → "Modulari T" */
function titleCase(slug) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Main ───────────────────────────────────────────────────────────────────

const decks = findDecks();
console.log(`Generating index for ${decks.length} deck(s)...`);

for (const name of decks) {
  generateThumbnail(name);
}

const buildISO = new Date().toISOString();

/** Find the latest timestamped file for a deck (e.g. insitro-20260130.pdf). */
function findDownload(name, ext) {
  const files = readdirSync(DIST)
    .filter((f) => f.startsWith(`${name}-`) && f.endsWith(`.${ext}`))
    .sort()
    .reverse();
  // Prefer timestamped, fall back to plain
  return files[0] || (existsSync(path.join(DIST, `${name}.${ext}`)) ? `${name}.${ext}` : null);
}

const deckCards = decks
  .map((name) => {
    const title = titleCase(name);
    const hasThumb = existsSync(path.join(DIST, `${name}-thumb.png`));
    const thumbHTML = hasThumb
      ? `<a href="${name}.html" class="thumb"><img src="${name}-thumb.png" alt="${title} slide 1" /></a>`
      : "";
    const pdf = findDownload(name, "pdf");
    const pptx = findDownload(name, "pptx");
    const pdfLink = pdf ? `<a href="${pdf}" download>PDF</a>` : "";
    const pptxLink = pptx ? `<a href="${pptx}" download>PPTX</a>` : "";
    return `
    <div class="deck">
      ${thumbHTML}
      <div class="deck-info">
        <h2>${title}</h2>
        <div class="links">
          <a href="${name}.html">View slides</a>
          ${pdfLink}
          ${pptxLink}
        </div>
      </div>
    </div>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Strand AI — Slide Decks</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      background: #f7f7f5;
      color: #00120a;
      padding: 60px 40px;
      max-width: 720px;
      margin: 0 auto;
    }
    h1 { font-size: 1.8em; color: #004d3b; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 40px; font-size: 0.95em; }
    .deck {
      background: #fff;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .thumb {
      display: block;
      line-height: 0;
      border-bottom: 1px solid #f0efeb;
    }
    .thumb img {
      width: 100%;
      height: auto;
      display: block;
    }
    .deck-info {
      padding: 20px 24px;
    }
    .deck h2 {
      font-size: 1.15em;
      color: #004d3b;
      margin-bottom: 8px;
    }
    .links a {
      color: #004d3b;
      text-decoration: none;
      margin-right: 18px;
      font-size: 0.9em;
      font-weight: 500;
    }
    .links a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Strand AI — Slide Decks</h1>
  <p class="subtitle">Auto-built from main · <time id="build-time" datetime="${buildISO}"></time></p>
  <script>
    var t = document.getElementById('build-time');
    var d = new Date(t.getAttribute('datetime'));
    t.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  </script>
${deckCards}
</body>
</html>
`;

writeFileSync(path.join(DIST, "index.html"), html);
console.log("dist/index.html written.");
