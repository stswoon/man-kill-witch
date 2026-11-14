import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TILE, TILE_FLAG_MASK } from "../web/src/assets";
import { DOOR, PLATFORM, SOLID, makeLevel } from "./helpers";

describe("Level.tileAt", () => {
  test("returns -1 outside the map", () => {
    const level = makeLevel({ width: 4, height: 3 });
    assert.equal(level.tileAt(-1, 0), -1);
    assert.equal(level.tileAt(0, -1), -1);
    assert.equal(level.tileAt(4, 0), -1);
    assert.equal(level.tileAt(0, 3), -1);
  });

  test("masks the flag bits away", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, 0x8000 | SOLID]] });
    assert.equal(level.tileAt(1, 1), SOLID);
  });

  test("converts the grid size to pixels", () => {
    const level = makeLevel({ width: 4, height: 3 });
    assert.equal(level.pixelWidth, 4 * TILE);
    assert.equal(level.pixelHeight, 3 * TILE);
  });
});

describe("Level.blocks", () => {
  test("reads the per-direction flags of a solid tile", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, SOLID]] });
    for (const dir of ["up", "down", "left", "right"] as const) {
      assert.equal(level.blocks(1, 1, dir), true, dir);
    }
  });

  test("keeps empty tiles passable in every direction", () => {
    const level = makeLevel({ width: 4, height: 3 });
    for (const dir of ["up", "down", "left", "right"] as const) {
      assert.equal(level.blocks(1, 1, dir), false, dir);
    }
  });

  test("treats a one-way platform as blocking only downwards", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, PLATFORM]] });
    assert.equal(level.blocks(1, 1, "down"), true);
    assert.equal(level.blocks(1, 1, "up"), false);
    assert.equal(level.blocks(1, 1, "left"), false);
    assert.equal(level.blocks(1, 1, "right"), false);
  });

  test("blocks every direction outside the map", () => {
    const level = makeLevel({ width: 4, height: 3 });
    assert.equal(level.blocks(-1, 0, "left"), true);
    assert.equal(level.blocks(4, 0, "right"), true);
    assert.equal(level.blocks(0, -1, "up"), true);
    assert.equal(level.blocks(0, 3, "down"), true);
  });
});

describe("Level.behaviorAt", () => {
  test("returns 0 outside the map", () => {
    const level = makeLevel({ width: 4, height: 3 });
    assert.equal(level.behaviorAt(-1, 0), 0);
    assert.equal(level.behaviorAt(0, 3), 0);
  });

  test("maps tile indices to behaviour ids", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, DOOR]] });
    assert.equal(level.behaviorAt(1, 1), 2);
    assert.equal(level.behaviorAt(0, 0), 0);
  });
});

describe("Level.setTile", () => {
  test("keeps the high flag bits of the cell", () => {
    const level = makeLevel({ width: 4, height: 3, tiles: [[1, 1, 0x8000 | SOLID]] });
    level.setTile(1, 1, 0);
    assert.equal(level.tiles[1 * 4 + 1], 0x8000);
    assert.equal(level.tileAt(1, 1), 0);
  });

  test("masks the new index to ten bits", () => {
    const level = makeLevel({ width: 4, height: 3 });
    level.setTile(1, 1, 0xffff);
    assert.equal(level.tileAt(1, 1), TILE_FLAG_MASK);
  });

  test("ignores writes outside the map", () => {
    const level = makeLevel({ width: 4, height: 3 });
    level.setTile(-1, 0, SOLID);
    level.setTile(0, 3, SOLID);
    assert.equal(level.tiles.every((value) => value === 0), true);
  });
});
