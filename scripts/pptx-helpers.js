/**
 * PPTX Helpers for Strand AI Decks
 *
 * Provides utilities for creating slides including:
 * - Mermaid diagram rendering
 * - Brand colors
 * - Common layouts
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Strand AI Brand Colors (no # prefix for pptxgenjs)
const COLORS = {
  pthalo: '004D3B',
  darkSlate: '00120A',
  ashBeige: 'F2F1ED',
  ashBeigeDark: 'D9D1BB',
  white: 'FFFFFF',
};

// Mermaid config matching Strand branding
const MERMAID_CONFIG = {
  theme: 'base',
  themeVariables: {
    primaryColor: '#004D3B',
    primaryTextColor: '#FFFFFF',
    primaryBorderColor: '#D9D1BB',
    lineColor: '#D9D1BB',
    secondaryColor: '#F2F1ED',
    tertiaryColor: '#00120A',
    background: 'transparent',
    mainBkg: '#004D3B',
    textColor: '#00120A',
    nodeTextColor: '#FFFFFF',
  },
};

/**
 * Render a mermaid diagram to base64 PNG
 *
 * @param {string} code - Mermaid diagram code
 * @param {object} options - { width, height, background }
 * @returns {string} Base64 data URI for use in slide.addImage({ data: ... })
 *
 * @example
 * const diagram = await mermaid(`
 *   graph LR
 *     A[Input] --> B[Model] --> C[Output]
 * `);
 * slide.addImage({ data: diagram, x: 1, y: 1, w: 8, h: 4 });
 */
async function mermaid(code, options = {}) {
  const { width = 1200, height = 800, background = 'transparent' } = options;

  const tmpDir = os.tmpdir();
  const inputFile = path.join(tmpDir, `mermaid-${Date.now()}.mmd`);
  const outputFile = path.join(tmpDir, `mermaid-${Date.now()}.png`);
  const configFile = path.join(tmpDir, `mermaid-config-${Date.now()}.json`);

  try {
    // Write mermaid code
    fs.writeFileSync(inputFile, code.trim());

    // Write config
    fs.writeFileSync(configFile, JSON.stringify(MERMAID_CONFIG, null, 2));

    // Find mmdc (mermaid CLI)
    let mmdc = 'mmdc';
    const localMmdc = path.join(__dirname, '..', 'node_modules', '.bin', 'mmdc');
    if (fs.existsSync(localMmdc)) {
      mmdc = localMmdc;
    }

    // Render to PNG
    execSync(
      `"${mmdc}" -i "${inputFile}" -o "${outputFile}" -c "${configFile}" -w ${width} -H ${height} -b ${background}`,
      { stdio: 'pipe' }
    );

    // Read and convert to base64
    const pngBuffer = fs.readFileSync(outputFile);
    const base64 = pngBuffer.toString('base64');

    return `image/png;base64,${base64}`;
  } finally {
    // Cleanup
    [inputFile, outputFile, configFile].forEach((f) => {
      try {
        fs.unlinkSync(f);
      } catch (e) {}
    });
  }
}

/**
 * Create a title slide with Strand branding
 *
 * @param {object} pres - PptxGenJS presentation instance
 * @param {object} options - { title, subtitle, showLogo }
 * @returns {object} The slide
 */
function titleSlide(pres, { title = '', subtitle = '', showLogo = true } = {}) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.pthalo };

  if (showLogo) {
    slide.addImage({
      path: 'assets/logo-white.svg',
      x: 3.5,
      y: 1.5,
      w: 3,
      h: 1.5,
    });
  }

  if (title) {
    slide.addText(title, {
      x: 0.5,
      y: showLogo ? 3.2 : 2,
      w: 9,
      h: 1.5,
      fontSize: 32,
      color: COLORS.white,
      align: 'center',
      fontFace: 'Arial',
      bold: true,
    });
  }

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: showLogo ? 4.5 : 3.5,
      w: 9,
      h: 0.5,
      fontSize: 16,
      color: COLORS.ashBeigeDark,
      align: 'center',
    });
  }

  return slide;
}

/**
 * Create a content slide with title
 *
 * @param {object} pres - PptxGenJS presentation instance
 * @param {object} options - { title, dark }
 * @returns {object} The slide
 */
function contentSlide(pres, { title = '', dark = false } = {}) {
  const slide = pres.addSlide();
  slide.background = { color: dark ? COLORS.pthalo : COLORS.ashBeige };

  if (title) {
    slide.addText(title, {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.8,
      fontSize: 36,
      color: dark ? COLORS.white : COLORS.pthalo,
      bold: true,
      fontFace: 'Arial Black',
    });
  }

  return slide;
}

/**
 * Add bullet points to a slide
 *
 * @param {object} slide - PptxGenJS slide
 * @param {string[]} items - Array of bullet point strings
 * @param {object} options - { x, y, w, h, fontSize, color }
 */
function bullets(slide, items, options = {}) {
  const { x = 0.5, y = 1.5, w = 8.5, h = 3.5, fontSize = 18, color = COLORS.darkSlate } = options;

  const textItems = items.map((text, i) => ({
    text,
    options: { bullet: true, breakLine: i < items.length - 1 },
  }));

  slide.addText(textItems, {
    x,
    y,
    w,
    h,
    fontSize,
    color,
    fontFace: 'Arial',
    valign: 'top',
  });
}

module.exports = {
  COLORS,
  mermaid,
  titleSlide,
  contentSlide,
  bullets,
};
