import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import type { LevelData, TileInfoData } from "../web/src/assets";
import { Game, Level } from "../web/src/game";
import { fakeInput, tick } from "./helpers";

const ASSETS = resolve(process.cwd(), "web/public/assets");

test("level 1 survives ten seconds of scripted play", (context) => {
  context.mock.method(Math, "random", () => 0.37);

  const data = JSON.parse(readFileSync(join(ASSETS, "levels", "01.json"), "utf8")) as LevelData;
  const info = JSON.parse(readFileSync(join(ASSETS, "tileinfo.json"), "utf8")) as TileInfoData;
  const game = new Game(new Level(data, info));
  const input = fakeInput();
  const startX = game.player.x;

  for (let step = 0; step < 600; step++) {
    input.down.add("ArrowRight");
    if (step % 40 === 0) input.press("Space");
    if (step % 15 === 0) input.press("ControlLeft");
    tick(game, input, 1);

    if (step % 60 === 0) {
      assert.ok(Number.isFinite(game.player.x), "player x must stay finite");
      assert.ok(Number.isFinite(game.player.y), "player y must stay finite");
      assert.ok(game.player.x >= 0 && game.player.x <= game.level.pixelWidth, "player must stay inside the level");
      assert.ok(Number.isFinite(game.cameraX) && Number.isFinite(game.cameraY), "camera must stay finite");
      assert.ok(game.bullets.every((bullet) => bullet.life > 0), "dead bullets must be filtered out");
    }
  }

  assert.ok(
    game.player.x !== startX || game.lives < 3,
    "the player must either move or lose a life — otherwise the input is ignored",
  );
});
