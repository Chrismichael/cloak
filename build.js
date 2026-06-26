// build.js
// Bundles the ES-module sources (which import @huggingface/transformers) into
// self-contained files Chrome can load, and assembles the dist/ folder that you
// load unpacked or zip for the Web Store.
//
// Why bundling is required: Chrome MV3 forbids remote code, and bare module
// specifiers like "@huggingface/transformers" can't be resolved by the browser.
// esbuild inlines the library so everything ships inside the package.

import esbuild from "esbuild";
import { cp, mkdir, rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const watch = process.argv.includes("--watch");
const OUT = "dist";

const entryPoints = {
  "background": "background.js",
  "src/offscreen": "src/offscreen.js",
  "src/popup": "src/popup.js",
};

async function copyStatic() {
  await mkdir(OUT, { recursive: true });
  // static files copied verbatim
  const statics = [
    "manifest.json",
    "src/popup.html",
    "src/popup.css",
    "src/offscreen.html",
    "icons",
    "models",
  ];
  for (const s of statics) {
    if (!existsSync(s)) {
      console.warn(`  ⚠ skipping missing ${s} (run 'npm run fetch-model' for models)`);
      continue;
    }
    await cp(s, path.join(OUT, s), { recursive: true });
  }
}

async function build() {
  await rm(OUT, { recursive: true, force: true });
  await copyStatic();

  const ctx = await esbuild.context({
    entryPoints: Object.fromEntries(
      Object.entries(entryPoints).map(([out, src]) => [path.join(OUT, out), src])
    ),
    bundle: true,
    format: "esm",
    target: "chrome116",
    platform: "browser",
    outdir: ".",
    outbase: ".",
    splitting: false,
    sourcemap: false,
    // Transformers.js references node-only modules behind feature checks; stub them.
    external: ["onnxruntime-node", "sharp", "fs", "path", "url"],
    logLevel: "info",
  });

  if (watch) {
    await ctx.watch();
    console.log("watching…");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("\n✓ Built to dist/. Load that folder via chrome://extensions (Developer mode → Load unpacked).");
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
