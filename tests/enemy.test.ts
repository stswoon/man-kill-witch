import { describe, expect, test, vi } from "vitest";
import { TILE } from "../web/src/assets";
import { Game } from "../web/src/game";
import { DT, SPAWN, SOLID, fakeInput, makeArena, makeLevel, makeSnapshot, tick } from "./helpers";

const FLOOR = 12;

function wallLevel(): ReturnType<typeof makeLevel> {
  return makeLevel({
    width: 20,
    height: 15,
    floor: FLOOR,
    tiles: [
      [8, 10, SOLID],
      [8, 11, SOLID],
    ],
    entities: [
      [2, 11, SPAWN],
      [5, 11, 6],
    ],
  });
}

/** Floor only under the first eight columns, so an enemy can reach the edge. */
function ledgeLevel(): ReturnType<typeof makeLevel> {
  const tiles = Array.from({ length: 8 }, (_, x): [number, number, number] => [x, FLOOR, SOLID]);
  return makeLevel({
    width: 20,
    height: 15,
    tiles,
    entities: [
      [2, 11, SPAWN],
      [5, 11, 1],
    ],
  });
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
    expect(game.enemies.map((enemy) => enemy.id)).toEqual([0, 1, 2]);
    expect(byType.get(1)?.sprite).toBe(2);
    expect(byType.get(6)?.sprite).toBe(5);
    expect(byType.get(14)?.sprite).toBe(9);
    expect(byType.get(1)?.speed).toBe(130);
    expect(byType.get(6)?.speed).toBe(200);
    expect(byType.get(14)?.speed).toBe(170);
    expect(byType.get(1)?.fly).toBe(false);
    expect(byType.get(6)?.fly).toBe(false);
    expect(byType.get(14)?.fly).toBe(true);
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

describe("Enemy patrol intents", () => {
  test("a walker asks to move right at its speed", () => {
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [5, 11, 1],
      ],
    }));

    const [commands] = tick(game, fakeInput(), makeSnapshot(game));

    expect(commands.enemies).toEqual([{ id: 0, targetVx: 130, dir: 1, flyerVy: 0 }]);
  });

  test("a walker turns around at a wall", () => {
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [5, 11, 1],
      ],
    }));
    const blocked = makeSnapshot(game, {
      enemies: [{ blocked: { left: false, right: true, up: false, down: false } }],
    });

    const [commands] = tick(game, fakeInput(), blocked);

    expect(commands.enemies[0].dir).toBe(-1);
    expect(commands.enemies[0].targetVx).toBe(-130);
    expect(game.enemies[0].dir).toBe(-1);
  });

  test("a walker turns around at a ledge", () => {
    const level = ledgeLevel();
    const game = new Game(level);
    const enemy = game.enemies[0];
    // Stand the body past the last floor column: the tile ahead-below is empty.
    const offEdge = makeSnapshot(game, { enemies: [{ x: 8 * TILE, y: FLOOR * TILE - 60 }] });

    const [commands] = tick(game, fakeInput(), offEdge);

    expect(enemy.turnsAtLedge).toBe(true);
    expect(commands.enemies[0].dir).toBe(-1);
    expect(commands.enemies[0].targetVx).toBe(-130);
  });

  test("a charger runs straight off a ledge", () => {
    const level = ledgeLevel();
    const game = new Game(level);
    game.enemies[0].turnsAtLedge = false;
    game.enemies[0].speed = 200;
    const offEdge = makeSnapshot(game, { enemies: [{ x: 8 * TILE, y: FLOOR * TILE - 60 }] });

    const [commands] = tick(game, fakeInput(), offEdge);

    expect(commands.enemies[0].dir).toBe(1);
    expect(commands.enemies[0].targetVx).toBe(200);
  });

  test("a charger still turns around at a wall", () => {
    const game = new Game(wallLevel());
    const blocked = makeSnapshot(game, {
      enemies: [{ blocked: { left: true, right: false, up: false, down: false } }],
    });
    game.enemies[0].dir = -1;

    const [commands] = tick(game, fakeInput(), blocked);

    expect(commands.enemies[0].dir).toBe(1);
    expect(commands.enemies[0].targetVx).toBe(game.enemies[0].speed);
  });

  test("dead enemies get no intent", () => {
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [5, 11, 1],
      ],
    }));
    game.enemies[0].alive = false;

    const [commands] = tick(game, fakeInput(), makeSnapshot(game));

    expect(commands.enemies).toEqual([]);
  });

  test("an enemy whose body disappeared is marked dead", () => {
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [5, 11, 1],
      ],
    }));

    tick(game, fakeInput(), makeSnapshot(game, { enemies: [{ alive: false }] }));

    expect(game.enemies[0].alive).toBe(false);
  });
});

describe("Enemy flying", () => {
  test("a flyer asks for the sine speed and its patrol direction", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [6, 5, 14],
      ],
    }));

    const [commands] = tick(game, fakeInput(), makeSnapshot(game));

    expect(commands.enemies[0].targetVx).toBe(170);
    expect(commands.enemies[0].flyerVy).toBeCloseTo(Math.sin(DT * 2.4) * 120, 10);
  });

  test("a flyer reverses at a wall", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [6, 5, 14],
      ],
      tiles: [
        [8, 5, SOLID],
        [8, 6, SOLID],
      ],
    }));
    // Body right edge one pixel from the wall at column 8, mid height in row 5.
    const atWall = makeSnapshot(game, { enemies: [{ x: 8 * TILE - 61, y: 5 * TILE - 30 }] });

    const [commands] = tick(game, fakeInput(), atWall);

    expect(commands.enemies[0].dir).toBe(-1);
    expect(commands.enemies[0].targetVx).toBe(-170);
  });

  test("a flyer dies above the top of the map", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [6, 5, 14],
      ],
    }));

    const [commands] = tick(game, fakeInput(), makeSnapshot(game, { enemies: [{ y: 30 }] }));

    expect(commands.killEnemy).toEqual([0]);
    expect(commands.enemies).toEqual([]);
    expect(game.enemies[0].alive).toBe(false);
  });

  test("a flyer dies below the bottom of the map", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [6, 5, 14],
      ],
    }));
    const below = game.level.pixelHeight - 120 + 1;

    const [commands] = tick(game, fakeInput(), makeSnapshot(game, { enemies: [{ y: below }] }));

    expect(commands.killEnemy).toEqual([0]);
    expect(game.enemies[0].alive).toBe(false);
  });

  test("a flyer reverses at the left edge of the map", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new Game(makeArena({
      entities: [
        [2, 11, SPAWN],
        [6, 5, 14],
      ],
    }));
    game.enemies[0].dir = -1;

    const [commands] = tick(game, fakeInput(), makeSnapshot(game, { enemies: [{ x: 0 }] }));

    expect(commands.enemies[0].dir).toBe(1);
    expect(commands.enemies[0].targetVx).toBe(170);
  });
});
