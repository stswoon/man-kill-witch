import { describe, expect, test } from "vitest";
import { TILE, TILE_FLAG_MASK } from "../web/src/assets";
import { DOOR, PLATFORM, SOLID, makeLevel } from "./helpers";

describe("Level.tileAt", () => {
  test("returns -1 outside the map", () => {
    const level = makeLevel({ width: 4, height: 3 });
    expect(level.tileAt(-1, 0)).toBe(-1);
    expect(level.tileAt(0, -1)).toBe(-1);
    expect(level.tileAt(4, 0)).toBe(-1);
    expect(level.tileAt(0, 3)).toBe(-1);
  });

  test("masks the flag bits away", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, 0x8000 | SOLID]] });
    expect(level.tileAt(1, 1)).toBe(SOLID);
  });

  test("converts the grid size to pixels", () => {
    const level = makeLevel({ width: 4, height: 3 });
    expect(level.pixelWidth).toBe(4 * TILE);
    expect(level.pixelHeight).toBe(3 * TILE);
  });
});

describe("Level.blocks", () => {
  test("reads the per-direction flags of a solid tile", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, SOLID]] });
    for (const dir of ["up", "down", "left", "right"] as const) {
      expect(level.blocks(1, 1, dir), dir).toBe(true);
    }
  });

  test("keeps empty tiles passable in every direction", () => {
    const level = makeLevel({ width: 4, height: 3 });
    for (const dir of ["up", "down", "left", "right"] as const) {
      expect(level.blocks(1, 1, dir), dir).toBe(false);
    }
  });

  test("treats a one-way platform as blocking only downwards", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, PLATFORM]] });
    expect(level.blocks(1, 1, "down")).toBe(true);
    expect(level.blocks(1, 1, "up")).toBe(false);
    expect(level.blocks(1, 1, "left")).toBe(false);
    expect(level.blocks(1, 1, "right")).toBe(false);
  });

  test("blocks every direction outside the map", () => {
    const level = makeLevel({ width: 4, height: 3 });
    expect(level.blocks(-1, 0, "left")).toBe(true);
    expect(level.blocks(4, 0, "right")).toBe(true);
    expect(level.blocks(0, -1, "up")).toBe(true);
    expect(level.blocks(0, 3, "down")).toBe(true);
  });
});

describe("Level.behaviorAt", () => {
  test("returns 0 outside the map", () => {
    const level = makeLevel({ width: 4, height: 3 });
    expect(level.behaviorAt(-1, 0)).toBe(0);
    expect(level.behaviorAt(0, 3)).toBe(0);
  });

  test("maps tile indices to behaviour ids", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, DOOR]] });
    expect(level.behaviorAt(1, 1)).toBe(2);
    expect(level.behaviorAt(0, 0)).toBe(0);
  });
});

describe("Level.setTile", () => {
  test("keeps the high flag bits of the cell", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, 0x8000 | SOLID]] });
    level.setTile(1, 1, 0);
    expect(level.tiles[1 * 4 + 1]).toBe(0x8000);
    expect(level.tileAt(1, 1)).toBe(0);
  });

  test("masks the new index to ten bits", () => {
    const level = makeLevel({ width: 4, height: 3 });
    level.setTile(1, 1, 0xffff);
    expect(level.tileAt(1, 1)).toBe(TILE_FLAG_MASK);
  });

  test("ignores writes outside the map", () => {
    const level = makeLevel({ width: 4, height: 3 });
    level.setTile(-1, 0, SOLID);
    level.setTile(0, 3, SOLID);
    expect(level.tiles.every((value) => value === 0)).toBe(true);
  });
});
