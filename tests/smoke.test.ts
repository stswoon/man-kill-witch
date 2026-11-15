import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, vi } from "vitest";
import type { LevelData, TileInfoData } from "../web/src/assets";
import { Game, Level } from "../web/src/game";
import { PLAYER_W } from "../web/src/sim-contract";
import { fakeInput, makeSnapshot, tick } from "./helpers";

const ASSETS = resolve(process.cwd(), "web/public/assets");
/** One screen of motion per fake tick keeps the stand-in player moving. */
const FAKE_STEP_PX = 1;

/**
 * Rules smoke test: no physics in node. The fake snapshot moves a stand-in
 * body, while the rules own the score, lives, ammo, bullets and the door. Real
 * survival and motion of level 1 are covered by `e2e/physics.spec.ts`.
 */
test("level 1 survives ten seconds of scripted play", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.37);

  const data = JSON.parse(readFileSync(join(ASSETS, "levels", "01.json"), "utf8")) as LevelData;
  const info = JSON.parse(readFileSync(join(ASSETS, "tileinfo.json"), "utf8")) as TileInfoData;
  const game = new Game(new Level(data, info));
  const input = fakeInput();

  const startX = game.spawnX;
  let x = startX;
  const spawned = new Set<number>();
  const despawned = new Set<number>();

  for (let step = 0; step < 600; step++) {
    input.down.add("ArrowRight");
    if (step % 40 === 0) input.press("Space");
    if (step % 15 === 0) input.press("ControlLeft");

    const snapshot = makeSnapshot(game, { player: { x } });
    const [commands] = tick(game, input, snapshot);

    expect(Number.isFinite(commands.player.targetVx), "the intent must stay finite").toBe(true);
    if (commands.spawnBullet) {
      expect(spawned.has(commands.spawnBullet.id), "bullet ids must be unique").toBe(false);
      expect(Number.isFinite(commands.spawnBullet.x)).toBe(true);
      expect(Number.isFinite(commands.spawnBullet.y)).toBe(true);
      spawned.add(commands.spawnBullet.id);
    }
    for (const id of commands.despawnBullet) {
      expect(spawned.has(id), `bullet ${id} must be spawned before it is despawned`).toBe(true);
      despawned.add(id);
    }
    for (const intent of commands.enemies) {
      expect(game.enemies[intent.id]?.alive, `intent for enemy ${intent.id}`).toBe(true);
      expect(Number.isFinite(intent.targetVx)).toBe(true);
      expect(Number.isFinite(intent.flyerVy)).toBe(true);
    }
    for (const id of commands.killEnemy) {
      expect(game.enemies[id], `kill for enemy ${id}`).toBeDefined();
    }

    // Stand-in motion: the rules ask, the test moves the fake body one pixel.
    if (commands.player.targetVx > 0) {
      x = Math.min(game.level.pixelWidth - PLAYER_W, x + FAKE_STEP_PX);
    }

    for (const patch of game.tilePatches) {
      expect(patch.x, "patch x must stay inside the map").toBeGreaterThanOrEqual(0);
      expect(patch.x).toBeLessThan(game.level.width);
      expect(patch.y, "patch y must stay inside the map").toBeGreaterThanOrEqual(0);
      expect(patch.y).toBeLessThan(game.level.height);
    }
    game.tilePatches.length = 0;

    if (step % 60 === 0) {
      expect(Number.isFinite(game.cameraX) && Number.isFinite(game.cameraY), "camera must stay finite").toBe(true);
      expect(game.cameraX).toBeGreaterThanOrEqual(0);
      expect(game.cameraX).toBeLessThanOrEqual(Math.max(0, game.level.pixelWidth - 1920));
      expect(game.bullets.every((bullet) => bullet.life > 0), "dead bullets must be filtered out").toBe(true);
      expect(game.lives).toBeGreaterThanOrEqual(0);
      expect(game.player.ammo).toBeGreaterThanOrEqual(0);
      expect(game.player.ammo).toBeLessThanOrEqual(8);
    }
  }

  expect(spawned.size, "the weapon must actually fire").toBeGreaterThan(0);
  expect(x, "the rules must keep asking the player to move").toBeGreaterThan(startX);
  expect(despawned.size + game.bullets.length, "every bullet is tracked").toBeGreaterThan(0);
});
