import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TILE } from "../web/src/assets";
import { Bullet, Game, type Level } from "../web/src/game";
import {
  AMMO,
  DOOR,
  GEM_100,
  GEM_250,
  GEM_500,
  SPAWN,
  SOLID,
  fakeInput,
  makeArena,
  tick,
} from "./helpers";

const SPAWN_X = 2 * TILE + 2;
const SPAWN_Y = 11 * TILE + TILE - 24;

function centreTile(game: Game): [number, number] {
  const p = game.player;
  return [Math.floor(p.cx / TILE), Math.floor(p.cy / TILE)];
}

function withEnemy(extra: Parameters<typeof makeArena>[0] = {}): Game {
  return new Game(
    makeArena({
      entities: [
        [2, 11, SPAWN],
        [10, 11, 1],
      ],
      ...extra,
    }),
  );
}

function touchEnemy(game: Game): void {
  const enemy = game.enemies[0];
  enemy.speed = 0;
  game.player.x = enemy.x;
  game.player.y = enemy.y;
}

describe("Game.spawn", () => {
  test("places the player on the spawn marker with short invulnerability", () => {
    const game = new Game(makeArena());

    assert.equal(game.player.x, SPAWN_X);
    assert.equal(game.player.y, SPAWN_Y);
    assert.equal(game.player.vx, 0);
    assert.equal(game.player.vy, 0);
    assert.equal(game.player.invuln, 30);
    assert.equal(game.lives, 3);
    assert.equal(game.score, 0);
  });
});

describe("Shooting", () => {
  test("spends a cartridge and fires forward", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    input.press("ControlLeft");
    tick(game, input, 1);

    assert.equal(game.player.ammo, 7);
    assert.equal(game.bullets.length, 1);
    assert.equal(game.bullets[0].vx, 380);
    assert.equal(game.bullets[0].vy, 0);
    assert.equal(game.bullets[0].y, game.player.cy, "the shot leaves at gun height");
  });

  test("hits an enemy standing on the same floor", () => {
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [7, 11, 1],
      ],
    }));
    game.enemies[0].speed = 0;
    const input = fakeInput();

    input.press("ControlLeft");
    tick(game, input, 20);

    assert.equal(game.enemies[0].alive, false);
    assert.equal(game.score, 100);
  });

  test("respects the shot cooldown", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    input.press("ControlLeft");
    tick(game, input, 1);
    assert.equal(game.player.ammo, 7);

    input.press("ControlLeft");
    tick(game, input, 1);
    assert.equal(game.player.ammo, 7, "second shot must be blocked by the cooldown");
    assert.equal(game.bullets.length, 1);

    tick(game, input, 8);
    input.press("ControlLeft");
    tick(game, input, 1);
    assert.equal(game.player.ammo, 6);
    assert.equal(game.bullets.length, 2);
  });

  test("aims diagonally with the vertical keys", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.down.add("ArrowUp");

    input.press("ControlLeft");
    tick(game, input, 1);

    assert.equal(game.bullets[0].vy, -285);
  });

  test("does not fire without ammo", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    game.player.ammo = 0;
    game.player.cooldown = 0;

    input.press("ControlLeft");
    tick(game, input, 1);

    assert.equal(game.bullets.length, 0);
  });
});

describe("Bullets", () => {
  test("kill an enemy, score, and disappear", () => {
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [6, 11, 1],
      ],
    }));
    const enemy = game.enemies[0];
    enemy.speed = 0;
    const input = fakeInput();
    game.bullets.push(new Bullet(enemy.x + 2, enemy.y + 6, 0, 0));

    tick(game, input, 1);

    assert.equal(enemy.alive, false);
    assert.equal(game.score, 100);
    assert.equal(game.bullets.length, 0);
  });

  test("die on a wall", () => {
    const game = new Game(makeArena({
      tiles: [
        [9, 10, SOLID],
        [9, 11, SOLID],
      ],
    }));
    const input = fakeInput();
    input.press("ControlLeft");

    tick(game, input, 20);

    assert.equal(game.bullets.length, 0);
    assert.equal(game.score, 0);
  });
});

describe("Damage", () => {
  test("costs a life, grants invulnerability and respawns", () => {
    const game = withEnemy();
    const input = fakeInput();
    tick(game, input, 30);
    touchEnemy(game);

    tick(game, input, 1);

    assert.equal(game.lives, 2);
    assert.equal(game.player.invuln, 60);
    assert.equal(game.player.x, SPAWN_X);
    assert.equal(game.player.y, SPAWN_Y);
  });

  test("does not stack while invulnerable", () => {
    const game = withEnemy();
    const input = fakeInput();
    tick(game, input, 30);
    touchEnemy(game);
    tick(game, input, 1);
    assert.equal(game.lives, 2);

    touchEnemy(game);
    tick(game, input, 10);

    assert.equal(game.lives, 2);
  });

  test("ends the game when the last life is gone", () => {
    const game = withEnemy();
    const input = fakeInput();
    tick(game, input, 30);
    game.lives = 1;
    touchEnemy(game);

    tick(game, input, 1);

    assert.equal(game.lives, 0);
    assert.equal(game.gameOver, true);
  });
});

describe("Pickups", () => {
  test("gems add score and clear the tile", () => {
    const cases: Array<[number, number]> = [
      [GEM_100, 100],
      [GEM_250, 250],
      [GEM_500, 500],
    ];

    for (const [tile, score] of cases) {
      const game = new Game(makeArena({ tiles: [[2, 11, tile]] }));
      const input = fakeInput();

      tick(game, input, 1);

      assert.equal(game.score, score);
      assert.equal(game.level.tileAt(2, 11), 0);
      assert.deepEqual(game.tilePatches, [{ x: 2, y: 11, index: 0 }]);
    }
  });

  test("ammo pickups add a cartridge up to the magazine size", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, AMMO]] }));
    game.player.ammo = 7;
    tick(game, fakeInput(), 1);
    assert.equal(game.player.ammo, 8);

    const full = new Game(makeArena({ tiles: [[2, 11, AMMO]] }));
    tick(full, fakeInput(), 1);
    assert.equal(full.player.ammo, 8);
  });
});

describe("Exit door", () => {
  test("plays three frames, completes the level and pays the bonus", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, DOOR]] }));
    const input = fakeInput();

    tick(game, input, 1);
    assert.equal(game.levelComplete, false);
    assert.equal(game.tilePatches.length, 0);

    tick(game, input, 5);
    assert.equal(game.tilePatches.length, 6);
    assert.equal(game.levelComplete, false);

    tick(game, input, 5);
    assert.equal(game.tilePatches.length, 12);

    tick(game, input, 5);
    assert.equal(game.tilePatches.length, 12);
    assert.equal(game.levelComplete, true);
    assert.equal(game.score, 1000);
    assert.deepEqual(game.tilePatches[0], { x: 1, y: 10, index: 78 });
  });
});

describe("Score", () => {
  test("awards an extra life every 5000 points", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, GEM_100]] }));
    game.score = 4900;

    tick(game, fakeInput(), 1);

    assert.equal(game.score, 5000);
    assert.equal(game.lives, 4);
  });
});

describe("Level bounds", () => {
  test("keeps the player inside the map", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    game.player.x = -50;
    tick(game, input, 1);
    assert.equal(game.player.x, 0);

    game.player.x = game.level.pixelWidth + 50;
    tick(game, input, 1);
    assert.equal(game.player.x, game.level.pixelWidth - game.player.w);

    game.player.y = game.level.pixelHeight + 10;
    tick(game, input, 1);
    assert.equal(game.player.y, 2 * TILE);
  });

  test("clamps the camera to the level bounds", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    tick(game, input, 1);
    assert.equal(game.cameraX, 0);
    assert.equal(game.cameraY, game.level.pixelHeight - 200);

    game.player.x = game.level.pixelWidth - 20;
    tick(game, input, 1);
    assert.equal(game.cameraX, game.level.pixelWidth - 320);
  });

  test("keeps the camera fixed on a level smaller than the screen", () => {
    const level: Level = makeArena({ width: 10, height: 8, floor: 6, entities: [[2, 5, 255]] });
    const game = new Game(level);
    const input = fakeInput();

    game.player.x = 5 * TILE;
    tick(game, input, 1);

    assert.equal(game.cameraX, 0);
    assert.equal(game.cameraY, 0);
  });
});

describe("Tile patches", () => {
  test("expose every runtime tile change to the renderer", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, GEM_500]] }));
    const input = fakeInput();
    const [tx, ty] = centreTile(game);

    tick(game, input, 1);

    assert.ok(game.tilePatches.some((patch) => patch.x === tx && patch.y === ty && patch.index === 0));
  });
});
