import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { decodePng, type PngImage } from "./png";

const FRAME_W = 120;
const FRAME_H = 160;
const REQUIRED_FRAMES = [0, 1, 2, 3, 4, 5, 6, 13];
const source = readFileSync(resolve(process.cwd(), "web/public/assets/sprites/s_hero.png"));
const hero = decodePng(source);

function alphaBounds(image: PngImage, frame: number) {
  let minX = FRAME_W;
  let maxX = -1;
  let minY = FRAME_H;
  let maxY = -1;
  let pixels = 0;
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const alpha = image.rgba[(y * image.width + frame * FRAME_W + x) * 4 + 3];
      if (alpha === 0) continue;
      pixels++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY, pixels };
}

describe("S14 original HD Silas hero", () => {
  test("is an 8-bit RGBA PNG with fourteen 120x160 cells", () => {
    expect(source.readUInt32BE(16)).toBe(1680);
    expect(source.readUInt32BE(20)).toBe(160);
    expect(source[24]).toBe(8);
    expect(source[25]).toBe(6);
    expect([hero.width, hero.height]).toEqual([14 * FRAME_W, FRAME_H]);
    expect(hero.width / FRAME_W * (hero.height / FRAME_H)).toBe(14);
  });

  test.each(REQUIRED_FRAMES)("frame %i is drawn and alpha-bbox is centred within 10 px", (frame) => {
    const bounds = alphaBounds(hero, frame);
    expect(bounds.pixels, `frame ${frame} is empty`).toBeGreaterThan(0);
    const centre = (bounds.minX + bounds.maxX + 1) / 2;
    expect(Math.abs(centre - FRAME_W / 2), `frame ${frame} centre is ${centre}`).toBeLessThanOrEqual(10);
    // Space around the hat/shotgun/coat avoids clipping and cell bleeding.
    expect(bounds.minX).toBeGreaterThan(0);
    expect(bounds.maxX).toBeLessThan(FRAME_W - 1);
    expect(bounds.minY).toBeGreaterThan(0);
  });

  test("has transparent frame corners and a grounded idle footline", () => {
    for (const frame of REQUIRED_FRAMES) {
      for (const [x, y] of [[0, 0], [FRAME_W - 1, 0], [0, FRAME_H - 1], [FRAME_W - 1, FRAME_H - 1]]) {
        expect(hero.rgba[(y * hero.width + frame * FRAME_W + x) * 4 + 3]).toBe(0);
      }
    }
    expect(alphaBounds(hero, 0).maxY).toBeGreaterThanOrEqual(FRAME_H - 2);
  });
});
