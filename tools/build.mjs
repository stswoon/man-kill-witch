#!/usr/bin/env node
// Build the playable game into build/: bundle, index.html and static assets.
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "build");
const WATCH = process.argv.includes("--watch");

const options = {
  entryPoints: [join(ROOT, "web/src/main.ts")],
  outfile: join(OUT_DIR, "bundle.js"),
  bundle: true,
  format: "esm",
  target: "es2020",
};

async function copyStatic() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  await cp(join(ROOT, "web/index.html"), join(OUT_DIR, "index.html"));
  // public/ is served from the root, so its entries go next to index.html.
  for (const entry of await readdir(join(ROOT, "web/public"))) {
    await cp(join(ROOT, "web/public", entry), join(OUT_DIR, entry), { recursive: true });
  }
}

await copyStatic();

if (WATCH) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching web/src -> build/bundle.js (restart to pick up index.html or assets)");
} else {
  await build(options);
}
