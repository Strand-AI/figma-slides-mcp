import * as esbuild from "esbuild";
import { builtinModules } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

// Bundle the per-client MCP stdio shim and shared daemon separately.
const nodeBuildBase = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  external: builtinModules.flatMap((m) => [m, `node:${m}`]),
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire } from "module";',
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
  sourcemap: true,
};
const serverBuild = {
  ...nodeBuildBase,
  entryPoints: [path.join(__dirname, "src/mcp-server.ts")],
  outfile: path.join(__dirname, "dist/mcp-server.mjs"),
};
const daemonBuild = {
  ...nodeBuildBase,
  entryPoints: [path.join(__dirname, "src/daemon.ts")],
  outfile: path.join(__dirname, "dist/daemon.mjs"),
};

// Bundle the Figma plugin sandbox code
const pluginBuild = {
  entryPoints: [path.join(__dirname, "figma-plugin/code.ts")],
  bundle: true,
  platform: "browser",
  target: "es2017",
  format: "iife",
  outfile: path.join(__dirname, "dist/figma-plugin/code.js"),
  sourcemap: false,
};

// Copy static plugin files
function copyPluginFiles() {
  const pluginDist = path.join(__dirname, "dist/figma-plugin");
  const port = process.env.FIGMA_SLIDES_WS_PORT || "3056";
  fs.mkdirSync(pluginDist, { recursive: true });
  for (const file of ["manifest.json", "ui.html"]) {
    const source = fs.readFileSync(path.join(__dirname, "figma-plugin", file), "utf8");
    fs.writeFileSync(path.join(pluginDist, file), source.replaceAll("__FIGMA_SLIDES_WS_PORT__", port));
  }
  console.log(`Copied plugin static files (WebSocket port ${port})`);
}

async function build() {
  if (watch) {
    const serverCtx = await esbuild.context(serverBuild);
    const daemonCtx = await esbuild.context(daemonBuild);
    const pluginCtx = await esbuild.context(pluginBuild);
    await serverCtx.watch();
    await daemonCtx.watch();
    await pluginCtx.watch();
    copyPluginFiles();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(serverBuild);
    await esbuild.build(daemonBuild);
    await esbuild.build(pluginBuild);
    copyPluginFiles();
    // Make server executable
    fs.chmodSync(path.join(__dirname, "dist/mcp-server.mjs"), 0o755);
    fs.chmodSync(path.join(__dirname, "dist/daemon.mjs"), 0o755);
    console.log("Build complete");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
