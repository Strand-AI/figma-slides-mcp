import { homedir } from "node:os";
import { join } from "node:path";

export const DAEMON_PROTOCOL_VERSION = 1;
export const MAX_DAEMON_MESSAGE_BYTES = 2 * 1024 * 1024;

export interface DaemonRequest {
  version: number;
  id: string;
  clientId: string;
  command: string;
  params: Record<string, unknown>;
}

export interface DaemonResponse {
  version: number;
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  outcomeUnknown?: boolean;
  queueMs?: number;
  executionMs?: number;
}

export function daemonSocketPath(): string {
  return process.env.FIGMA_SLIDES_DAEMON_SOCKET
    ?? join(homedir(), ".cache", "figma-slides-mcp", "semantic-beta.sock");
}

export function encodeMessage(message: DaemonRequest | DaemonResponse): string {
  return `${JSON.stringify(message)}\n`;
}
