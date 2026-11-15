import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  LEVEL_COUNT,
  SCREEN_H,
  SCREEN_W,
  SPRITE_NAMES,
  TILE,
  TILE_FLAG_MASK,
  type LevelData,
  type TileInfoData,
} from "../web/src/assets";
import { Level, type Dir } from "../web/src/game";
import { decodePng } from "./png";

const ASSETS = resolve(process.cwd(), "web/public/assets");
const LEVEL_DIR = join(ASSETS, "levels");
const DIRS: Dir[] = ["up", "down", "left", "right"];

/** Legacy files removed in S02: no code or test loads them. */
const REMOVED_ASSETS = [
  "PROGPIC.bin",
  "STARPIC.bin",
  "title2.png",
  join("sprites", "s_frank.png"),
  join("sprites", "s_frank.json"),
  join("sprites", "s_master.png"),
  join("sprites", "s_master.json"),
  join("sprites", "s_hero.json"),
  join("sprites", "s_chunk1.json"),
  join("sprites", "s_chunk2.json"),
];

const info = JSON.parse(readFileSync(join(ASSETS, "tileinfo.json"), "utf8")) as TileInfoData;
const levelFiles = readdirSync(LEVEL_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();
const levels = levelFiles.map(
  (name) => JSON.parse(readFileSync(join(LEVEL_DIR, name), "utf8")) as LevelData,
);

describe("tileinfo.json", () => {
  test("lists every tile index in every column", () => {
    expect(info.blockUp).toHaveLength(info.count);
    expect(info.blockDown).toHaveLength(info.count);
    expect(info.blockLeft).toHaveLength(info.count);
    expect(info.blockRight).toHaveLength(info.count);
    expect(info.flags).toHaveLength(info.count);
    expect(info.behavior).toHaveLength(info.count);
  });

  test("covers the tile indices used by the levels", () => {
    const used = Math.max(...levels.flatMap((level) => level.tiles.map((t) => t & TILE_FLAG_MASK)));
    expect(used, `level tile ${used} must exist in tileinfo (count ${info.count})`).toBeLessThan(info.count);
  });
});

describe("level files", () => {
  test("match LEVEL_COUNT", () => {
    expect(levelFiles).toHaveLength(LEVEL_COUNT);
    expect(levelFiles).toEqual(
      Array.from({ length: LEVEL_COUNT }, (_, i) => `${String(i + 1).padStart(2, "0")}.json`),
    );
  });
});

for (const [index, data] of levels.entries()) {
  const name = levelFiles[index];

  describe(name, () => {
    const level = new Level(data, info);

    test("dimensions match the flat tile and entity arrays", () => {
      expect(Number.isInteger(data.width)).toBe(true);
      expect(data.width).toBeGreaterThan(0);
      expect(Number.isInteger(data.height)).toBe(true);
      expect(data.height).toBeGreaterThan(0);
      expect(data.tiles).toHaveLength(data.width * data.height);
      expect(data.entities).toHaveLength(data.width * data.height);
      expect(level.pixelWidth).toBe(data.width * TILE);
      expect(level.pixelHeight).toBe(data.height * TILE);
    });

    test("uses only tile indices known to tileinfo", () => {
      for (const value of data.tiles) {
        const tile = value & TILE_FLAG_MASK;
        expect(Number.isInteger(value), `tile value ${value} must be an integer`).toBe(true);
        expect(tile, `tile ${tile} is outside tileinfo (count ${info.count})`).toBeLessThan(info.count);
      }
    });

    test("has exactly one spawn marker", () => {
      const spawns = data.entities.filter((id) => id === 255);
      expect(spawns).toHaveLength(1);
    });

    test("spawns the player outside of solid tiles", () => {
      const marker = data.entities.indexOf(255);
      const tx = marker % data.width;
      const ty = Math.floor(marker / data.width);

      for (const dir of DIRS) {
        expect(level.blocks(tx, ty, dir), `spawn is blocked on the ${dir} side`).toBe(false);
      }
    });

    test("has an exit door", () => {
      const doors = data.tiles.filter((value) => {
        const behavior = info.behavior[value & TILE_FLAG_MASK];
        return behavior === 1 || behavior === 2;
      });
      expect(doors.length, "the level cannot be completed without a door tile").toBeGreaterThan(0);
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
      expect(existsSync(join(ASSETS, file)), `missing asset: ${file}`).toBe(true);
    }
  });

  test("does not contain the removed legacy files", () => {
    for (const file of REMOVED_ASSETS) {
      expect(existsSync(join(ASSETS, file)), `stale asset must be deleted: ${file}`).toBe(false);
    }
  });
});

describe("Png dimensions", () => {
  test("title screen is Full HD", () => {
    const png = decodePng(readFileSync(join(ASSETS, "title1.png")));
    expect([png.width, png.height]).toEqual([SCREEN_W, SCREEN_H]);
  });

  test("tileset keeps the 32x27 grid of 80px cells", () => {
    const png = decodePng(readFileSync(join(ASSETS, "tiles.png")));
    expect([png.width, png.height]).toEqual([32 * TILE, 27 * TILE]);
    expect([png.width, png.height]).toEqual([2560, 2160]);
  });
});

describe("reference grid", () => {
  test("keeps 384x216 units at five screen pixels per unit", () => {
    expect(SCREEN_W / 5).toBe(384);
    expect(SCREEN_H / 5).toBe(216);
    expect(TILE / 5).toBe(16);
  });

  test("shows 24 x 13.5 tiles of the world", () => {
    expect(SCREEN_W / TILE).toBe(24);
    expect(SCREEN_H / TILE).toBe(13.5);
  });
});
