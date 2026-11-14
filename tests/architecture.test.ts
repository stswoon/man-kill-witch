import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

// AGENTS.md: the simulation must not know about Phaser or the render layer.
describe("architecture", () => {
  test("game.ts does not import Phaser", () => {
    const game = source("web/src/game.ts");
    expect(game).not.toMatch(/from\s+["']phaser["']/);
    expect(game).not.toMatch(/from\s+["']\.\/phaser-view["']/);
    expect(game).not.toMatch(/from\s+["']\.\/scenes\//);
  });

  test("game.ts does not touch the DOM", () => {
    expect(source("web/src/game.ts")).not.toMatch(/\b(window|document)\s*\./);
  });
});
