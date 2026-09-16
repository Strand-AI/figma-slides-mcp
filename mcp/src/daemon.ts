import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createConnection, createServer, type Socket } from "node:net";
import { dirname } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import {
  DAEMON_PROTOCOL_VERSION,
  MAX_DAEMON_MESSAGE_BYTES,
  daemonSocketPath,
  encodeMessage,
  type DaemonRequest,
  type DaemonResponse,
} from "./protocol.js";

const WS_PORT = Number.parseInt(process.env.FIGMA_SLIDES_WS_PORT ?? "3056", 10);
const COMMAND_DEADLINE_MS = Number.parseInt(process.env.FIGMA_SLIDES_COMMAND_TIMEOUT_MS ?? "15000", 10);
const CACHE_TTL_MS = Number.parseInt(process.env.FIGMA_SLIDES_CACHE_TTL_MS ?? "30000", 10);
const MAX_QUEUE_LENGTH = 100;

type CacheEntry = { value: unknown; observedAt: number; epoch: number };
type PendingPluginRequest = {
  epoch: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

let pluginSocket: WebSocket | null = null;
let pluginEpoch = 0;
let pluginDocument: { fileName?: string; pageName?: string } | null = null;
let generation = 0;
let queueLength = 0;
let executionLane: Promise<void> = Promise.resolve();
let shuttingDown = false;
const daemonId = randomUUID();
const pendingPluginRequests = new Map<string, PendingPluginRequest>();
let deckCache: CacheEntry | null = null;
const slideCache = new Map<string, CacheEntry>();
const nodeCache = new Map<string, CacheEntry>();
const slideIdByIndex = new Map<number, string>();

function invalidateAll(): void {
  generation++;
  deckCache = null;
  slideCache.clear();
  nodeCache.clear();
  slideIdByIndex.clear();
}

function isFresh(entry: CacheEntry | undefined | null): entry is CacheEntry {
  return !!entry && entry.epoch === pluginEpoch && Date.now() - entry.observedAt < CACHE_TTL_MS;
}

function rememberDeck(slides: unknown): void {
  if (!Array.isArray(slides)) return;
  for (const slide of slides) {
    if (!slide || typeof slide !== "object") continue;
    const index = (slide as { index?: unknown }).index;
    const id = (slide as { id?: unknown }).id;
    if (typeof index === "number" && typeof id === "string") slideIdByIndex.set(index, id);
  }
}

function pluginConnected(): boolean {
  return pluginSocket?.readyState === WebSocket.OPEN;
}

function rejectPendingPluginRequests(reason: string): void {
  for (const [id, pending] of pendingPluginRequests) {
    pending.reject(new Error(reason));
    pendingPluginRequests.delete(id);
  }
}

function sendToPlugin(command: string, params: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!pluginConnected()) {
      reject(new Error("Figma plugin is not connected. Open Claude Code Slides Beta in Figma."));
      return;
    }
    const epoch = pluginEpoch;
    const id = `${daemonId}:${epoch}:${randomUUID()}`;
    pendingPluginRequests.set(id, { epoch, resolve, reject });
    try {
      pluginSocket!.send(JSON.stringify({ id, command, params }));
    } catch (error) {
      pendingPluginRequests.delete(id);
      reject(error);
    }
  });
}

function response(request: DaemonRequest, fields: Omit<DaemonResponse, "version" | "id">): DaemonResponse {
  return { version: DAEMON_PROTOCOL_VERSION, id: request.id, ...fields };
}

function mutatingCommand(command: string): boolean {
  return command === "execute" || command === "resize_nodes" || command === "duplicate_slide";
}

async function dispatch(request: DaemonRequest): Promise<unknown> {
  const { command, params } = request;
  if (command === "daemon_health") {
    return {
      daemon: "responsive",
      daemonId,
      socket: daemonSocketPath(),
      plugin: pluginConnected() ? "connected" : "disconnected",
      pluginEpoch,
      document: pluginDocument,
      generation,
      queueLength,
    };
  }
  if (command === "bridge_health") {
    if (!pluginConnected()) {
      return { daemon: "responsive", daemonId, plugin: "disconnected", port: WS_PORT, pluginEpoch, document: pluginDocument, generation };
    }
    const probe = await sendToPlugin("bridge_health", {});
    if (probe && typeof probe === "object") {
      pluginDocument = {
        fileName: String((probe as { fileName?: unknown }).fileName ?? ""),
        pageName: String((probe as { pageName?: unknown }).pageName ?? ""),
      };
    }
    return { daemon: "responsive", daemonId, plugin: "responsive", port: WS_PORT, pluginEpoch, document: pluginDocument, generation, data: probe };
  }
  if (command === "inspect_deck") {
    if (!params.refresh && isFresh(deckCache)) return { generation, cache: "hit", observedAt: new Date(deckCache.observedAt).toISOString(), slides: deckCache.value };
    const slides = await sendToPlugin("inspect_deck", {});
    deckCache = { value: slides, observedAt: Date.now(), epoch: pluginEpoch };
    rememberDeck(slides);
    return { generation, cache: "miss", observedAt: new Date(deckCache.observedAt).toISOString(), slides };
  }
  if (command === "inspect_slide") {
    const requestedId = typeof params.id === "string" ? params.id : undefined;
    const requestedIndex = typeof params.index === "number" ? params.index : undefined;
    const knownId = requestedId ?? (requestedIndex === undefined ? undefined : slideIdByIndex.get(requestedIndex));
    const cached = knownId ? slideCache.get(knownId) : undefined;
    if (!params.refresh && isFresh(cached)) return { generation, cache: "hit", observedAt: new Date(cached.observedAt).toISOString(), slide: cached.value };
    const slide = await sendToPlugin("inspect_slide", { ...(requestedId ? { id: requestedId } : { index: requestedIndex }) });
    const stableId = slide && typeof slide === "object" ? (slide as { id?: unknown }).id : undefined;
    if (typeof stableId !== "string") throw new Error("Plugin returned inspect_slide data without a stable id");
    const entry = { value: slide, observedAt: Date.now(), epoch: pluginEpoch };
    slideCache.set(stableId, entry);
    const index = (slide as { index?: unknown }).index;
    if (typeof index === "number") slideIdByIndex.set(index, stableId);
    return { generation, cache: "miss", observedAt: new Date(entry.observedAt).toISOString(), slide };
  }
  if (command === "inspect_nodes") {
    const ids = params.ids as string[];
    const key = [...ids].sort().join(",");
    const cached = nodeCache.get(key);
    if (!params.refresh && isFresh(cached)) return { generation, cache: "hit", observedAt: new Date(cached.observedAt).toISOString(), nodes: cached.value };
    const nodes = await sendToPlugin("inspect_nodes", { ids });
    const entry = { value: nodes, observedAt: Date.now(), epoch: pluginEpoch };
    nodeCache.set(key, entry);
    return { generation, cache: "miss", observedAt: new Date(entry.observedAt).toISOString(), nodes };
  }
  if (mutatingCommand(command)) invalidateAll();
  return sendToPlugin(command, params);
}

function enqueue(request: DaemonRequest): Promise<DaemonResponse> {
  if (queueLength >= MAX_QUEUE_LENGTH) return Promise.resolve(response(request, { ok: false, error: `Daemon queue is full (${MAX_QUEUE_LENGTH})` }));
  queueLength++;
  const queuedAt = Date.now();
  let deliver!: (value: DaemonResponse) => void;
  let queueExpired = false;
  const clientResponse = new Promise<DaemonResponse>(resolve => { deliver = resolve; });
  const queueTimer = setTimeout(() => {
    queueExpired = true;
    deliver(response(request, {
      ok: false,
      error: `'${request.command}' was not dispatched because it waited more than ${COMMAND_DEADLINE_MS}ms in the daemon queue.`,
      outcomeUnknown: false,
      queueMs: COMMAND_DEADLINE_MS,
      executionMs: 0,
    }));
  }, COMMAND_DEADLINE_MS);
  executionLane = executionLane.then(async () => {
    clearTimeout(queueTimer);
    if (queueExpired) {
      queueLength--;
      return; // Safe to drop: this request was never dispatched to Figma.
    }
    const startedAt = Date.now();
    let delivered = false;
    const operation = dispatch(request);
    const timer = setTimeout(() => {
      delivered = true;
      deliver(response(request, {
        ok: false,
        error: mutatingCommand(request.command)
          ? `Outcome unknown: '${request.command}' exceeded ${COMMAND_DEADLINE_MS}ms after dispatch. Inspect before retrying.`
          : `'${request.command}' exceeded ${COMMAND_DEADLINE_MS}ms after dispatch.`,
        outcomeUnknown: mutatingCommand(request.command),
        queueMs: startedAt - queuedAt,
        executionMs: COMMAND_DEADLINE_MS,
      }));
    }, COMMAND_DEADLINE_MS);
    try {
      const data = await operation; // Keep the lane occupied even after client timeout.
      clearTimeout(timer);
      if (!delivered) deliver(response(request, { ok: true, data, queueMs: startedAt - queuedAt, executionMs: Date.now() - startedAt }));
    } catch (error) {
      clearTimeout(timer);
      if (!delivered) deliver(response(request, { ok: false, error: error instanceof Error ? error.message : String(error), queueMs: startedAt - queuedAt, executionMs: Date.now() - startedAt }));
    } finally {
      queueLength--;
    }
  }).catch(error => {
    clearTimeout(queueTimer);
    queueLength--;
    if (!queueExpired) deliver(response(request, { ok: false, error: error instanceof Error ? error.message : String(error) }));
  });
  return clientResponse;
}

function validRequest(value: unknown): value is DaemonRequest {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DaemonRequest>;
  return item.version === DAEMON_PROTOCOL_VERSION && typeof item.id === "string" && typeof item.clientId === "string" && typeof item.command === "string" && !!item.params && typeof item.params === "object" && !Array.isArray(item.params);
}

function handleClient(socket: Socket): void {
  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("data", chunk => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > MAX_DAEMON_MESSAGE_BYTES) {
      socket.destroy(new Error("Daemon request exceeds maximum message size"));
      return;
    }
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(line); }
      catch { socket.write(encodeMessage({ version: DAEMON_PROTOCOL_VERSION, id: "invalid", ok: false, error: "Invalid JSON" })); continue; }
      if (!validRequest(parsed)) {
        const id = parsed && typeof parsed === "object" && typeof (parsed as { id?: unknown }).id === "string" ? (parsed as { id: string }).id : "invalid";
        socket.write(encodeMessage({ version: DAEMON_PROTOCOL_VERSION, id, ok: false, error: "Invalid daemon request or protocol version" }));
        continue;
      }
      void enqueue(parsed).then(result => { if (!socket.destroyed) socket.write(encodeMessage(result)); });
    }
  });
  socket.on("error", error => console.error(`[figma-slides-daemon] Client socket error: ${error.message}`));
}

async function socketIsLive(path: string): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection(path);
    const done = (live: boolean) => { socket.destroy(); resolve(live); };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

async function prepareSocket(path: string): Promise<void> {
  const directory = dirname(path);
  const createdDirectory = !existsSync(directory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Only tighten permissions on a directory we created. An override may point
  // into /tmp or another caller-owned directory that the daemon must not chmod.
  if (createdDirectory) chmodSync(directory, 0o700);
  if (!existsSync(path)) return;
  if (await socketIsLive(path)) throw new Error(`A semantic beta daemon is already listening at ${path}`);
  unlinkSync(path);
}

async function main(): Promise<void> {
  if (!Number.isInteger(WS_PORT) || WS_PORT < 1 || WS_PORT > 65535) throw new Error(`Invalid FIGMA_SLIDES_WS_PORT: ${process.env.FIGMA_SLIDES_WS_PORT}`);
  const path = daemonSocketPath();
  await prepareSocket(path);
  const clientServer = createServer(handleClient);
  await new Promise<void>((resolve, reject) => { clientServer.once("error", reject); clientServer.listen(path, resolve); });
  chmodSync(path, 0o600);

  const pluginServer = new WebSocketServer({ host: "127.0.0.1", port: WS_PORT });
  await new Promise<void>((resolve, reject) => { pluginServer.once("listening", resolve); pluginServer.once("error", reject); });
  pluginServer.on("connection", socket => {
    if (pluginConnected()) {
      socket.close(1013, "A beta plugin is already connected");
      return;
    }
    pluginSocket = socket;
    pluginEpoch++;
    pluginDocument = null;
    invalidateAll();
    console.error(`[figma-slides-daemon] Plugin connected (epoch ${pluginEpoch})`);
    socket.on("message", data => {
      try {
        const message = JSON.parse(data.toString());
        const pending = pendingPluginRequests.get(message.id);
        if (!pending || pending.epoch !== pluginEpoch) return;
        pendingPluginRequests.delete(message.id);
        message.success ? pending.resolve(message.data) : pending.reject(new Error(message.error || "Unknown plugin error"));
      } catch (error) { console.error("[figma-slides-daemon] Invalid plugin response:", error); }
    });
    socket.on("close", () => {
      if (pluginSocket !== socket) return;
      pluginSocket = null;
      pluginDocument = null;
      invalidateAll();
      rejectPendingPluginRequests("Figma plugin disconnected");
      console.error(`[figma-slides-daemon] Plugin disconnected (epoch ${pluginEpoch})`);
    });
  });

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    rejectPendingPluginRequests("Daemon shutting down");
    pluginSocket?.close(1001, "Daemon shutting down");
    pluginServer.close();
    clientServer.close(() => { try { if (existsSync(path)) unlinkSync(path); } catch {} process.exit(0); });
    setTimeout(() => process.exit(1), 2000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  console.error(`[figma-slides-daemon] Ready: socket ${path}, plugin ws://127.0.0.1:${WS_PORT}`);
}

main().catch(error => { console.error("[figma-slides-daemon] Fatal:", error); process.exit(1); });
