#!/usr/bin/env node
/**
 * PPTX Dev Server
 *
 * Watches for changes to slide definition files, regenerates PPTX,
 * converts to PDF for browser preview, and auto-reloads.
 *
 * Usage: node scripts/pptx-dev.js [slide-file.js]
 *
 * Requires LibreOffice for PDF conversion:
 *   brew install --cask libreoffice
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const SLIDES_DIR = path.join(__dirname, '..', 'decks');

// Ensure directories exist
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
if (!fs.existsSync(SLIDES_DIR)) fs.mkdirSync(SLIDES_DIR, { recursive: true });

// Check for LibreOffice
let SOFFICE_PATH = null;
const possiblePaths = [
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
];
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    SOFFICE_PATH = p;
    break;
  }
}
try {
  if (!SOFFICE_PATH) {
    SOFFICE_PATH = execSync('which soffice', { encoding: 'utf-8' }).trim();
  }
} catch (e) {
  // Not found
}

// Track connected SSE clients for live reload
const clients = new Set();

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function notifyClients() {
  clients.forEach(res => {
    res.write('data: reload\n\n');
  });
}

async function buildDeck(deckFile) {
  const basename = path.basename(deckFile, '.js');
  const pptxPath = path.join(DIST_DIR, `${basename}.pptx`);
  const pdfPath = path.join(DIST_DIR, `${basename}.pdf`);

  try {
    // Clear require cache to pick up changes
    delete require.cache[require.resolve(deckFile)];

    log(`Building ${basename}...`);

    // Run the deck file to generate PPTX
    const deckModule = require(deckFile);
    if (typeof deckModule.build === 'function') {
      await deckModule.build(pptxPath);
    } else if (typeof deckModule === 'function') {
      await deckModule(pptxPath);
    } else {
      log(`Warning: ${deckFile} doesn't export a build function`);
      return null;
    }

    log(`Generated ${pptxPath}`);

    // Convert to PDF for preview
    if (SOFFICE_PATH) {
      log(`Converting to PDF...`);
      execSync(`"${SOFFICE_PATH}" --headless --convert-to pdf --outdir "${DIST_DIR}" "${pptxPath}"`, {
        stdio: 'pipe'
      });
      log(`Ready: ${pdfPath}`);
    } else {
      log(`PPTX ready (no PDF preview - install LibreOffice: brew install --cask libreoffice)`);
    }

    notifyClients();
    return SOFFICE_PATH ? pdfPath : pptxPath;
  } catch (err) {
    log(`Error: ${err.message}`);
    console.error(err.stack);
    return null;
  }
}

function startServer(port = 3000) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    // SSE endpoint for live reload
    if (url.pathname === '/__reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write('data: connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    // Serve index page
    if (url.pathname === '/' || url.pathname === '/index.html') {
      // Find decks - prefer PDF, fall back to PPTX
      const files = fs.readdirSync(DIST_DIR);
      const pdfDecks = files.filter(f => f.endsWith('.pdf')).map(f => f.replace('.pdf', ''));
      const pptxDecks = files.filter(f => f.endsWith('.pptx')).map(f => f.replace('.pptx', ''));
      const decks = [...new Set([...pdfDecks, ...pptxDecks])];

      const getDeckInfo = (name) => {
        const hasPdf = pdfDecks.includes(name);
        const pptxPath = path.join(DIST_DIR, `${name}.pptx`);
        const pdfPath = path.join(DIST_DIR, `${name}.pdf`);
        const filePath = hasPdf ? pdfPath : pptxPath;
        return {
          name,
          hasPdf,
          mtime: fs.existsSync(filePath) ? fs.statSync(filePath).mtime.toLocaleString() : 'N/A'
        };
      };

      const deckInfos = decks.map(getDeckInfo);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Strand AI Decks</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #F2F1ED; color: #00120A; }
    h1 { color: #004D3B; }
    a { color: #004D3B; }
    ul { list-style: none; padding: 0; }
    li { margin: 10px 0; padding: 15px; background: white; border-radius: 8px; }
    li a { text-decoration: none; font-size: 1.2em; }
    .meta { color: #666; font-size: 0.9em; margin-top: 5px; }
    .download { margin-left: 10px; font-size: 0.9em; }
    .warning { background: #FFF3CD; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .warning code { background: #E9ECEF; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Strand AI Decks</h1>
  ${!SOFFICE_PATH ? '<div class="warning"><strong>PDF preview unavailable.</strong> Install LibreOffice for in-browser preview:<br><code>brew install --cask libreoffice</code></div>' : ''}
  <ul>
    ${deckInfos.map(d => `<li>
      ${d.hasPdf ? `<a href="/view/${d.name}">${d.name}</a>` : `<span style="color:#666">${d.name}</span>`}
      ${d.hasPdf ? `<a class="download" href="/present/${d.name}">Presenter</a>` : ''}
      <a class="download" href="/${d.name}.pptx" download>PPTX</a>
      <div class="meta">Last modified: ${d.mtime}</div>
    </li>`).join('\n    ')}
  </ul>
  ${decks.length === 0 ? '<p>No decks yet. Create a .js file in <code>decks/</code> to get started.</p>' : ''}
  <script>
    const es = new EventSource('/__reload');
    es.onmessage = () => location.reload();
  </script>
</body>
</html>`);
      return;
    }

    // Serve PDF viewer
    if (url.pathname.startsWith('/view/')) {
      const deckName = url.pathname.replace('/view/', '');
      const pdfPath = path.join(DIST_DIR, `${deckName}.pdf`);

      if (!fs.existsSync(pdfPath)) {
        res.writeHead(404);
        res.end('Deck not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>${deckName} - Strand AI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a1a; }
    iframe { width: 100vw; height: 100vh; border: none; }
    .hint { position: fixed; bottom: 10px; right: 10px; color: #666; font-family: system-ui; font-size: 12px; }
    .hint a { color: #888; }
  </style>
</head>
<body>
  <iframe src="/pdf/${deckName}.pdf"></iframe>
  <div class="hint">Press <strong>P</strong> for presenter view | <a href="/present/${deckName}">Open presenter view</a></div>
  <script>
    const es = new EventSource('/__reload');
    es.onmessage = () => location.reload();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        window.open('/present/${deckName}', 'presenter', 'width=1200,height=800');
      }
    });
  </script>
</body>
</html>`);
      return;
    }

    // Serve presenter view
    if (url.pathname.startsWith('/present/')) {
      const deckName = url.pathname.replace('/present/', '');
      const pdfPath = path.join(DIST_DIR, `${deckName}.pdf`);
      const deckFile = path.join(SLIDES_DIR, `${deckName}.js`);

      if (!fs.existsSync(pdfPath)) {
        res.writeHead(404);
        res.end('Deck not found');
        return;
      }

      // Get speaker notes from deck file
      let notes = [];
      try {
        delete require.cache[require.resolve(deckFile)];
        const deckModule = require(deckFile);
        notes = deckModule.notes || [];
      } catch (e) {
        // No notes available
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Presenter: ${deckName}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a1a; color: #fff; font-family: system-ui, sans-serif; height: 100vh; overflow: hidden; }
    .container { display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: auto 1fr auto; height: 100vh; gap: 10px; padding: 10px; }
    .header { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #004D3B; border-radius: 8px; }
    .header h1 { font-size: 18px; font-weight: 500; }
    .timer { font-size: 24px; font-family: monospace; }
    .current-slide { background: #2a2a2a; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .current-slide canvas { max-width: 100%; max-height: 100%; }
    .sidebar { display: flex; flex-direction: column; gap: 10px; }
    .next-slide { background: #2a2a2a; border-radius: 8px; flex: 0 0 200px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .next-slide canvas { max-width: 100%; max-height: 100%; }
    .next-label { position: absolute; top: 5px; left: 10px; font-size: 12px; color: #888; }
    .notes { background: #2a2a2a; border-radius: 8px; flex: 1; padding: 20px; overflow-y: auto; }
    .notes h3 { color: #004D3B; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
    .notes-content { font-size: 16px; line-height: 1.6; white-space: pre-wrap; color: #F2F1ED; }
    .controls { grid-column: 1 / -1; display: flex; justify-content: center; gap: 20px; padding: 10px; }
    .controls button { background: #004D3B; color: white; border: none; padding: 10px 30px; border-radius: 8px; font-size: 16px; cursor: pointer; }
    .controls button:hover { background: #006B52; }
    .controls button:disabled { background: #333; cursor: not-allowed; }
    .slide-counter { display: flex; align-items: center; gap: 10px; font-size: 18px; }
    .relative { position: relative; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${deckName}</h1>
      <div class="timer" id="timer">00:00:00</div>
    </div>
    <div class="current-slide" id="currentSlide"></div>
    <div class="sidebar">
      <div class="next-slide relative" id="nextSlide">
        <span class="next-label">NEXT</span>
      </div>
      <div class="notes">
        <h3>Speaker Notes</h3>
        <div class="notes-content" id="notes">No notes for this slide.</div>
      </div>
    </div>
    <div class="controls">
      <button id="prevBtn" onclick="prevSlide()">← Previous</button>
      <div class="slide-counter">
        <span id="slideNum">1</span> / <span id="totalSlides">?</span>
      </div>
      <button id="nextBtn" onclick="nextSlide()">Next →</button>
    </div>
  </div>

  <script>
    const notes = ${JSON.stringify(notes)};
    let pdfDoc = null;
    let currentPage = 1;
    let totalPages = 0;
    let startTime = Date.now();

    // Timer
    setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      document.getElementById('timer').textContent = h + ':' + m + ':' + s;
    }, 1000);

    // Load PDF
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    pdfjsLib.getDocument('/pdf/${deckName}.pdf').promise.then(pdf => {
      pdfDoc = pdf;
      totalPages = pdf.numPages;
      document.getElementById('totalSlides').textContent = totalPages;
      renderSlide(1);
    });

    async function renderSlide(num) {
      currentPage = num;
      document.getElementById('slideNum').textContent = num;
      document.getElementById('prevBtn').disabled = num <= 1;
      document.getElementById('nextBtn').disabled = num >= totalPages;

      // Render current slide
      const page = await pdfDoc.getPage(num);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

      const container = document.getElementById('currentSlide');
      container.innerHTML = '';
      container.appendChild(canvas);

      // Render next slide preview
      const nextContainer = document.getElementById('nextSlide');
      nextContainer.innerHTML = '<span class="next-label">NEXT</span>';
      if (num < totalPages) {
        const nextPage = await pdfDoc.getPage(num + 1);
        const nextScale = 0.8;
        const nextViewport = nextPage.getViewport({ scale: nextScale });
        const nextCanvas = document.createElement('canvas');
        nextCanvas.width = nextViewport.width;
        nextCanvas.height = nextViewport.height;
        await nextPage.render({ canvasContext: nextCanvas.getContext('2d'), viewport: nextViewport }).promise;
        nextContainer.appendChild(nextCanvas);
      } else {
        nextContainer.innerHTML += '<div style="color:#666;padding:20px;">End of presentation</div>';
      }

      // Update notes
      const noteContent = notes[num - 1] || 'No notes for this slide.';
      document.getElementById('notes').textContent = noteContent;
    }

    function nextSlide() {
      if (currentPage < totalPages) renderSlide(currentPage + 1);
    }

    function prevSlide() {
      if (currentPage > 1) renderSlide(currentPage - 1);
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      }
    });

    // Live reload
    const es = new EventSource('/__reload');
    es.onmessage = () => location.reload();
  </script>
</body>
</html>`);
      return;
    }

    // Serve PDF files
    if (url.pathname.startsWith('/pdf/')) {
      const filename = url.pathname.replace('/pdf/', '');
      const filePath = path.join(DIST_DIR, filename);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Serve static files from dist
    const filePath = path.join(DIST_DIR, url.pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentTypes = {
        '.pdf': 'application/pdf',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, () => {
    log(`Server running at http://localhost:${port}`);
  });

  return server;
}

function watchDecks() {
  log(`Watching ${SLIDES_DIR} for changes...`);

  // Build all decks initially
  const deckFiles = fs.readdirSync(SLIDES_DIR).filter(f => f.endsWith('.js'));
  deckFiles.forEach(f => buildDeck(path.join(SLIDES_DIR, f)));

  // Watch for changes
  fs.watch(SLIDES_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.js')) return;

    const deckFile = path.join(SLIDES_DIR, filename);
    if (fs.existsSync(deckFile)) {
      // Debounce
      if (watchDecks.timeout) clearTimeout(watchDecks.timeout);
      watchDecks.timeout = setTimeout(() => buildDeck(deckFile), 100);
    }
  });
}

// Main
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
PPTX Dev Server

Usage:
  npm run pptx:dev              Start dev server, watch decks/ folder
  npm run pptx:build [file.js]  Build a specific deck

Create deck files in decks/ folder. Example:

  // decks/pitch.js
  const pptxgen = require('pptxgenjs');

  module.exports.build = async (outputPath) => {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';

    let slide = pres.addSlide();
    slide.background = { color: '004D3B' };
    slide.addText('Strand AI', {
      x: 0.5, y: 2, w: 9, h: 1.5,
      fontSize: 44, color: 'FFFFFF', align: 'center'
    });

    await pres.writeFile({ fileName: outputPath });
  };
`);
  process.exit(0);
}

startServer(3000);
watchDecks();
