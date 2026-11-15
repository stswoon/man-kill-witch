import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  DOOR_H,
  DOOR_W,
  HUD_FONT,
  HUD_TEXTURE,
  LEVEL_COUNT,
  SCREEN_H,
  SCREEN_W,
  SPRITE_NAMES,
  TILE,
  TILE_FLAG_MASK,
  type LevelData,
  type TileInfoData,
} from "../web/src/assets";
import { ANIMATIONS } from "../web/src/animation-catalog";
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
      "hud.png",
      join("fonts", "hud.png"),
      join("fonts", "hud.xml"),
      "tileinfo.json",
      ...Array.from({ length: LEVEL_COUNT }, (_, i) => join("levels", `${String(i + 1).padStart(2, "0")}.json`)),
      ...SPRITE_NAMES.map((name) => join("sprites", `s_${name}.png`)),
      join("sprites", "s_door.png"),
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

  test("door sheet is three 160x240 frames", () => {
    const door = ANIMATIONS.find((animation) => animation.key === "door-open");
    if (!door) throw new Error('missing animation "door-open"');
    const frames = door.end - door.start + 1;
    expect(frames, "door-open must show all three frames").toBe(3);

    const png = decodePng(readFileSync(join(ASSETS, "sprites", "s_door.png")));
    expect([png.width, png.height]).toEqual([frames * DOOR_W, DOOR_H]);
    expect([png.width, png.height]).toEqual([480, 240]);
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

/** The HUD contract from docs/spec/03-art.md and S17. */
const HUD_PANEL = { width: 680, height: 120 };
const HUD_CELL = { width: 25, height: 35 };
const HUD_LINE_HEIGHT = 40;
const HUD_X_ADVANCE = 30;
/** hud-view.ts places the two lines 20 px inside the panel at y = 15 and y = 65. */
const HUD_TEXT_LEFT = 20;
const HUD_TEXT_ROWS = [15, 65];
/** The full glyph set required by docs/spec/03-art.md: A-Z, 0-9, space and slash. */
const HUD_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /";
/** Widest realistic readout: level 8, nine lives, full ammo, six-digit score. */
const WIDEST_HUD_LINES = ["LVL 8/8   LIVES 9", "AMMO 8   SCORE 999999"];

interface BitmapGlyph {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly xoffset: number;
  readonly yoffset: number;
  readonly xadvance: number;
}

/** Reads the attributes of every `<tag ...>` element of a BMFont XML file. */
function tagAttributes(xml: string, tag: string): Record<string, string>[] {
  const elements: Record<string, string>[] = [];
  for (const element of xml.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))) {
    const attributes: Record<string, string> = {};
    for (const pair of element[1].matchAll(/([a-zA-Z]+)="([^"]*)"/g)) {
      attributes[pair[1]] = pair[2];
    }
    elements.push(attributes);
  }
  return elements;
}

function readGlyphs(xml: string): BitmapGlyph[] {
  return tagAttributes(xml, "char").map((attributes) => ({
    id: Number(attributes.id),
    x: Number(attributes.x),
    y: Number(attributes.y),
    width: Number(attributes.width),
    height: Number(attributes.height),
    xoffset: Number(attributes.xoffset),
    yoffset: Number(attributes.yoffset),
    xadvance: Number(attributes.xadvance),
  }));
}

function glyphName(glyph: BitmapGlyph): string {
  return glyph.id === 32 ? "space" : String.fromCharCode(glyph.id);
}

describe("HUD art", () => {
  const panelPath = join(ASSETS, "hud.png");
  const fontPngPath = join(ASSETS, "fonts", "hud.png");
  const fontXmlPath = join(ASSETS, "fonts", "hud.xml");

  test("keeps the texture and bitmap font keys", () => {
    expect([HUD_TEXTURE, HUD_FONT]).toEqual(["hud", "hud-font"]);
  });

  test("panel is 680x120", () => {
    const png = decodePng(readFileSync(panelPath));
    expect([png.width, png.height]).toEqual([HUD_PANEL.width, HUD_PANEL.height]);
  });

  test("font declares a 25x35 cell, 30 px advance and 40 px line height", () => {
    const xml = readFileSync(fontXmlPath, "utf8");
    const info = tagAttributes(xml, "info")[0];
    const common = tagAttributes(xml, "common")[0];
    if (!info) throw new Error("hud.xml has no <info> element");
    if (!common) throw new Error("hud.xml has no <common> element");

    // Phaser divides glyph metrics by the declared size, so it must be a positive integer.
    const size = Number(info.size);
    expect(Number.isInteger(size) && size > 0, `font size "${info.size}" must be a positive integer`)
      .toBe(true);
    expect(Number(common.lineHeight), "lineHeight").toBe(HUD_LINE_HEIGHT);

    const glyphs = readGlyphs(xml);
    expect(glyphs.length).toBeGreaterThan(0);
    for (const glyph of glyphs) {
      // Phaser reads every metric with parseInt, so a missing attribute becomes NaN.
      for (const key of ["x", "y", "width", "height", "xoffset", "yoffset", "xadvance"] as const) {
        expect(Number.isInteger(glyph[key]), `"${glyphName(glyph)}" has no integer ${key}`).toBe(true);
      }
      expect(glyph.xadvance, `xadvance of "${glyphName(glyph)}"`).toBe(HUD_X_ADVANCE);
    }
  });

  test("font contains every glyph the HUD prints", () => {
    const byId = new Map(readGlyphs(readFileSync(fontXmlPath, "utf8")).map((g) => [g.id, g]));

    for (const character of HUD_GLYPHS) {
      const glyph = byId.get(character.charCodeAt(0));
      if (!glyph) throw new Error(`hud.xml has no glyph "${character}"`);
      // A space may be an empty cell; every visible glyph must have pixels.
      if (character === " ") continue;
      expect(glyph.width, `glyph "${character}" is ${glyph.width} px wide`).toBeGreaterThan(0);
      expect(glyph.height, `glyph "${character}" is ${glyph.height} px tall`).toBeGreaterThan(0);
    }
  });

  test("glyphs stay inside their 25x35 cell and the atlas", () => {
    const atlas = decodePng(readFileSync(fontPngPath));

    for (const glyph of readGlyphs(readFileSync(fontXmlPath, "utf8"))) {
      const name = glyphName(glyph);
      expect(glyph.xoffset, `xoffset of "${name}"`).toBeGreaterThanOrEqual(0);
      expect(glyph.yoffset, `yoffset of "${name}"`).toBeGreaterThanOrEqual(0);
      expect(glyph.xoffset + glyph.width, `"${name}" leaves its ${HUD_CELL.width} px cell`)
        .toBeLessThanOrEqual(HUD_CELL.width);
      expect(glyph.yoffset + glyph.height, `"${name}" leaves its ${HUD_CELL.height} px cell`)
        .toBeLessThanOrEqual(HUD_CELL.height);
      expect(glyph.x, `"${name}" starts left of the atlas`).toBeGreaterThanOrEqual(0);
      expect(glyph.y, `"${name}" starts above the atlas`).toBeGreaterThanOrEqual(0);
      expect(glyph.x + glyph.width, `"${name}" overflows the atlas width`).toBeLessThanOrEqual(atlas.width);
      expect(glyph.y + glyph.height, `"${name}" overflows the atlas height`).toBeLessThanOrEqual(atlas.height);
    }
  });

  test("widest readout fits inside the panel", () => {
    const widest = Math.max(...WIDEST_HUD_LINES.map((line) => line.length));
    expect(HUD_TEXT_LEFT + widest * HUD_X_ADVANCE).toBeLessThanOrEqual(HUD_PANEL.width);
    for (const row of HUD_TEXT_ROWS) {
      expect(row + HUD_LINE_HEIGHT, `line at y=${row} leaves the panel`).toBeLessThanOrEqual(HUD_PANEL.height);
    }
  });
});
