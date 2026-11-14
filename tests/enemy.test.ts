import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TILE } from "../web/src/assets";
import { Enemy, Game } from "../web/src/game";
import { DT, SPAWN, SOLID, makeArena, makeLevel } from "./helpers";

const FLOOR = 12;
const FLOOR_TOP = FLOOR * TILE;

function run(enemy: Enemy, level: ReturnType<typeof makeLevel>, ticks: number): void {
  for (let i = 0; i < ticks; i++) enemy.update(DT, level);
}

function wallLevel(): ReturnType<typeof makeLevel> {
  return makeLevel({
    width: 20,
    height: 15,
    floor: FLOOR,
    tiles: [
      [8, 10, SOLID],
      [8, 11, SOLID],
    ],
  });
}

/** Floor only under the first eight columns, so the enemy can run off the edge. */
function ledgeLevel(): ReturnType<typeof makeLevel> {
  const tiles = Array.from({ length: 8 }, (_, x): [number, number, number] => [x, FLOOR, SOLID]);
  return makeLevel({ width: 20, height: 15, tiles });
}

function walkerAt(x: number, level = wallLevel()): Enemy {
  const enemy = new Enemy(1, x * TILE, FLOOR_TOP - 12);
  enemy.speed = 26;
  return enemy;
}

describe("Enemy spawn mapping", () => {
  test("creates enemies for known markers and skips the rest", () => {
    const level = makeArena({
      entities: [
        [2, 11, SPAWN],
        [5, 11, 1],
        [7, 11, 6],
        [9, 5, 14],
        [11, 11, 32768],
        [13, 11, 1587],
      ],
    });

    const game = new Game(level);

    const byType = new Map(game.enemies.map((enemy) => [enemy.type, enemy]));
    assert.equal(game.enemies.length, 3);
    assert.equal(byType.get(1)?.sprite, 2);
    assert.equal(byType.get(6)?.sprite, 5);
    assert.equal(byType.get(14)?.sprite, 9);
    assert.equal(byType.get(1)?.speed, 26);
    assert.equal(byType.get(6)?.speed, 40);
    assert.equal(byType.get(14)?.speed, 34);
    assert.equal(byType.get(1)?.fly, false);
    assert.equal(byType.get(6)?.fly, false);
    assert.equal(byType.get(14)?.fly, true);
  });

  test("marks chargers as non-turning at ledges", () => {
    const level = makeArena({
      entities: [
        [2, 11, SPAWN],
        [5, 11, 1],
        [7, 11, 6],
      ],
    });

    const game = new Game(level);

    assert.equal(game.enemies[0].turnsAtLedge, true);
    assert.equal(game.enemies[1].turnsAtLedge, false);
  });
});

describe("Enemy terrain", () => {
  test("walker turns around at a wall", () => {
    const enemy = walkerAt(6);
    const level = wallLevel();

    run(enemy, level, 200);

    assert.equal(enemy.dir, -1);
    assert.ok(enemy.x + enemy.w <= 8 * TILE + 1);
  });

  test("walker turns around at a ledge", () => {
    const enemy = walkerAt(7);
    const level = ledgeLevel();

    run(enemy, level, 40);

    assert.equal(enemy.dir, -1);
    assert.ok(Math.abs(enemy.y - (FLOOR_TOP - 12)) <= 1, "walker must stay on the platform");
  });

  test("charger runs straight off a ledge", () => {
    const level = ledgeLevel();
    const enemy = new Enemy(6, 7 * TILE, FLOOR_TOP - 12);
    enemy.speed = 40;
    enemy.turnsAtLedge = false;

    run(enemy, level, 60);

    assert.equal(enemy.dir, 1);
    assert.ok(enemy.y > FLOOR_TOP - 12, "charger must leave the platform");
    assert.equal(enemy.alive, true);
  });

  test("charger still turns around at a wall", () => {
    const level = wallLevel();
    const enemy = new Enemy(6, 6 * TILE, FLOOR_TOP - 12);
    enemy.speed = 40;
    enemy.turnsAtLedge = false;

    run(enemy, level, 120);

    assert.equal(enemy.dir, -1);
  });

  test("ground enemy rests on the bottom edge of the map", () => {
    // Out-of-bounds is solid, so nothing can fall out of the level.
    const level = makeLevel({ width: 20, height: 15 });
    const enemy = new Enemy(1, 4 * TILE, 2 * TILE);

    run(enemy, level, 300);

    assert.equal(enemy.alive, true);
    assert.ok(enemy.y + enemy.h <= level.pixelHeight + 1);
  });
});

describe("Enemy flying", () => {
  test("flyer reverses at a wall", (t) => {
    t.mock.method(Math, "random", () => 0);
    const level = makeLevel({ width: 20, height: 15, tiles: [[8, 6, SOLID]] });
    const enemy = new Enemy(14, 6 * TILE, 5 * TILE);
    enemy.fly = true;
    enemy.speed = 34;

    run(enemy, level, 200);

    assert.equal(enemy.dir, -1);
  });

  test("flyer dies above the top of the map", (t) => {
    t.mock.method(Math, "random", () => 0);
    const level = makeLevel({ width: 20, height: 15 });
    const enemy = new Enemy(14, 4 * TILE, 0);
    enemy.fly = true;

    run(enemy, level, 1);

    assert.equal(enemy.alive, false);
  });

  test("flyer dies below the bottom of the map", (t) => {
    t.mock.method(Math, "random", () => 0);
    const level = makeLevel({ width: 20, height: 15 });
    const enemy = new Enemy(14, 4 * TILE, level.pixelHeight - 10);
    enemy.fly = true;

    run(enemy, level, 1);

    assert.equal(enemy.alive, false);
  });
});
