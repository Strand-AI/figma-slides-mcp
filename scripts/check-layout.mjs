#!/usr/bin/env node

/**
 * Slide layout validator — checks Marp HTML decks for overflow and collisions.
 * Uses Playwright (headless Chromium) to render slides and inspect bounding boxes.
 *
 * Usage:
 *   node scripts/check-layout.mjs [file1.html file2.html ...]
 *   npm run check
 *
 * Exit code 1 if any issues found (CI-friendly).
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const SLIDE_W = 1280;
const SLIDE_H = 720;
// Tolerance in pixels — ignore sub-pixel rounding
const TOLERANCE = 2;
// Elements to skip when checking collisions (they intentionally overlay content)
const SKIP_COLLISION_SELECTORS = new Set([
  "footer",
  "[data-marpit-pagination]",
  "header",
]);

const ROOT = path.resolve(import.meta.dirname, "..");

// ─── Build decks ────────────────────────────────────────────────────────────

/** Find .md files in root that have `marp: true` in their YAML frontmatter. */
function findMarpDecks() {
  return readdirSync(ROOT)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => {
      const content = readFileSync(path.join(ROOT, f), "utf-8");
      // Check frontmatter: starts with --- and contains marp: true
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      return match && /^marp:\s*true/m.test(match[1]);
    });
}

function buildDecks() {
  const decks = findMarpDecks();
  if (decks.length === 0) {
    console.error("No Marp decks found.");
    process.exit(1);
  }
  const distDir = path.join(ROOT, "dist");
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

  console.log(`Building ${decks.length} deck(s) with Marp...`);
  for (const deck of decks) {
    const outFile = path.join("dist", deck.replace(/\.md$/, ".html"));
    execSync(
      `npx marp ${deck} --html --allow-local-files --theme-set themes/ -o ${outFile}`,
      { cwd: ROOT, stdio: "inherit" }
    );
  }
}

// ─── Find HTML files ────────────────────────────────────────────────────────

function findHtmlFiles(args) {
  if (args.length > 0) {
    return args.map((f) => path.resolve(f));
  }
  const distDir = path.join(ROOT, "dist");
  if (!existsSync(distDir)) {
    return [];
  }
  // Only check HTML files that correspond to actual Marp decks
  const deckNames = new Set(
    findMarpDecks().map((f) => f.replace(/\.md$/, ".html"))
  );
  return readdirSync(distDir)
    .filter((f) => deckNames.has(f))
    .map((f) => path.join(distDir, f));
}

// ─── Rect helpers ───────────────────────────────────────────────────────────

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function describeEl(el) {
  let label = `<${el.tag}>`;
  if (el.id) label += `#${el.id}`;
  if (el.className) label += `.${el.className.split(" ").join(".")}`;
  if (el.text) label += ` "${el.text.slice(0, 40)}"`;
  return label;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const screenshotFlag = !args.includes("--no-screenshots");
  const filteredArgs = args.filter((a) => !a.startsWith("--"));

  // Build first if no specific files given
  if (filteredArgs.length === 0) {
    buildDecks();
  }

  const htmlFiles = findHtmlFiles(filteredArgs);
  if (htmlFiles.length === 0) {
    console.error("No HTML files found. Run `npm run build` first.");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: SLIDE_W, height: SLIDE_H },
  });

  let totalIssues = 0;

  for (const htmlFile of htmlFiles) {
    const basename = path.basename(htmlFile);
    const page = await context.newPage();
    await page.goto(`file://${htmlFile}`, { waitUntil: "networkidle" });

    // Marp bespoke template: each slide is an SVG with a foreignObject > section
    const slides = await page.locator("svg[data-marpit-svg]").all();

    // Skip non-Marp HTML files (e.g. CLAUDE.html built from CLAUDE.md)
    if (slides.length === 0) {
      await page.close();
      continue;
    }

    const issues = [];

    for (let i = 0; i < slides.length; i++) {
      const slideNum = i + 1;
      const slide = slides[i];
      const section = slide.locator(":scope > foreignObject > section");

      // Get bounding boxes of all content elements within the section
      const elements = await section
        .locator(
          "p, h1, h2, h3, h4, h5, h6, li, div, img, span, table, blockquote, code, pre, small, strong, ul, ol, a, figure, figcaption"
        )
        .all();

      const elData = [];
      for (const el of elements) {
        // Get bounding box relative to the slide's foreignObject
        const data = await el.evaluate((node) => {
          // Walk up to find the section (slide root)
          let section = node.closest("section");
          if (!section) return null;

          const sectionRect = section.getBoundingClientRect();
          const elRect = node.getBoundingClientRect();

          // Position relative to the section
          const x = elRect.left - sectionRect.left;
          const y = elRect.top - sectionRect.top;

          return {
            tag: node.tagName.toLowerCase(),
            id: node.id || "",
            className: node.className || "",
            text: node.textContent?.trim().slice(0, 60) || "",
            x,
            y,
            width: elRect.width,
            height: elRect.height,
            isFooter:
              node.tagName.toLowerCase() === "footer" ||
              node.hasAttribute("data-marpit-pagination") ||
              node.tagName.toLowerCase() === "header",
          };
        });

        if (!data || data.width === 0 || data.height === 0) continue;
        elData.push(data);
      }

      // ── Overflow check ──────────────────────────────────────────────
      for (const el of elData) {
        const overflows = [];
        if (el.x + el.width > SLIDE_W + TOLERANCE) {
          overflows.push(
            `extends to x=${Math.round(el.x + el.width)} (${Math.round(el.x + el.width - SLIDE_W)}px past right edge)`
          );
        }
        if (el.y + el.height > SLIDE_H + TOLERANCE) {
          overflows.push(
            `extends to y=${Math.round(el.y + el.height)} (${Math.round(el.y + el.height - SLIDE_H)}px past bottom)`
          );
        }
        if (el.x < -TOLERANCE) {
          overflows.push(`starts at x=${Math.round(el.x)} (past left edge)`);
        }
        if (el.y < -TOLERANCE) {
          overflows.push(`starts at y=${Math.round(el.y)} (past top edge)`);
        }

        if (overflows.length > 0) {
          issues.push({
            slide: slideNum,
            type: "OVERFLOW",
            element: describeEl(el),
            detail: overflows.join("; "),
            pos: `(${Math.round(el.x)},${Math.round(el.y)}) ${Math.round(el.width)}×${Math.round(el.height)}`,
          });
        }
      }

      // ── Collision check ─────────────────────────────────────────────
      // Only check between direct-child-level elements, skip footers/pagination
      const contentEls = elData.filter((el) => {
        if (el.isFooter) return false;
        // Skip elements that are children of other tracked elements
        // (we approximate by checking if it's a top-level block element)
        const blockTags = new Set([
          "p",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "div",
          "ul",
          "ol",
          "table",
          "blockquote",
          "pre",
          "figure",
          "img",
        ]);
        return blockTags.has(el.tag);
      });

      for (let a = 0; a < contentEls.length; a++) {
        for (let b = a + 1; b < contentEls.length; b++) {
          const elA = contentEls[a];
          const elB = contentEls[b];

          // Skip if one is a parent of the other (heuristic: same position and one is bigger)
          if (
            Math.abs(elA.x - elB.x) < TOLERANCE &&
            Math.abs(elA.y - elB.y) < TOLERANCE
          ) {
            continue; // likely parent-child
          }
          // Skip if one fully contains the other
          if (
            elA.x <= elB.x + TOLERANCE &&
            elA.y <= elB.y + TOLERANCE &&
            elA.x + elA.width >= elB.x + elB.width - TOLERANCE &&
            elA.y + elA.height >= elB.y + elB.height - TOLERANCE
          ) {
            continue; // A contains B
          }
          if (
            elB.x <= elA.x + TOLERANCE &&
            elB.y <= elA.y + TOLERANCE &&
            elB.x + elB.width >= elA.x + elA.width - TOLERANCE &&
            elB.y + elB.height >= elA.y + elA.height - TOLERANCE
          ) {
            continue; // B contains A
          }

          if (rectsOverlap(elA, elB)) {
            issues.push({
              slide: slideNum,
              type: "COLLISION",
              element: `${describeEl(elA)} ↔ ${describeEl(elB)}`,
              detail: "elements overlap",
              pos: "",
            });
          }
        }
      }
    }

    // ── Report ────────────────────────────────────────────────────────
    if (issues.length === 0) {
      console.log(`\n${basename}\n  ✓ All slides pass`);
    } else {
      console.log(`\n${basename}`);
      const slideNums = new Set();
      for (const issue of issues) {
        const posStr = issue.pos ? ` at ${issue.pos}` : "";
        console.log(
          `  Slide ${issue.slide}: ${issue.type} — ${issue.element}${posStr}`
        );
        console.log(`    ${issue.detail}`);
        slideNums.add(issue.slide);
      }

      // Screenshot problem slides
      if (screenshotFlag) {
        const screenshotDir = path.join(ROOT, "dist");
        if (!existsSync(screenshotDir)) mkdirSync(screenshotDir, { recursive: true });

        for (const slideNum of slideNums) {
          const slideEl = slides[slideNum - 1];
          const name = path.basename(htmlFile, ".html");
          const outPath = path.join(
            screenshotDir,
            `${name}-slide${slideNum}-layout.png`
          );
          await slideEl.screenshot({ path: outPath });
          console.log(`  → screenshot: dist/${name}-slide${slideNum}-layout.png`);
        }
      }

      totalIssues += issues.length;
    }

    await page.close();
  }

  await browser.close();

  console.log(
    totalIssues > 0
      ? `\n✗ ${totalIssues} layout issue(s) found`
      : "\n✓ All decks pass layout checks"
  );
  process.exit(totalIssues > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
