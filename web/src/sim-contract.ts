/**
 * The pure contract between the rules (`game.ts`) and the Arcade layer
 * (`arcade/*`). It carries no Phaser import, so both sides can be compiled and
 * tested on their own, and the rules stay free of the physics engine.
 */

/** Fixed logic tick, seconds. The rules and the Arcade world share it. */
export const TICK = 1 / 70;

// Physics values are product decisions; the reference table lives in
// docs/design.md. They are the previous 16-px values x5.
export const GRAVITY = 4900;
export const RUN_SPEED = 660;
export const ACCEL = 7000;
export const FRICTION = 9000;
export const JUMP_SPEED = 1500;
export const MAX_FALL = 2600;
export const BULLET_SPEED = 1900;
export const BULLET_LIFE = 40;
export const SHOT_COOLDOWN = 8;
export const RELOAD_TICKS = 26;
export const MAGAZINE = 8;

/** Arcade body sizes, in screen px. */
export const PLAYER_W = 60;
export const PLAYER_H = 120;
export const ENEMY_W = 60;
export const ENEMY_H = 60;
/** Drawn as 15x5, but the hit box is 15x10 so edge-on shots still land. */
export const BULLET_W = 15;
export const BULLET_H = 10;

/** Collision flags of one body against the level geometry. */
export interface BlockedSides {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

export interface PlayerSnapshot {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  blocked: BlockedSides;
  /** Facing for the sprite flip: `1` right, `-1` left. */
  dir: number;
}

export interface EnemySnapshot {
  /** Same id as the rules enemy it was spawned from. */
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  blocked: BlockedSides;
  dir: number;
  alive: boolean;
  /** Sprite id that picks the texture and the animation key. */
  sprite: number;
}

export interface BulletSnapshot {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

/** What the Arcade bodies did during the previous step. */
export type PhysicsEvent =
  | { type: "bulletHitEnemy"; bulletId: number; enemyId: number }
  | { type: "bulletHitWall"; bulletId: number }
  | { type: "playerTouchedEnemy"; enemyId: number };

/** Start-of-tick view of the Arcade world. */
export interface WorldSnapshot {
  player: PlayerSnapshot;
  enemies: EnemySnapshot[];
  bullets: BulletSnapshot[];
  /** Collisions of the previous step; may lag the rules by one tick. */
  events: PhysicsEvent[];
}

/** What the rules want the hero to do this tick. */
export interface PlayerIntent {
  targetVx: number;
  jump: boolean;
  facing: number;
}

/** What the rules want one enemy to do this tick. */
export interface EnemyIntent {
  id: number;
  targetVx: number;
  dir: number;
  /** Vertical speed of a flyer; `0` for walkers and chargers. */
  flyerVy: number;
}

export interface BulletSpawn {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RespawnPoint {
  x: number;
  y: number;
}

/** One tick of rules decisions, applied to the Arcade world before its step. */
export interface TickCommands {
  player: PlayerIntent;
  enemies: EnemyIntent[];
  spawnBullet: BulletSpawn | null;
  /** Ids of bullets that hit a wall/enemy or ran out their 40 ticks. */
  despawnBullet: number[];
  killEnemy: number[];
  respawnPlayer: RespawnPoint | null;
}

/** Where the Arcade layer has to put its bodies on level start. */
export interface BodySpawn {
  x: number;
  y: number;
}

export interface EnemySpawn extends BodySpawn {
  id: number;
  sprite: number;
  fly: boolean;
}

export interface WorldSpawn {
  player: BodySpawn;
  enemies: readonly EnemySpawn[];
}

/** One changed tile cell; the rules own the list, Arcade and the view apply it. */
export interface TilePatch {
  x: number;
  y: number;
  index: number;
}
