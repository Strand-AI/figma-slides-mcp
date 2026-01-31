#!/usr/bin/env bash
# Pre-processes mermaid code blocks in .md files into inline SVGs.
# Usage: ./scripts/preprocess-mermaid.sh input.md > output.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MERMAID_CONFIG="$SCRIPT_DIR/mermaid-config.json"

input="$1"
output_dir=$(mktemp -d)
counter=0

while IFS= read -r line; do
  if [[ "$line" =~ ^\`\`\`mermaid$ ]]; then
    # Start collecting mermaid block
    mermaid_block=""
    while IFS= read -r mline; do
      [[ "$mline" == '```' ]] && break
      mermaid_block+="$mline"$'\n'
    done

    # Write to temp file and render
    counter=$((counter + 1))
    mmd_file="$output_dir/diagram_${counter}.mmd"
    svg_file="$output_dir/diagram_${counter}.svg"
    echo "$mermaid_block" > "$mmd_file"

    if npx mmdc -i "$mmd_file" -o "$svg_file" -b transparent -c "$MERMAID_CONFIG" --quiet 2>/dev/null; then
      # Embed as <img> with base64 data URI — isolates SVG from slide CSS
      b64=$(base64 < "$svg_file" | tr -d '\n')
      echo "<div style=\"display:flex;justify-content:center;margin:10px 0\"><img src=\"data:image/svg+xml;base64,${b64}\" style=\"max-width:100%;max-height:400px\" /></div>"
    else
      # Fallback: keep original code block
      echo '```mermaid'
      echo "$mermaid_block"
      echo '```'
    fi
  else
    echo "$line"
  fi
done < "$input"

rm -rf "$output_dir"
