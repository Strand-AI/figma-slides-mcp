#!/usr/bin/env bash
# Generates dist/index.html listing all slide decks with view/download links.
set -euo pipefail

cat > dist/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Strand AI — Slide Decks</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; background: #f7f7f5; color: #00120a; padding: 60px 40px; max-width: 640px; margin: 0 auto; }
    h1 { font-size: 1.8em; color: #004d3b; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 40px; font-size: 0.95em; }
    .deck { background: #fff; border-radius: 10px; padding: 24px 28px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .deck h2 { font-size: 1.15em; color: #004d3b; margin-bottom: 10px; }
    .deck a { color: #004d3b; text-decoration: none; margin-right: 18px; font-size: 0.9em; font-weight: 500; }
    .deck a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Strand AI — Slide Decks</h1>
  <p class="subtitle">Auto-built from main</p>
EOF

for f in dist/*.html; do
  name=$(basename "$f" .html)
  [ "$name" = "index" ] && continue

  # Capitalize and replace hyphens with spaces
  title=$(echo "$name" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')

  cat >> dist/index.html << DECK
  <div class="deck">
    <h2>${title}</h2>
    <a href="${name}.html">View slides</a>
    <a href="${name}.pdf" download>PDF</a>
    <a href="${name}.pptx" download>PPTX</a>
  </div>
DECK
done

cat >> dist/index.html << 'EOF'
</body>
</html>
EOF
