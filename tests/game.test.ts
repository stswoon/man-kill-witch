import { describe, expect, test } from "vitest";
import { TILE } from "../web/src/assets";
import { Bullet, Game, type Level } from "../web/src/game";
import {
  AMMO,
  DOOR,
  DT,
  GEM_100,
  GEM_250,
  GEM_500,
  SPAWN,
  SOLID,
  fakeInput,
  makeArena,
  tick,
} from "./helpers";

const SPAWN_X = 2 * TILE + 10;
const SPAWN_Y = 11 * TILE + TILE - 120;

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

    expect(game.player.x).toBe(SPAWN_X);
    expect(game.player.y).toBe(SPAWN_Y);
    expect(game.player.vx).toBe(0);
    expect(game.player.vy).toBe(0);
    expect(game.player.invuln).toBe(30);
    expect(game.player.w).toBe(60);
    expect(game.player.h).toBe(120);
    expect(game.lives).toBe(3);
    expect(game.score).toBe(0);
  });
});

describe("Shooting", () => {
  test("spends a cartridge and fires forward", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    input.press("ControlLeft");
    tick(game, input, 1);

    expect(game.player.ammo).toBe(7);
    expect(game.bullets).toHaveLength(1);
    expect(game.bullets[0].vx).toBe(1900);
    expect(game.bullets[0].vy).toBe(0);
    // The bullet is integrated once in the tick that spawns it.
    expect(game.bullets[0].x, "the shot leaves 30px in front of the body").toBeCloseTo(
      game.player.cx + 30 + 1900 * DT,
      5,
    );
    expect(game.bullets[0].y, "the shot leaves at gun height").toBeCloseTo(game.player.cy, 5);
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

    expect(game.enemies[0].alive).toBe(false);
    expect(game.score).toBe(100);
  });

  test("respects the shot cooldown", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    input.press("ControlLeft");
    tick(game, input, 1);
    expect(game.player.ammo).toBe(7);

    input.press("ControlLeft");
    tick(game, input, 1);
    expect(game.player.ammo, "second shot must be blocked by the cooldown").toBe(7);
    expect(game.bullets).toHaveLength(1);

    tick(game, input, 8);
    input.press("ControlLeft");
    tick(game, input, 1);
    expect(game.player.ammo).toBe(6);
    expect(game.bullets).toHaveLength(2);
  });

  test("aims diagonally with the vertical keys", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.down.add("ArrowUp");

    input.press("ControlLeft");
    tick(game, input, 1);

    expect(game.bullets[0].vy).toBe(-1425);
    expect(game.bullets[0].y, "aiming up moves the muzzle 30px up").toBeCloseTo(
      game.player.cy - 30 - 1425 * DT,
      5,
    );
  });

  test("does not fire without ammo", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    game.player.ammo = 0;
    game.player.cooldown = 0;

    input.press("ControlLeft");
    tick(game, input, 1);

    expect(game.bullets).toHaveLength(0);
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

    expect(enemy.alive).toBe(false);
    expect(game.score).toBe(100);
    expect(game.bullets).toHaveLength(0);
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

    expect(game.bullets).toHaveLength(0);
    expect(game.score).toBe(0);
  });
});

describe("Damage", () => {
  test("costs a life, grants invulnerability and respawns", () => {
    const game = withEnemy();
    const input = fakeInput();
    tick(game, input, 30);
    touchEnemy(game);

    tick(game, input, 1);

    expect(game.lives).toBe(2);
    expect(game.player.invuln).toBe(60);
    expect(game.player.x).toBe(SPAWN_X);
    expect(game.player.y).toBe(SPAWN_Y);
  });

  test("does not stack while invulnerable", () => {
    const game = withEnemy();
    const input = fakeInput();
    tick(game, input, 30);
    touchEnemy(game);
    tick(game, input, 1);
    expect(game.lives).toBe(2);

    touchEnemy(game);
    tick(game, input, 10);

    expect(game.lives).toBe(2);
  });

  test("ends the game when the last life is gone", () => {
    const game = withEnemy();
    const input = fakeInput();
    tick(game, input, 30);
    game.lives = 1;
    touchEnemy(game);

    tick(game, input, 1);

    expect(game.lives).toBe(0);
    expect(game.gameOver).toBe(true);
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

      expect(game.score).toBe(score);
      expect(game.level.tileAt(2, 11)).toBe(0);
      expect(game.tilePatches).toEqual([{ x: 2, y: 11, index: 0 }]);
    }
  });

  test("ammo pickups add a cartridge up to the magazine size", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, AMMO]] }));
    game.player.ammo = 7;
    tick(game, fakeInput(), 1);
    expect(game.player.ammo).toBe(8);

    const full = new Game(makeArena({ tiles: [[2, 11, AMMO]] }));
    tick(full, fakeInput(), 1);
    expect(full.player.ammo).toBe(8);
  });
});

describe("Exit door", () => {
  test("plays three frames, completes the level and pays the bonus", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, DOOR]] }));
    const input = fakeInput();

    tick(game, input, 1);
    expect(game.levelComplete).toBe(false);
    expect(game.tilePatches).toHaveLength(0);

    tick(game, input, 5);
    expect(game.tilePatches).toHaveLength(6);
    expect(game.levelComplete).toBe(false);

    tick(game, input, 5);
    expect(game.tilePatches).toHaveLength(12);

    tick(game, input, 5);
    expect(game.tilePatches).toHaveLength(12);
    expect(game.levelComplete).toBe(true);
    expect(game.score).toBe(1000);
    expect(game.tilePatches[0]).toEqual({ x: 1, y: 10, index: 78 });
  });
});

describe("Score", () => {
  test("awards an extra life every 5000 points", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, GEM_100]] }));
    game.score = 4900;

    tick(game, fakeInput(), 1);

    expect(game.score).toBe(5000);
    expect(game.lives).toBe(4);
  });
});

describe("Level bounds", () => {
  test("keeps the player inside the map", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    game.player.x = -50;
    tick(game, input, 1);
    expect(game.player.x).toBe(0);

    game.player.x = game.level.pixelWidth + 50;
    tick(game, input, 1);
    expect(game.player.x).toBe(game.level.pixelWidth - game.player.w);

    game.player.y = game.level.pixelHeight + 10;
    tick(game, input, 1);
    expect(game.player.y).toBe(2 * TILE);
  });

  test("clamps the camera to the level bounds", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    tick(game, input, 1);
    expect(game.cameraX).toBe(0);
    expect(game.cameraY).toBe(game.level.pixelHeight - 1080);

    game.player.x = game.level.pixelWidth - 20;
    tick(game, input, 1);
    expect(game.cameraX).toBe(game.level.pixelWidth - 1920);
  });

  test("keeps the camera fixed on a level smaller than the screen", () => {
    const level: Level = makeArena({ width: 10, height: 8, floor: 6, entities: [[2, 5, 255]] });
    const game = new Game(level);
    const input = fakeInput();

    game.player.x = 5 * TILE;
    tick(game, input, 1);

    expect(game.cameraX).toBe(0);
    expect(game.cameraY).toBe(0);
  });
});

describe("Tile patches", () => {
  test("expose every runtime tile change to the renderer", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, GEM_500]] }));
    const input = fakeInput();
    const [tx, ty] = centreTile(game);

    tick(game, input, 1);

    expect(game.tilePatches).toContainEqual({ x: tx, y: ty, index: 0 });
  });
});
