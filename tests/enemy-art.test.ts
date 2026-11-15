import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { ANIMATIONS } from "../web/src/animation-catalog";
import { SPRITE_H, SPRITE_W } from "../web/src/assets";
import { decodePng, type PngImage } from "./png";

const SPRITES = resolve(process.cwd(), "web/public/assets/sprites");
const SHEETS = [
  { texture: "chunk1", file: "s_chunk1.png", width: 840, columns: 7, frames: 35 },
  { texture: "chunk2", file: "s_chunk2.png", width: 600, columns: 5, frames: 20 },
] as const;
const images = SHEETS.map((spec) => decodePng(readFileSync(join(SPRITES, spec.file))));

function frameAlpha(image: PngImage, columns: number, frame: number): Uint8Array {
  const mask = new Uint8Array(SPRITE_W * SPRITE_H);
  const left = (frame % columns) * SPRITE_W;
  const top = Math.floor(frame / columns) * SPRITE_H;
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      mask[y * SPRITE_W + x] = image.rgba[((top + y) * image.width + left + x) * 4 + 3];
    }
  }
  return mask;
}

function fingerprint(mask: Uint8Array): string {
  return createHash("sha256").update(mask).digest("hex");
}

/**
 * Compare shapes, not palette or their position in the frame. Union the five
 * poses, crop to the occupied bounds, then sample into a common 40x40 mask.
 * A recoloured or translated copy of the same creature cannot pass this check.
 */
function silhouette(poses: readonly Uint8Array[]): Uint8Array {
  const union = new Uint8Array(SPRITE_W * SPRITE_H);
  let left = SPRITE_W;
  let right = 0;
  let top = SPRITE_H;
  let bottom = 0;
  for (const pose of poses) {
    for (let y = 0; y < SPRITE_H; y++) {
      for (let x = 0; x < SPRITE_W; x++) {
        if (pose[y * SPRITE_W + x] < 64) continue;
        union[y * SPRITE_W + x] = 1;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  const result = new Uint8Array(40 * 40);
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      const sx = left + Math.min(right - left, Math.floor((x + 0.5) * (right - left + 1) / 40));
      const sy = top + Math.min(bottom - top, Math.floor((y + 0.5) * (bottom - top + 1) / 40));
      result[y * 40 + x] = union[sy * SPRITE_W + sx];
    }
  }
  return result;
}

function shapeDifference(a: Uint8Array, b: Uint8Array): number {
  let changed = 0;
  let occupied = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) occupied++;
    if (a[i] !== b[i]) changed++;
  }
  return changed / occupied;
}

describe("S15 original HD enemy artwork", () => {
  test("keeps the two exact sheet geometries and 35/20 catalogued frames", () => {
    expect([SPRITE_W, SPRITE_H]).toEqual([120, 160]);
    SHEETS.forEach((spec, i) => {
      expect([images[i].width, images[i].height], spec.file).toEqual([spec.width, 800]);
      const animations = ANIMATIONS.filter((animation) =>
        animation.key.startsWith("enemy-") && animation.texture === spec.texture);
      const frames = animations.flatMap((animation) =>
        Array.from({ length: animation.end - animation.start + 1 }, (_, n) => animation.start + n));
      expect(frames, `${spec.file}: catalog coverage`).toEqual(
        Array.from({ length: spec.frames }, (_, n) => n),
      );
      for (const frame of frames) {
        const alpha = frameAlpha(images[i], spec.columns, frame);
        expect(alpha.filter((value) => value > 64).length, `${spec.file} frame ${frame}`).toBeGreaterThan(500);
      }
    });
  });

  test("leaves every pixel of chunk2 cells 20-24 transparent", () => {
    for (let frame = 20; frame <= 24; frame++) {
      expect(frameAlpha(images[1], 5, frame).some((alpha) => alpha !== 0), `padding ${frame}`).toBe(false);
    }
  });

  test("animates all eleven sprite groups with at least two different silhouette poses", () => {
    const ids: number[] = [];
    SHEETS.forEach((spec, sheetIndex) => {
      for (let start = 0; start < spec.frames; start += 5) {
        const id = (sheetIndex === 0 ? 2 : 9) + start / 5;
        ids.push(id);
        const poses = Array.from({ length: 5 }, (_, f) => frameAlpha(images[sheetIndex], spec.columns, start + f));
        expect(new Set(poses.map(fingerprint)).size, `enemy-${id} is static`).toBeGreaterThanOrEqual(2);
        const opaque = poses.map((pose) => pose.map((alpha) => alpha >= 64 ? 1 : 0));
        expect(new Set(opaque.map(fingerprint)).size, `enemy-${id} only changes colour`).toBeGreaterThanOrEqual(2);
      }
    });
    expect(ids).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test("has eleven materially distinct silhouettes, not translated or recoloured copies", () => {
    const shapes: { id: number; mask: Uint8Array }[] = [];
    SHEETS.forEach((spec, sheetIndex) => {
      for (let start = 0; start < spec.frames; start += 5) {
        shapes.push({
          id: (sheetIndex === 0 ? 2 : 9) + start / 5,
          mask: silhouette(Array.from({ length: 5 }, (_, f) =>
            frameAlpha(images[sheetIndex], spec.columns, start + f))),
        });
      }
    });
    expect(new Set(shapes.map((shape) => fingerprint(shape.mask))).size).toBe(11);
    for (let a = 0; a < shapes.length; a++) {
      for (let b = a + 1; b < shapes.length; b++) {
        expect(
          shapeDifference(shapes[a].mask, shapes[b].mask),
          `enemy-${shapes[a].id} / enemy-${shapes[b].id}: silhouette separation`,
        ).toBeGreaterThan(0.1);
      }
    }
  });

  test("keeps transparent side margins and grounded soles in all ground-enemy poses", () => {
    SHEETS.forEach((spec, sheetIndex) => {
      for (let frame = 0; frame < spec.frames; frame++) {
        const id = (sheetIndex === 0 ? 2 : 9) + Math.floor(frame / 5);
        const alpha = frameAlpha(images[sheetIndex], spec.columns, frame);
        for (let y = 0; y < SPRITE_H; y++) {
          expect(alpha[y * SPRITE_W], `enemy-${id}: left edge`).toBe(0);
          expect(alpha[y * SPRITE_W + SPRITE_W - 1], `enemy-${id}: right edge`).toBe(0);
        }
        expect(alpha.slice(0, SPRITE_W * 80).some((value) => value > 0), `enemy-${id}: upper margin`).toBe(false);
        if (id !== 9) {
          expect(
            alpha.slice(SPRITE_W * 158).some((value) => value > 64),
            `enemy-${id} frame ${frame}: feet must remain on the baseline`,
          ).toBe(true);
        }
      }
    });
  });
});
