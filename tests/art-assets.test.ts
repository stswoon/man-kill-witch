import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { SPRITE_H, SPRITE_W } from "../web/src/assets";
import { decodePng, type PngImage } from "./png";

const SPRITES = resolve(process.cwd(), "web/public/assets/sprites");

interface SheetSpec {
  file: string;
  columns: number;
  rows: number;
  /** Frames the animation catalog indexes; the rest of the cells are padding. */
  frames: number;
}

/** Frame grids of `docs/spec/03-art.md` and `docs/spec/05-animation.md`. */
const SHEETS: readonly SheetSpec[] = [
  { file: "s_hero.png", columns: 14, rows: 1, frames: 14 },
  { file: "s_chunk1.png", columns: 7, rows: 5, frames: 35 },
  { file: "s_chunk2.png", columns: 5, rows: 5, frames: 20 },
];

function sheet(spec: SheetSpec): PngImage {
  return decodePng(readFileSync(join(SPRITES, spec.file)));
}

/** True when at least one pixel of the 120x160 frame is not fully transparent. */
function frameFilled(image: PngImage, index: number, columns: number): boolean {
  const left = (index % columns) * SPRITE_W;
  const top = Math.floor(index / columns) * SPRITE_H;
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      const alpha = ((top + y) * image.width + left + x) * 4 + 3;
      if (image.rgba[alpha] > 0) return true;
    }
  }
  return false;
}

describe("sprite sheets", () => {
  test("match the 120x160 frame grid of the animation catalog", () => {
    for (const spec of SHEETS) {
      const image = sheet(spec);
      expect([image.width, image.height], spec.file).toEqual([
        spec.columns * SPRITE_W,
        spec.rows * SPRITE_H,
      ]);
      expect(spec.columns * spec.rows, `${spec.file} frame count`).toBeGreaterThanOrEqual(spec.frames);
    }
  });

  test("hero frames 0-6 and 13 are drawn", () => {
    const spec = SHEETS[0];
    const image = sheet(spec);
    for (const frame of [0, 1, 2, 3, 4, 5, 6, 13]) {
      expect(frameFilled(image, frame, spec.columns), `hero frame ${frame} is empty`).toBe(true);
    }
  });

  test("chunk2 reserves cells 20-24 as transparent padding", () => {
    const spec = SHEETS[2];
    const image = sheet(spec);
    for (let frame = spec.frames; frame < spec.columns * spec.rows; frame++) {
      expect(frameFilled(image, frame, spec.columns), `padding cell ${frame} must stay empty`).toBe(false);
    }
  });
});
