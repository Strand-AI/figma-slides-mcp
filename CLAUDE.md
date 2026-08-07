# figma-slides-mcp

MCP server + Figma plugin for controlling Figma Slides from any MCP-compatible AI assistant.

## Architecture

- **`mcp/`** — MCP server and Figma plugin source. The server bridges MCP clients and the Figma plugin sandbox via WebSocket on `:3055`.
- **`assets/`** — Logos, fonts, and images available for use in slides.

## Important: Figma Slides API Gotchas

Before doing ANY work with Figma slides (editing, reviewing, creating, debugging), read the `/figma-slides-api` skill (`.claude/skills/figma-slides-api/SKILL.md`). It documents critical API pitfalls — e.g. using `visible` instead of `isSkippedSlide` to hide slides will silently break presentations.

## MCP Server

The `figma-slides` MCP server requires the "Claude Code Slides" plugin running in Figma.

**Tools:**
- `execute` — Run JavaScript in the Figma plugin sandbox (access to `figma` API, `getSlide()`, `findSlides()`, `serialize()`, `loadFont()`)
- `screenshot_slide` — Export a slide as PNG

**Config** (`.mcp.json`):
```json
{
  "mcpServers": {
    "figma-slides-dev": {
      "command": "node",
      "args": ["mcp/dist/mcp-server.mjs"]
    }
  }
}
```

## Local Dev

```bash
npm install            # Install dependencies
npm run build:mcp      # Build MCP server + Figma plugin
npm run dev:mcp        # Watch mode for MCP builds
```

The checked-in `.mcp.json` registers the server as `figma-slides-dev`, running
`node mcp/dist/mcp-server.mjs` directly, so run `npm run build:mcp` before
starting an MCP client inside this repo. (Using `npx @strand-ai/figma-slides-mcp`
here would resolve to this package's own bin, which npm does not link.)
