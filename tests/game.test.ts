import { describe, expect, test } from "vitest";
import { TILE } from "../web/src/assets";
import { Game, Level } from "../web/src/game";
import { PLAYER_H, PLAYER_W } from "../web/src/sim-contract";
import {
  AMMO,
  DOOR,
  GEM_100,
  GEM_250,
  GEM_500,
  SPAWN,
  fakeInput,
  makeArena,
  makeSnapshot,
  putPlayerInTile,
  tick,
} from "./helpers";

const SPAWN_X = 2 * TILE + 10;
const SPAWN_Y = 11 * TILE + TILE - 120;

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

describe("Game.spawn", () => {
  test("places the player on the spawn marker with short invulnerability", () => {
    const game = new Game(makeArena());

    expect(game.spawnX).toBe(SPAWN_X);
    expect(game.spawnY).toBe(SPAWN_Y);
    expect(game.player.invuln).toBe(30);
    expect(game.player.ammo).toBe(8);
    expect(game.lives).toBe(3);
    expect(game.score).toBe(0);
  });

  test("puts the hero body on the spawn marker", () => {
    const game = new Game(makeArena());
    const snapshot = makeSnapshot(game);

    expect(snapshot.player.x).toBe(SPAWN_X);
    expect(snapshot.player.y).toBe(SPAWN_Y);
    expect(snapshot.player.w).toBe(PLAYER_W);
    expect(snapshot.player.h).toBe(PLAYER_H);
  });
});

describe("Shooting", () => {
  test("spends a cartridge and fires forward from the muzzle", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.press("ControlLeft");

    const [commands] = tick(game, input);

    expect(game.player.ammo).toBe(7);
    expect(commands.spawnBullet).toEqual({
      id: 1,
      x: SPAWN_X + PLAYER_W / 2 + 30,
      y: SPAWN_Y + PLAYER_H / 2,
      vx: 1900,
      vy: 0,
    });
    expect(game.bullets.map((bullet) => bullet.id)).toEqual([1]);
  });

  test("respects the shot cooldown", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    input.press("ControlLeft");
    const [first] = tick(game, input);
    expect(first.spawnBullet).not.toBeNull();
    expect(game.player.ammo).toBe(7);

    input.press("ControlLeft");
    const [second] = tick(game, input);
    expect(second.spawnBullet, "second shot must be blocked by the cooldown").toBeNull();
    expect(game.player.ammo).toBe(7);

    tick(game, input, makeSnapshot(game), 7);
    input.press("ControlLeft");
    const [third] = tick(game, input);
    expect(third.spawnBullet).not.toBeNull();
    expect(game.player.ammo).toBe(6);
    expect(game.bullets.map((bullet) => bullet.id)).toEqual([1, 2]);
  });

  test("aims diagonally with the vertical keys", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.down.add("ArrowUp");
    input.press("ControlLeft");

    const [commands] = tick(game, input);

    expect(commands.spawnBullet?.vy).toBe(-1425);
    expect(commands.spawnBullet?.y, "aiming up moves the muzzle 30px up").toBe(
      SPAWN_Y + PLAYER_H / 2 - 30,
    );
  });

  test("does not fire without ammo", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    game.player.ammo = 0;
    game.player.cooldown = 0;

    input.press("ControlLeft");
    const [commands] = tick(game, input);

    expect(commands.spawnBullet).toBeNull();
  });
});

describe("Bullets", () => {
  test("live for forty ticks and then ask Arcade to despawn them", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.press("ControlLeft");
    tick(game, input);
    expect(game.bullets).toHaveLength(1);

    const quiet = tick(game, input, makeSnapshot(game), 38);
    expect(quiet.every((commands) => commands.despawnBullet.length === 0)).toBe(true);
    expect(game.bullets).toHaveLength(1);

    const [expired] = tick(game, input);
    expect(expired.despawnBullet).toEqual([1]);
    expect(game.bullets).toHaveLength(0);
  });

  test("kill an enemy, score and disappear", () => {
    const game = withEnemy();
    const shot = makeSnapshot(game, {
      events: [{ type: "bulletHitEnemy", bulletId: 7, enemyId: 0 }],
    });

    const [commands] = tick(game, fakeInput(), shot);

    expect(game.enemies[0].alive).toBe(false);
    expect(game.score).toBe(100);
    expect(commands.killEnemy).toEqual([0]);
    expect(commands.despawnBullet).toEqual([7]);
  });

  test("a repeated hit event does not double the score", () => {
    const game = withEnemy();
    const duplicated = makeSnapshot(game, {
      events: [
        { type: "bulletHitEnemy", bulletId: 7, enemyId: 0 },
        { type: "bulletHitEnemy", bulletId: 8, enemyId: 0 },
      ],
    });

    const [commands] = tick(game, fakeInput(), duplicated);

    expect(game.score).toBe(100);
    expect(commands.killEnemy).toEqual([0]);
  });

  test("die on a wall", () => {
    const game = new Game(makeArena());
    const wall = makeSnapshot(game, { events: [{ type: "bulletHitWall", bulletId: 3 }] });

    const [commands] = tick(game, fakeInput(), wall);

    expect(commands.despawnBullet).toEqual([3]);
    expect(game.score).toBe(0);
  });
});

describe("Damage", () => {
  test("costs a life, grants invulnerability and asks for a respawn", () => {
    const game = withEnemy();
    game.player.invuln = 0;
    const touch = makeSnapshot(game, { events: [{ type: "playerTouchedEnemy", enemyId: 0 }] });

    const [commands] = tick(game, fakeInput(), touch);

    expect(game.lives).toBe(2);
    expect(game.player.invuln).toBe(60);
    expect(game.hurtFlash).toBe(40);
    expect(commands.respawnPlayer).toEqual({ x: SPAWN_X, y: SPAWN_Y });
  });

  test("does not stack while invulnerable", () => {
    const game = withEnemy();
    game.player.invuln = 30;
    const touch = makeSnapshot(game, { events: [{ type: "playerTouchedEnemy", enemyId: 0 }] });

    const [commands] = tick(game, fakeInput(), touch);

    expect(game.lives).toBe(3);
    expect(commands.respawnPlayer).toBeNull();
  });

  test("ends the game when the last life is gone", () => {
    const game = withEnemy();
    game.lives = 1;
    game.player.invuln = 0;
    const touch = makeSnapshot(game, { events: [{ type: "playerTouchedEnemy", enemyId: 0 }] });

    const [commands] = tick(game, fakeInput(), touch);

    expect(game.lives).toBe(0);
    expect(game.gameOver).toBe(true);
    expect(commands.respawnPlayer, "a finished run cannot respawn").toBeNull();
  });

  test("ignores further touches after game over", () => {
    const game = withEnemy();
    game.lives = 1;
    game.player.invuln = 0;
    const touch = makeSnapshot(game, { events: [{ type: "playerTouchedEnemy", enemyId: 0 }] });
    tick(game, fakeInput(), touch);
    expect(game.gameOver).toBe(true);

    tick(game, fakeInput(), touch);

    expect(game.lives).toBe(0);
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
      const snapshot = putPlayerInTile(makeSnapshot(game), 2, 11);

      tick(game, fakeInput(), snapshot);

      expect(game.score).toBe(score);
      expect(game.level.tileAt(2, 11)).toBe(0);
      expect(game.tilePatches).toEqual([{ x: 2, y: 11, index: 0 }]);
    }
  });

  test("ammo pickups add a cartridge up to the magazine size", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, AMMO]] }));
    game.player.ammo = 7;
    tick(game, fakeInput(), putPlayerInTile(makeSnapshot(game), 2, 11));
    expect(game.player.ammo).toBe(8);

    const full = new Game(makeArena({ tiles: [[2, 11, AMMO]] }));
    tick(full, fakeInput(), putPlayerInTile(makeSnapshot(full), 2, 11));
    expect(full.player.ammo).toBe(8);
  });
});

describe("Exit door", () => {
  /** Arena door at (2, 11): the opening block covers columns 1-2 and rows 10-12. */
  const DOOR_BLOCK: Array<[number, number]> = [
    [1, 10], [2, 10],
    [1, 11], [2, 11],
    [1, 12], [2, 12],
  ];

  test("clears the 2x3 block, steps the animation and completes after 15 ticks", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, DOOR]] }));
    const input = fakeInput();
    const atDoor = putPlayerInTile(makeSnapshot(game), 2, 11);

    tick(game, input, atDoor, 1);
    expect(game.door, "the trigger tick opens the door on step 0").toEqual({
      tx: 2,
      ty: 11,
      step: 0,
      timer: 0,
    });
    expect(game.levelComplete, "the level ends only on the third step").toBe(false);
    expect(game.tilePatches, "the static 2x3 block is cleared on the trigger tick").toEqual(
      DOOR_BLOCK.map(([x, y]) => ({ x, y, index: 0 })),
    );
    for (const [x, y] of DOOR_BLOCK) {
      expect(game.level.tileAt(x, y), `tile (${x}, ${y}) must be cleared`).toBe(0);
    }

    tick(game, input, atDoor, 4);
    expect(game.door, "step 0 holds for its five ticks").toEqual({
      tx: 2,
      ty: 11,
      step: 0,
      timer: 4,
    });

    tick(game, input, atDoor, 1);
    expect(game.door, "step 1 comes five ticks after the trigger").toEqual({
      tx: 2,
      ty: 11,
      step: 1,
      timer: 0,
    });

    tick(game, input, atDoor, 5);
    expect(game.door, "step 2 comes ten ticks after the trigger").toEqual({
      tx: 2,
      ty: 11,
      step: 2,
      timer: 0,
    });
    expect(game.levelComplete).toBe(false);

    tick(game, input, atDoor, 5);
    expect(game.door, "the door is gone at the fifteenth tick").toBeNull();
    expect(game.levelComplete).toBe(true);
    expect(game.score).toBe(1000);
    expect(game.tilePatches, "steps 1 and 2 change no tiles: the opening is a sprite").toHaveLength(6);
  });

  test("keeps the static door tiles until the trigger", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, DOOR]] }));
    // Centre in (2, 10), one tile above the trigger.
    const above = makeSnapshot(game, { player: { y: 760 } });

    tick(game, fakeInput(), above, 5);

    expect(game.door).toBeNull();
    expect(game.tilePatches, "the static tiles must not change before the trigger").toHaveLength(0);
    expect(game.level.tileAt(2, 11)).toBe(DOOR);
  });

  test("triggers on the player center without requiring ground contact", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, DOOR]] }));
    const airborne = makeSnapshot(game, { player: { onGround: false } });

    tick(game, fakeInput(), airborne, 1);

    expect(game.door).toEqual({ tx: 2, ty: 11, step: 0, timer: 0 });
  });

  test("leaves cells outside the map alone", () => {
    const game = new Game(makeArena({ tiles: [[0, 11, DOOR]] }));
    // Centre x = 30, so tx = 0 and the block starts at x = -1.
    const atEdge = makeSnapshot(game, { player: { x: 0 } });

    tick(game, fakeInput(), atEdge, 1);

    expect(game.door).toEqual({ tx: 0, ty: 11, step: 0, timer: 0 });
    expect(game.tilePatches).toEqual([
      { x: 0, y: 10, index: 0 },
      { x: 0, y: 11, index: 0 },
      { x: 0, y: 12, index: 0 },
    ]);
  });
});

describe("Score", () => {
  test("awards an extra life every 5000 points", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, GEM_100]] }));
    game.score = 4900;

    tick(game, fakeInput(), putPlayerInTile(makeSnapshot(game), 2, 11));

    expect(game.score).toBe(5000);
    expect(game.lives).toBe(4);
  });
});

describe("Camera", () => {
  test("clamps the camera to the level bounds", () => {
    const game = new Game(makeArena());

    tick(game, fakeInput(), makeSnapshot(game));
    expect(game.cameraX).toBe(0);
    expect(game.cameraY).toBe(game.level.pixelHeight - 1080);

    tick(game, fakeInput(), makeSnapshot(game, { player: { x: game.level.pixelWidth - 20 } }));
    expect(game.cameraX).toBe(game.level.pixelWidth - 1920);
  });

  test("keeps the camera fixed on a level smaller than the screen", () => {
    const level: Level = makeArena({ width: 10, height: 8, floor: 6, entities: [[2, 5, 255]] });
    const game = new Game(level);

    tick(game, fakeInput(), makeSnapshot(game));

    expect(game.cameraX).toBe(0);
    expect(game.cameraY).toBe(0);
  });
});

describe("Tile patches", () => {
  test("expose every runtime tile change to the renderer", () => {
    const game = new Game(makeArena({ tiles: [[2, 11, GEM_500]] }));

    tick(game, fakeInput(), putPlayerInTile(makeSnapshot(game), 2, 11));

    expect(game.tilePatches).toContainEqual({ x: 2, y: 11, index: 0 });
  });
});
