# figma-slides-mcp

[![npm version](https://img.shields.io/npm/v/figma-slides-mcp.svg)](https://www.npmjs.com/package/figma-slides-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io)

[MCP server](https://modelcontextprotocol.io/) for controlling [Figma Slides](https://www.figma.com/slides/) — create, edit, and screenshot slides from any AI assistant that supports MCP.

## How It Works

```
AI Assistant  ←MCP→  MCP Server  ←WebSocket :3055→  Figma Plugin  ←Plugin API→  Figma Slides
```

The MCP server communicates with a Figma plugin running inside your Figma Slides file. The plugin executes JavaScript in the Figma plugin sandbox and returns results.

## Prerequisites

- Node.js 18+
- A Figma account with access to Figma Slides

## Setup

### 1. Connect to your MCP client

<details open>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add figma-slides -- npx figma-slides-mcp
```

Or add to your project's `.mcp.json`:
```json
{
  "mcpServers": {
    "figma-slides": {
      "command": "npx",
      "args": ["figma-slides-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code</strong></summary>

```bash
code --add-mcp '{"name":"figma-slides","command":"npx","args":["figma-slides-mcp"]}'
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "figma-slides": {
      "command": "npx",
      "args": ["figma-slides-mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Desktop / Other MCP Clients</strong></summary>

Any MCP-compatible client can use figma-slides-mcp:
```json
{
  "mcpServers": {
    "figma-slides": {
      "command": "npx",
      "args": ["figma-slides-mcp"]
    }
  }
}
```

</details>

### 2. Load the Figma plugin

1. Download the [latest plugin release](https://github.com/Strand-AI/figma-slides-mcp/releases/latest/download/figma-plugin.zip) and unzip it
2. In Figma, open a Slides file
3. Go to **Plugins > Development > Import plugin from manifest...**
4. Select the `manifest.json` from the unzipped folder
5. Run the plugin — it connects to the MCP server via WebSocket on port 3055

## MCP Tools

### `execute`

Run JavaScript in the Figma plugin sandbox. Has access to the full [`figma` Plugin API](https://www.figma.com/plugin-docs/api/api-reference/) plus these helpers:

| Helper | Description |
|--------|-------------|
| `getSlide(index?)` | Get a slide by 0-based index (defaults to current slide) |
| `findSlides()` | Get all slides in the presentation |
| `serialize(node?)` | Serialize a node (or the whole page) to a JSON summary |
| `loadFont(family, style?)` | Load a font before setting text (style defaults to `"Regular"`) |

### `screenshot_slide`

Export a slide as PNG and return it as a base64 image.

## Development

```bash
git clone https://github.com/Strand-AI/figma-slides-mcp.git
cd figma-slides-mcp
npm install
npm run build:mcp    # Build MCP server + Figma plugin
npm run dev:mcp      # Watch mode for MCP builds
```

## License

MIT — see [LICENSE](LICENSE).
