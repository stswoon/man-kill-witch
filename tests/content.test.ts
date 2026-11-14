import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import {
  LEVEL_COUNT,
  SPRITE_NAMES,
  TILE,
  TILE_FLAG_MASK,
  type LevelData,
  type TileInfoData,
} from "../web/src/assets";
import { Level, type Dir } from "../web/src/game";

const ASSETS = resolve(process.cwd(), "web/public/assets");
const LEVEL_DIR = join(ASSETS, "levels");
const DIRS: Dir[] = ["up", "down", "left", "right"];

const info = JSON.parse(readFileSync(join(ASSETS, "tileinfo.json"), "utf8")) as TileInfoData;
const levelFiles = readdirSync(LEVEL_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();
const levels = levelFiles.map(
  (name) => JSON.parse(readFileSync(join(LEVEL_DIR, name), "utf8")) as LevelData,
);

describe("tileinfo.json", () => {
  test("lists every tile index in every column", () => {
    assert.equal(info.blockUp.length, info.count);
    assert.equal(info.blockDown.length, info.count);
    assert.equal(info.blockLeft.length, info.count);
    assert.equal(info.blockRight.length, info.count);
    assert.equal(info.flags.length, info.count);
    assert.equal(info.behavior.length, info.count);
  });

  test("covers the tile indices used by the levels", () => {
    const used = Math.max(...levels.flatMap((level) => level.tiles.map((t) => t & TILE_FLAG_MASK)));
    assert.ok(used < info.count, `level tile ${used} must exist in tileinfo (count ${info.count})`);
  });
});

describe("level files", () => {
  test("match LEVEL_COUNT", () => {
    assert.equal(levelFiles.length, LEVEL_COUNT);
    assert.deepEqual(
      levelFiles,
      Array.from({ length: LEVEL_COUNT }, (_, i) => `${String(i + 1).padStart(2, "0")}.json`),
    );
  });
});

for (const [index, data] of levels.entries()) {
  const name = levelFiles[index];

  describe(name, () => {
    const level = new Level(data, info);

    test("dimensions match the flat tile and entity arrays", () => {
      assert.ok(Number.isInteger(data.width) && data.width > 0);
      assert.ok(Number.isInteger(data.height) && data.height > 0);
      assert.equal(data.tiles.length, data.width * data.height);
      assert.equal(data.entities.length, data.width * data.height);
      assert.equal(level.pixelWidth, data.width * TILE);
      assert.equal(level.pixelHeight, data.height * TILE);
    });

    test("uses only tile indices known to tileinfo", () => {
      for (const value of data.tiles) {
        const tile = value & TILE_FLAG_MASK;
        assert.ok(Number.isInteger(value));
        assert.ok(tile < info.count, `tile ${tile} is outside tileinfo (count ${info.count})`);
      }
    });

    test("has exactly one spawn marker", () => {
      const spawns = data.entities.filter((id) => id === 255);
      assert.equal(spawns.length, 1);
    });

    test("spawns the player outside of solid tiles", () => {
      const marker = data.entities.indexOf(255);
      const tx = marker % data.width;
      const ty = Math.floor(marker / data.width);

      for (const dir of DIRS) {
        assert.equal(level.blocks(tx, ty, dir), false, `spawn is blocked on the ${dir} side`);
      }
    });

    test("has an exit door", () => {
      const doors = data.tiles.filter((value) => {
        const behavior = info.behavior[value & TILE_FLAG_MASK];
        return behavior === 1 || behavior === 2;
      });
      assert.ok(doors.length > 0, "the level cannot be completed without a door tile");
    });
  });
}

describe("asset manifest", () => {
  test("contains every file BootScene loads", () => {
    const expected = [
      "tiles.png",
      "title1.png",
      "tileinfo.json",
      ...Array.from({ length: LEVEL_COUNT }, (_, i) => join("levels", `${String(i + 1).padStart(2, "0")}.json`)),
      ...SPRITE_NAMES.map((name) => join("sprites", `s_${name}.png`)),
    ];

    for (const file of expected) {
      assert.ok(existsSync(join(ASSETS, file)), `missing asset: ${file}`);
    }
  });
});
