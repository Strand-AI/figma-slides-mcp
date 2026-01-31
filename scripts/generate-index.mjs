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
const SLIDES = path.join(ROOT, "slides");
const DIST = path.join(ROOT, "dist");

/** Find .md files with marp: true frontmatter. */
function findDecks() {
  return readdirSync(SLIDES)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => {
      const content = readFileSync(path.join(SLIDES, f), "utf-8");
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      return match && /^marp:\s*true/m.test(match[1]);
    })
    .map((f) => f.replace(/\.md$/, ""));
}

/** Generate first-slide thumbnail for a deck. */
function generateThumbnail(name) {
  // Use the preprocessed file if it exists (.build/ from CI), otherwise the source .md
  const buildSrc = path.join(ROOT, ".build", `${name}.md`);
  const src = existsSync(buildSrc) ? buildSrc : path.join(SLIDES, `${name}.md`);
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
    <div class="deck" data-title="${title.toLowerCase()}">
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
    .subtitle { color: #888; margin-bottom: 24px; font-size: 0.95em; }
    .search {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #d9d1bb;
      border-radius: 8px;
      font-size: 0.95em;
      font-family: inherit;
      background: #fff;
      color: #00120a;
      margin-bottom: 24px;
      outline: none;
    }
    .search:focus { border-color: #004d3b; }
    .search::placeholder { color: #aaa; }
    .deck {
      background: #fff;
      border-radius: 12px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      overflow: hidden;
      display: flex;
      align-items: stretch;
    }
    .deck.hidden { display: none; }
    .thumb {
      flex-shrink: 0;
      width: 300px;
      line-height: 0;
      border-right: 1px solid #f0efeb;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .deck-info {
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .deck h2 {
      font-size: 1.1em;
      color: #004d3b;
      margin-bottom: 6px;
    }
    .links a {
      color: #004d3b;
      text-decoration: none;
      margin-right: 16px;
      font-size: 0.85em;
      font-weight: 500;
    }
    .links a:hover { text-decoration: underline; }
    .no-results {
      color: #888;
      font-size: 0.95em;
      display: none;
      padding: 20px 0;
    }
  </style>
</head>
<body>
  <h1>Strand AI — Slide Decks</h1>
  <p class="subtitle">Auto-built from main · <time id="build-time" datetime="${buildISO}"></time></p>
  <input class="search" type="text" placeholder="Search decks..." autofocus />
  <div id="decks">
${deckCards}
  </div>
  <p class="no-results" id="no-results">No matching decks.</p>
  <script>
    var t = document.getElementById('build-time');
    var d = new Date(t.getAttribute('datetime'));
    t.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    var input = document.querySelector('.search');
    var decks = document.querySelectorAll('.deck');
    var noResults = document.getElementById('no-results');
    input.addEventListener('input', function() {
      var q = this.value.toLowerCase();
      var visible = 0;
      decks.forEach(function(el) {
        var match = !q || el.getAttribute('data-title').indexOf(q) !== -1;
        el.classList.toggle('hidden', !match);
        if (match) visible++;
      });
      noResults.style.display = visible === 0 ? 'block' : 'none';
    });
  </script>
</body>
</html>
`;

writeFileSync(path.join(DIST, "index.html"), html);
console.log("dist/index.html written.");
