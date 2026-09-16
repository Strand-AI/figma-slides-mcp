// Lightweight per-client MCP stdio shim for the shared semantic beta daemon.
import { randomUUID } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  DAEMON_PROTOCOL_VERSION,
  daemonSocketPath,
  encodeMessage,
  type DaemonRequest,
  type DaemonResponse,
} from "./protocol.js";

const CLIENT_ID = process.env.PI_SESSION_ID ?? `stdio-${process.pid}-${randomUUID()}`;
const MAX_RESPONSE_BUFFER_BYTES = 64 * 1024 * 1024;

class DaemonClient {
  private socket: Socket | null = null;
  private connecting: Promise<Socket> | null = null;
  private buffer = "";
  private pending = new Map<string, { resolve: (value: DaemonResponse) => void; reject: (error: Error) => void }>();

  private async connect(): Promise<Socket> {
    if (this.socket && !this.socket.destroyed) return this.socket;
    if (this.connecting) return this.connecting;
    this.connecting = new Promise<Socket>((resolve, reject) => {
      const socket = createConnection(daemonSocketPath());
      const fail = (error: Error) => { this.connecting = null; socket.destroy(); reject(new Error(`Semantic beta daemon unavailable at ${daemonSocketPath()}: ${error.message}. Start it with npm run beta:daemon.`)); };
      socket.once("error", fail);
      socket.once("connect", () => {
        socket.off("error", fail);
        socket.on("error", error => this.disconnect(new Error(`Daemon connection error: ${error.message}`)));
        socket.on("close", () => this.disconnect(new Error("Daemon connection closed; a dispatched mutation may have an unknown outcome.")));
        socket.on("data", data => this.onData(String(data)));
        this.socket = socket;
        this.connecting = null;
        resolve(socket);
      });
    });
    return this.connecting;
  }

  private disconnect(error: Error): void {
    const socket = this.socket;
    this.socket = null;
    this.connecting = null;
    if (socket && !socket.destroyed) socket.destroy();
    for (const [id, pending] of this.pending) {
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    if (Buffer.byteLength(this.buffer) > MAX_RESPONSE_BUFFER_BYTES) {
      this.disconnect(new Error("Daemon response exceeded 64 MiB safety limit"));
      return;
    }
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.trim()) continue;
      let response: DaemonResponse;
      try { response = JSON.parse(line) as DaemonResponse; }
      catch { this.disconnect(new Error("Daemon returned invalid JSON")); return; }
      const pending = this.pending.get(response.id);
      if (!pending) continue;
      this.pending.delete(response.id);
      pending.resolve(response);
    }
  }

  async request(command: string, params: Record<string, unknown>): Promise<DaemonResponse> {
    const socket = await this.connect();
    const id = randomUUID();
    const request: DaemonRequest = { version: DAEMON_PROTOCOL_VERSION, id, clientId: CLIENT_ID, command, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      socket.write(encodeMessage(request), error => {
        if (!error) return;
        this.pending.delete(id);
        reject(error);
      });
    });
  }
}

const daemon = new DaemonClient();
function textResult(value: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) ?? "OK" }] }; }
function errorResult(error: unknown) { return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true as const }; }
async function call(command: string, params: Record<string, unknown>) {
  try {
    const result = await daemon.request(command, params);
    if (!result.ok) return errorResult(result.error ?? "Unknown daemon error");
    return textResult({ ...((result.data && typeof result.data === "object" && !Array.isArray(result.data)) ? result.data as Record<string, unknown> : { data: result.data }), queueMs: result.queueMs, executionMs: result.executionMs });
  } catch (error) { return errorResult(error); }
}

const selector = z.object({ id: z.string().min(1).optional(), index: z.number().int().min(0).optional() }).refine(value => (value.id !== undefined) !== (value.index !== undefined), { message: "Provide exactly one of id or index" });
const server = new McpServer({ name: "figma-slides-semantic-beta-shim", version: "0.3.0-beta.1" });

server.tool("bridge_health", "Report the stdio shim, shared daemon, and Figma plugin states separately.", {}, async () => {
  try {
    const result = await daemon.request("bridge_health", {});
    return result.ok ? textResult({ shim: "responsive", clientId: CLIENT_ID, ...(result.data as Record<string, unknown>), queueMs: result.queueMs, executionMs: result.executionMs }) : textResult({ shim: "responsive", daemon: "responsive", plugin: "unresponsive", error: result.error });
  } catch (error) {
    return textResult({ shim: "responsive", daemon: "disconnected", plugin: "unknown", error: error instanceof Error ? error.message : String(error) });
  }
});
server.tool("inspect_deck", "List slides in presentation order with stable IDs, inferred titles, and skipped state. Shared daemon cache TTL is 30 seconds.", { refresh: z.boolean().optional() }, params => call("inspect_deck", params));
server.tool("inspect_slide", "Inspect one slide by stable ID or presentation index. Provide exactly one selector. id must be a presentation slide ID from inspect_deck, not a child node ID; use inspect_nodes for arbitrary nodes. Shared daemon cache TTL is 30 seconds.", { id: z.string().min(1).optional(), index: z.number().int().min(0).optional(), refresh: z.boolean().optional() }, params => { const parsed = selector.safeParse(params); return parsed.success ? call("inspect_slide", params) : Promise.resolve(errorResult(parsed.error.message)); });
server.tool("inspect_nodes", "Batch-inspect up to 100 nodes by stable IDs.", { ids: z.array(z.string().min(1)).min(1).max(100), refresh: z.boolean().optional() }, params => call("inspect_nodes", params));
server.registerTool("resize_nodes", {
  description: "Resize supported nodes using resize(), returning requested and measured dimensions per node. Args: { nodes: [{ id, width, height }] } — e.g. { \"nodes\": [{ \"id\": \"1:217\", \"width\": 800, \"height\": 120 }] }. SLIDE, TEXT, and auto-layout nodes are rejected individually with a reason; remaining nodes still resize and the result reports partial: true.",
  inputSchema: z.object({ nodes: z.array(z.object({ id: z.string().min(1), width: z.number().positive(), height: z.number().positive() }).strict()).min(1).max(100) }).strict(),
}, params => call("resize_nodes", params));
server.tool("duplicate_slide", "Duplicate one slide immediately after its source. Provide exactly one selector. id must be a presentation slide ID from inspect_deck, not a child node ID; arbitrary nodes cannot be duplicated with this tool. Never retry automatically after timeout or transport loss; inspect_deck first.", { id: z.string().min(1).optional(), index: z.number().int().min(0).optional() }, params => { const parsed = selector.safeParse(params); return parsed.success ? call("duplicate_slide", params) : Promise.resolve(errorResult(parsed.error.message)); });
server.tool("execute", `Run arbitrary JavaScript in the Figma plugin sandbox. Shared caches are invalidated before every attempt; never automatically retry after timeout. The async function body receives:
- figma — Figma Plugin API
- getSlide(index) — presentation-order slide lookup
- findSlides() — all slides in presentation order
- serialize(node) — compact node summary
- loadFont(family, style?) — font loader`, { code: z.string() }, params => call("execute", params));
server.registerTool("screenshot_slide", {
  description: "Export one presentation slide as PNG. Provide exactly one selector: { id } (stable slide id from inspect_deck), { index } (presentation position), or { slideIndex } (legacy alias for index). Args: { id?: \"1:42\", index?: 0, slideIndex?: 0, scale?: 0.5 } — e.g. { \"id\": \"1:42\", \"scale\": 0.5 } or { \"index\": 0 }. An id must name a slide, not a child node; scale 0.5 is recommended for inspection.",
  inputSchema: z.object({ id: z.string().min(1).optional(), index: z.number().int().min(0).optional(), slideIndex: z.number().int().min(0).optional(), scale: z.number().positive().max(4).optional() }).strict(),
}, async params => {
  const selectorCount = [params.id !== undefined, params.index !== undefined, params.slideIndex !== undefined].filter(Boolean).length;
  if (selectorCount !== 1) return errorResult("Provide exactly one of id, index, or slideIndex (slideIndex is a legacy alias for index)");
  try {
    const result = await daemon.request("screenshot_slide", { id: params.id, index: params.index ?? params.slideIndex, scale: params.scale });
    if (!result.ok) return errorResult(result.error ?? "Unknown daemon error");
    const image = result.data as { base64?: unknown };
    if (typeof image?.base64 !== "string") return errorResult("Daemon returned screenshot data without base64 image content");
    return { content: [{ type: "image" as const, data: image.base64, mimeType: "image/png" }] };
  } catch (error) { return errorResult(error); }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error(`[figma-slides-mcp] Semantic beta stdio shim ready (client ${CLIENT_ID}, daemon ${daemonSocketPath()})`);
}
main().catch(error => { console.error("[figma-slides-mcp] Fatal:", error); process.exit(1); });
