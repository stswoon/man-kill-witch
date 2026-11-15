/**
 * Data-only animation catalog: `animations.ts` turns every entry into a Phaser
 * animation. Frames, rates and loops come from `docs/spec/05-animation.md` and
 * stay free of Phaser imports so they can be tested without a running game.
 */
export interface AnimationSpec {
  /** Animation key, also used by the view when it calls `play`. */
  readonly key: string;
  /** Sprite sheet that holds the frames: `hero`, `chunk1` or `chunk2`. */
  readonly texture: string;
  /** First frame of a contiguous range. */
  readonly start: number;
  /** Last frame of the range; equals `start` for a still frame. */
  readonly end: number;
  /** Frames per second. */
  readonly frameRate: number;
  /** `-1` loops forever; still frames loop too, so Phaser keeps showing them. */
  readonly repeat: number;
}

/** 70 / 5 ticks per frame, from the old tick-based timing. */
const HERO_FPS = 14;
/** 70 / 8 ticks per frame, from the old tick-based timing. */
const ENEMY_FPS = 8.75;
/** Stills do not animate; Phaser still wants a positive rate. */
const STILL_FPS = 1;

export const ANIMATIONS: readonly AnimationSpec[] = [
  { key: "hero-idle", texture: "hero", start: 0, end: 0, frameRate: STILL_FPS, repeat: -1 },
  { key: "hero-run", texture: "hero", start: 1, end: 6, frameRate: HERO_FPS, repeat: -1 },
  { key: "hero-jump", texture: "hero", start: 13, end: 13, frameRate: STILL_FPS, repeat: -1 },

  { key: "enemy-2", texture: "chunk1", start: 0, end: 4, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-3", texture: "chunk1", start: 5, end: 9, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-4", texture: "chunk1", start: 10, end: 14, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-5", texture: "chunk1", start: 15, end: 19, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-6", texture: "chunk1", start: 20, end: 24, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-7", texture: "chunk1", start: 25, end: 29, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-8", texture: "chunk1", start: 30, end: 34, frameRate: ENEMY_FPS, repeat: -1 },

  { key: "enemy-9", texture: "chunk2", start: 0, end: 4, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-10", texture: "chunk2", start: 5, end: 9, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-11", texture: "chunk2", start: 10, end: 14, frameRate: ENEMY_FPS, repeat: -1 },
  { key: "enemy-12", texture: "chunk2", start: 15, end: 19, frameRate: ENEMY_FPS, repeat: -1 },
];
