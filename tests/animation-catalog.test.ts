import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { ANIMATIONS } from "../web/src/animation-catalog";
import { registerAnimations } from "../web/src/animations";

const EXPECTED_KEYS = [
  "hero-idle",
  "hero-run",
  "hero-jump",
  "enemy-2",
  "enemy-3",
  "enemy-4",
  "enemy-5",
  "enemy-6",
  "enemy-7",
  "enemy-8",
  "enemy-9",
  "enemy-10",
  "enemy-11",
  "enemy-12",
];

/** Sprite id -> sprite sheet -> first frame; every group is five frames long. */
const ENEMY_GROUPS: ReadonlyArray<readonly [sprite: number, texture: string, start: number]> = [
  [2, "chunk1", 0],
  [3, "chunk1", 5],
  [4, "chunk1", 10],
  [5, "chunk1", 15],
  [6, "chunk1", 20],
  [7, "chunk1", 25],
  [8, "chunk1", 30],
  [9, "chunk2", 0],
  [10, "chunk2", 5],
  [11, "chunk2", 10],
  [12, "chunk2", 15],
];

function spec(key: string) {
  const found = ANIMATIONS.find((animation) => animation.key === key);
  if (!found) throw new Error(`missing animation "${key}"`);
  return found;
}

describe("animation catalog", () => {
  test("lists the hero and every enemy variant once", () => {
    expect(ANIMATIONS.map((animation) => animation.key)).toEqual(EXPECTED_KEYS);
  });

  test("hero idles on frame 0, runs frames 1-6 and jumps on frame 13", () => {
    expect(spec("hero-idle")).toMatchObject({ texture: "hero", start: 0, end: 0 });
    expect(spec("hero-run")).toMatchObject({ texture: "hero", start: 1, end: 6 });
    expect(spec("hero-jump")).toMatchObject({ texture: "hero", start: 13, end: 13 });
  });

  test("hero-run plays at 14 fps", () => {
    expect(spec("hero-run").frameRate).toBe(14);
  });

  test("every enemy variant plays its own five-frame group on the right sheet", () => {
    for (const [sprite, texture, start] of ENEMY_GROUPS) {
      expect(spec(`enemy-${sprite}`), `enemy-${sprite}`).toMatchObject({
        texture,
        start,
        end: start + 4,
      });
    }
  });

  test("enemy animations play at 8.75 fps", () => {
    for (const [sprite] of ENEMY_GROUPS) {
      expect(spec(`enemy-${sprite}`).frameRate, `enemy-${sprite}`).toBe(8.75);
    }
  });

  test("every animation loops forever", () => {
    for (const animation of ANIMATIONS) {
      expect(animation.repeat, animation.key).toBe(-1);
    }
  });

  test("frame ranges are ordered, positive and have a real frame rate", () => {
    for (const animation of ANIMATIONS) {
      expect(Number.isInteger(animation.start), animation.key).toBe(true);
      expect(Number.isInteger(animation.end), animation.key).toBe(true);
      expect(animation.start, animation.key).toBeGreaterThanOrEqual(0);
      expect(animation.end, animation.key).toBeGreaterThanOrEqual(animation.start);
      expect(animation.frameRate, animation.key).toBeGreaterThan(0);
    }
  });

  test("stays pure data without a Phaser import", () => {
    const source = readFileSync(resolve(process.cwd(), "web/src/animation-catalog.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']phaser["']/);
    expect(source).not.toMatch(/require\(\s*["']phaser["']\s*\)/);
  });
});

interface CreatedAnimation {
  key: string;
  textures: string[];
  frames: number[];
  frameRate: number;
  repeat: number;
}

type SceneArg = Parameters<typeof registerAnimations>[0];

/** Stands in for `scene.anims` so the registration can be tested without a Phaser game. */
function fakeScene(): { scene: SceneArg; created: CreatedAnimation[] } {
  const registered = new Set<string>();
  const created: CreatedAnimation[] = [];

  const anims = {
    exists: (key: string) => registered.has(key),
    generateFrameNumbers: (texture: string, config: { start: number; end: number }) => {
      const frames: { key: string; frame: number }[] = [];
      for (let frame = config.start; frame <= config.end; frame++) {
        frames.push({ key: texture, frame });
      }
      return frames;
    },
    create: (config: {
      key: string;
      frames: { key: string; frame: number }[];
      frameRate: number;
      repeat: number;
    }) => {
      registered.add(config.key);
      created.push({
        key: config.key,
        textures: config.frames.map((frame) => frame.key),
        frames: config.frames.map((frame) => frame.frame),
        frameRate: config.frameRate,
        repeat: config.repeat,
      });
    },
  };

  return { scene: { anims } as unknown as SceneArg, created };
}

describe("registerAnimations", () => {
  test("creates every catalog animation from its frames, rate and repeat", () => {
    const { scene, created } = fakeScene();
    registerAnimations(scene);

    expect(created.map((animation) => animation.key)).toEqual(EXPECTED_KEYS);
    expect(created.find((animation) => animation.key === "hero-run")).toEqual({
      key: "hero-run",
      textures: ["hero", "hero", "hero", "hero", "hero", "hero"],
      frames: [1, 2, 3, 4, 5, 6],
      frameRate: 14,
      repeat: -1,
    });
    expect(created.find((animation) => animation.key === "enemy-9")).toEqual({
      key: "enemy-9",
      textures: ["chunk2", "chunk2", "chunk2", "chunk2", "chunk2"],
      frames: [0, 1, 2, 3, 4],
      frameRate: 8.75,
      repeat: -1,
    });
  });

  test("skips keys that are already registered", () => {
    const { scene, created } = fakeScene();
    registerAnimations(scene);
    const afterFirstCall = created.length;

    registerAnimations(scene);

    expect(afterFirstCall).toBe(EXPECTED_KEYS.length);
    expect(created).toHaveLength(EXPECTED_KEYS.length);
  });
});
