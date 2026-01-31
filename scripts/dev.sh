#!/usr/bin/env bash
# Dev server with Mermaid preprocessing + live reload.
# Preprocesses .md files into .build/, then runs Marp server on .build/.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/.build"

rm -rf "$BUILD"
mkdir -p "$BUILD"
cp -R "$ROOT/assets" "$BUILD/assets"
cp -R "$ROOT/themes" "$BUILD/themes"

preprocess_all() {
  for f in "$ROOT"/slides/*.md; do
    [ -f "$f" ] || continue
    # Only process Marp decks
    head -5 "$f" | grep -q "marp: true" || continue
    base="$(basename "$f")"
    if grep -q '```mermaid' "$f"; then
      bash "$ROOT/scripts/preprocess-mermaid.sh" "$f" > "$BUILD/$base"
    else
      cp "$f" "$BUILD/$base"
    fi
  done
}

echo "Pre-processing Mermaid diagrams..."
preprocess_all

# Start Marp server in background on .build/
npx marp --server --html --allow-local-files --theme-set themes/ -I "$BUILD" &
MARP_PID=$!

cleanup() {
  kill "$MARP_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo "Watching for changes to *.md files..."
# Use fswatch if available, otherwise poll
if command -v fswatch &>/dev/null; then
  fswatch -o "$ROOT"/slides/*.md | while read -r; do
    echo "Change detected, re-processing..."
    preprocess_all
  done
else
  while true; do
    sleep 2
    changed=false
    for f in "$ROOT"/slides/*.md; do
      [ -f "$f" ] || continue
      head -5 "$f" | grep -q "marp: true" || continue
      base="$(basename "$f")"
      if [ "$f" -nt "$BUILD/$base" ]; then
        changed=true
        break
      fi
    done
    if $changed; then
      echo "Change detected, re-processing..."
      preprocess_all
    fi
  done
fi
