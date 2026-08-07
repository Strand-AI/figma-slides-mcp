// Figma Slides MCP Server
// Bridges Claude Code (via stdio MCP) ↔ Figma Plugin (via WebSocket on :3055)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer, WebSocket } from "ws";
import { execSync } from "child_process";
import { z } from "zod";

const WS_PORT = 3055;
const COMMAND_TIMEOUT_MS = 15_000;

// ── WebSocket bridge to Figma plugin ─────────────────────

let figmaSocket: WebSocket | null = null;
const pendingRequests = new Map<
  string,
  { resolve: (val: unknown) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

function killStaleProcess(): void {
  try {
    const pids = execSync(`lsof -ti :${WS_PORT}`, { encoding: "utf-8" }).trim().split("\n");
    const myPid = process.pid.toString();
    for (const pid of pids) {
      if (pid && pid !== myPid) {
        try {
          const cmd = execSync(`ps -p ${pid} -o command=`, { encoding: "utf-8" }).trim();
          if (cmd.includes("mcp-server")) {
            process.kill(parseInt(pid, 10), "SIGTERM");
            console.error(`[figma-slides-mcp] Killed stale process ${pid}`);
          }
        } catch {}
      }
    }
  } catch {
    // No process on port — that's fine
  }
}

// Port-free window we'll keep retrying the bind within before giving up.
const BIND_RETRY_MS = 5000;
const BIND_RETRY_INTERVAL_MS = 250;

function handlePluginConnection(ws: WebSocket): void {
  console.error(`[figma-slides-mcp] Figma plugin connected`);
  figmaSocket = ws;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(msg.id);
        if (msg.success) {
          pending.resolve(msg.data);
        } else {
          pending.reject(new Error(msg.error || "Unknown plugin error"));
        }
      }
    } catch (e) {
      console.error("[figma-slides-mcp] Failed to parse plugin message:", e);
    }
  });

  ws.on("close", () => {
    console.error(`[figma-slides-mcp] Figma plugin disconnected`);
    if (figmaSocket === ws) figmaSocket = null;
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Figma plugin disconnected"));
      pendingRequests.delete(id);
    }
  });
}

// Bind the WebSocket bridge, retrying on EADDRINUSE with a non-blocking backoff
// so a quick restart can wait out the previous process releasing the port
// without freezing the event loop. Resolves only once the socket is actually
// listening; if the port never frees within BIND_RETRY_MS we exit non-zero
// rather than serve a half-alive server the client would report as healthy.
function startWebSocketServer(): Promise<WebSocketServer> {
  killStaleProcess();

  const deadline = Date.now() + BIND_RETRY_MS;

  return new Promise((resolve) => {
    const attempt = (): void => {
      const wss = new WebSocketServer({ port: WS_PORT });

      wss.once("listening", () => {
        // Only now is the bridge real — wire up steady-state handlers.
        wss.on("connection", handlePluginConnection);
        wss.on("error", (err: NodeJS.ErrnoException) => {
          console.error("[figma-slides-mcp] WebSocket server error:", err.message);
        });
        console.error(`[figma-slides-mcp] WebSocket server listening on ws://localhost:${WS_PORT}`);
        resolve(wss);
      });

      wss.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && Date.now() < deadline) {
          setTimeout(attempt, BIND_RETRY_INTERVAL_MS);
          return;
        }
        // Either the port is still held past the deadline, or a different bind
        // error — fail loudly so the client surfaces a real failure.
        console.error(
          `[figma-slides-mcp] Could not bind port ${WS_PORT} (${err.code ?? err.message}) — another process is holding it. Exiting.`
        );
        process.exit(1);
      });
    };

    attempt();
  });
}

let requestIdCounter = 0;

function sendToPlugin(command: string, params: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!figmaSocket || figmaSocket.readyState !== WebSocket.OPEN) {
      reject(new Error("Figma plugin is not connected. Open the 'Slides MCP Bridge' plugin in Figma Slides."));
      return;
    }

    const id = `req_${++requestIdCounter}`;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Command '${command}' timed out after ${COMMAND_TIMEOUT_MS / 1000}s`));
    }, COMMAND_TIMEOUT_MS);

    pendingRequests.set(id, { resolve, reject, timer });
    figmaSocket.send(JSON.stringify({ id, command, params }));
  });
}

// ── MCP Server ───────────────────────────────────────────

const server = new McpServer({
  name: "figma-slides",
  version: "0.1.0",
});

server.tool(
  "execute",
  `Run JavaScript in the Figma plugin sandbox. The code is the body of an async function with these in scope:
  - figma — the Figma Plugin API global
  - getSlide(index) — returns the slide at the given index (navigates SLIDE_GRID → SLIDE_ROW → SLIDE automatically)
  - findSlides() — returns an array of all SLIDE nodes in presentation order
  - serialize(node) — returns a JSON-friendly summary of a node (id, name, type, x, y, width, height, visible, opacity, characters, fills, childCount)
  - loadFont(family, style?) — shorthand for figma.loadFontAsync({ family, style })

Return a value and it will be sent back as the tool result.`,
  { code: z.string().describe("JavaScript code to execute (body of an async function)") },
  async (params) => {
    try {
      const result = await sendToPlugin("execute", { code: params.code });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) ?? "OK" }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "screenshot_slide",
  "Export a slide as a PNG screenshot. Returns base64-encoded image data.",
  {
    slideIndex: z.number().int().min(0).describe("Slide index to screenshot"),
    scale: z.number().optional().describe("Export scale (default 1, use 0.5 for thumbnails)"),
  },
  async (params) => {
    try {
      const result = (await sendToPlugin("screenshot_slide", params as Record<string, unknown>)) as {
        base64: string;
        format: string;
        slideIndex: number;
      };
      return {
        content: [
          {
            type: "image" as const,
            data: result.base64,
            mimeType: "image/png",
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Start ────────────────────────────────────────────────

async function main() {
  // Await a real bind before announcing stdio, so the client never sees a
  // "healthy" server whose WebSocket bridge failed to come up.
  await startWebSocketServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[figma-slides-mcp] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[figma-slides-mcp] Fatal:", err);
  process.exit(1);
});
