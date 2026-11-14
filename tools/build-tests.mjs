import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// Node's built-in type stripping cannot run these sources directly: game.ts uses
// parameter properties and extensionless imports. esbuild already ships with the
// project, so the tests are bundled for `node --test` instead.
const SOURCE_DIR = "tests";
const OUT_DIR = ".temp/tests";

const entryPoints = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => join(SOURCE_DIR, name));

if (entryPoints.length === 0) {
  console.error(`no *.test.ts files in ${SOURCE_DIR}/`);
  process.exit(1);
}

await build({
  entryPoints,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outdir: OUT_DIR,
  outExtension: { ".js": ".mjs" },
  sourcemap: "inline",
  logLevel: "warning",
});
