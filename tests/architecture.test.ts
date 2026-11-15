import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

  test("game.ts does not import the Arcade layer", () => {
    const game = source("web/src/game.ts");
    expect(game).not.toMatch(/from\s+["']\.\/arcade\//);
    expect(game).not.toMatch(/from\s+["']\.\.\/arcade\//);
  });

  test("the shared contract stays free of Phaser", () => {
    const contract = source("web/src/sim-contract.ts");
    expect(contract).not.toMatch(/from\s+["']phaser["']/);
    expect(contract).not.toMatch(/from\s+["']\.\/arcade\//);
    expect(contract).not.toMatch(/from\s+["']\.\/game["']/);
  });

  test("game.ts does not touch the DOM", () => {
    expect(source("web/src/game.ts")).not.toMatch(/\b(window|document)\s*\./);
  });

  test("bot modules stay free of Phaser and the render layer", () => {
    const dir = resolve(process.cwd(), "web/src/bot");
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, file), "utf8");
      expect(text, file).not.toMatch(/from\s+["']phaser["']/);
      expect(text, file).not.toMatch(/phaser-view|scenes\//);
    }
  });
});
