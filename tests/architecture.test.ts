import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

// AGENTS.md: the simulation must not know about Phaser or the render layer.
test("game.ts does not import Phaser", () => {
  const game = source("web/src/game.ts");
  assert.doesNotMatch(game, /from\s+["']phaser["']/);
  assert.doesNotMatch(game, /from\s+["']\.\/phaser-view["']/);
  assert.doesNotMatch(game, /from\s+["']\.\/scenes\//);
});

test("game.ts does not touch the DOM", () => {
  assert.doesNotMatch(source("web/src/game.ts"), /\b(window|document)\s*\./);
});
