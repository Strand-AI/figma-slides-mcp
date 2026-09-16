# Semantic beta: shared daemon

This worktree is isolated from stable. Stable continues to use its published
stdio MCP server and Figma plugin on port 3055. This beta uses:

- Figma plugin WebSocket: `ws://127.0.0.1:3056`
- per-user daemon socket: `~/.cache/figma-slides-mcp/semantic-beta.sock`
- one shared daemon for every beta Pi main/subagent MCP shim

## Build

```bash
cd /Users/peter-chou/Documents/strand-ai/figma-slides-mcp-semantic-beta
npm install
npm run build:mcp
```

## Run

1. In a dedicated terminal, start the shared daemon and leave it running:

   ```bash
   npm run beta:daemon
   ```

   Stop it with Ctrl-C. The daemon deliberately does not auto-start in the MVP.

2. Import and run the beta Figma plugin using:

   ```text
   mcp/dist/figma-plugin/manifest.json
   ```

   The generated plugin is named **Claude Code Slides Beta** and connects only
   to port 3056. The source manifest intentionally has no invented plugin ID;
   use the identity assigned by Figma's development-plugin flow.

3. Start Pi from this beta worktree:

   ```bash
   pi
   ```

   `.mcp.json` launches only the lightweight stdio shim. Every beta Pi session
   and subagent connects to the same daemon socket rather than binding a plugin
   port.

4. Call `bridge_health` first. It reports shim/daemon/plugin status separately.

## Safety and recovery

- The daemon serializes every plugin operation, including reads/screenshots,
  because raw `execute` can mutate.
- A timed-out operation keeps the execution lane occupied until Figma responds
  or the plugin disconnects. Mutation timeouts are reported as outcome unknown;
  inspect before retrying.
- Only one beta plugin connection is accepted at a time.
- Caches are invalidated on plugin connect/disconnect and mutations; inspection
  entries also expire after 30 seconds.
- Concurrent transport access is supported, but this is not task isolation.
  Prefer one writer per document and inspect again before dependent writes.
- If the lane becomes uncertain indefinitely, stop/restart the daemon and reopen
  the beta plugin. Do not automatically replay a mutation.

## Stable isolation

The beta must not bind port 3055, modify the stable checkout's `.mcp.json`, or
publish over the stable npm tag. Avoid editing the same Figma document through
stable and beta simultaneously.
