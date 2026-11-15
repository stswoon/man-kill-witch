import { describe, expect, test, vi } from "vitest";
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
  const enemy = new Enemy(1, x * TILE, FLOOR_TOP - 60);
  enemy.speed = 130;
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
    expect(game.enemies).toHaveLength(3);
    expect(byType.get(1)?.sprite).toBe(2);
    expect(byType.get(6)?.sprite).toBe(5);
    expect(byType.get(14)?.sprite).toBe(9);
    expect(byType.get(1)?.speed).toBe(130);
    expect(byType.get(6)?.speed).toBe(200);
    expect(byType.get(14)?.speed).toBe(170);
    expect(byType.get(1)?.fly).toBe(false);
    expect(byType.get(6)?.fly).toBe(false);
    expect(byType.get(14)?.fly).toBe(true);
    expect(byType.get(1)?.w).toBe(60);
    expect(byType.get(1)?.h).toBe(60);
    expect(byType.get(1)?.x, "spawn x is tx * TILE + 10").toBe(5 * TILE + 10);
    expect(byType.get(1)?.y, "spawn y is ty * TILE + 20").toBe(11 * TILE + 20);
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

    expect(game.enemies[0].turnsAtLedge).toBe(true);
    expect(game.enemies[1].turnsAtLedge).toBe(false);
  });
});

describe("Enemy terrain", () => {
  test("walker turns around at a wall", () => {
    const enemy = walkerAt(6);
    const level = wallLevel();

    run(enemy, level, 200);

    expect(enemy.dir).toBe(-1);
    expect(enemy.x + enemy.w).toBeLessThanOrEqual(8 * TILE + 5);
  });

  test("walker turns around at a ledge", () => {
    const enemy = walkerAt(7);
    const level = ledgeLevel();

    run(enemy, level, 40);

    expect(enemy.dir).toBe(-1);
    expect(Math.abs(enemy.y - (FLOOR_TOP - 60)), "walker must stay on the platform").toBeLessThanOrEqual(5);
  });

  test("charger runs straight off a ledge", () => {
    const level = ledgeLevel();
    const enemy = new Enemy(6, 7 * TILE, FLOOR_TOP - 60);
    enemy.speed = 200;
    enemy.turnsAtLedge = false;

    run(enemy, level, 60);

    expect(enemy.dir).toBe(1);
    expect(enemy.y, "charger must leave the platform").toBeGreaterThan(FLOOR_TOP - 60);
    expect(enemy.alive).toBe(true);
  });

  test("charger still turns around at a wall", () => {
    const level = wallLevel();
    const enemy = new Enemy(6, 6 * TILE, FLOOR_TOP - 60);
    enemy.speed = 200;
    enemy.turnsAtLedge = false;

    run(enemy, level, 120);

    expect(enemy.dir).toBe(-1);
  });

  test("ground enemy rests on the bottom edge of the map", () => {
    // Out-of-bounds is solid, so nothing can fall out of the level.
    const level = makeLevel({ width: 20, height: 15 });
    const enemy = new Enemy(1, 4 * TILE, 2 * TILE);

    run(enemy, level, 300);

    expect(enemy.alive).toBe(true);
    expect(enemy.y + enemy.h).toBeLessThanOrEqual(level.pixelHeight + 5);
  });
});

describe("Enemy flying", () => {
  test("flyer reverses at a wall", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const level = makeLevel({
      width: 20,
      height: 15,
      tiles: [
        [8, 5, SOLID],
        [8, 6, SOLID],
      ],
    });
    const enemy = new Enemy(14, 6 * TILE, 5 * TILE - 30);
    enemy.fly = true;
    enemy.speed = 170;

    run(enemy, level, 200);

    expect(enemy.dir).toBe(-1);
    expect(enemy.x, "flyer must not pass the wall").toBeLessThan(8 * TILE);
  });

  test("flyer dies above the top of the map", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const level = makeLevel({ width: 20, height: 15 });
    const enemy = new Enemy(14, 4 * TILE, 0);
    enemy.fly = true;

    run(enemy, level, 1);

    expect(enemy.alive).toBe(false);
  });

  test("flyer dies below the bottom of the map", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const level = makeLevel({ width: 20, height: 15 });
    const enemy = new Enemy(14, 4 * TILE, level.pixelHeight - 10);
    enemy.fly = true;

    run(enemy, level, 1);

    expect(enemy.alive).toBe(false);
  });
});
