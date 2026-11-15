import { TILE } from "../assets";
import type { Level } from "../game";
import type { WorldSnapshot } from "../sim-contract";
import type { BotBullet, BotEnemy, BotPlayer, BotPoint } from "./types";

/** Local ASCII window: enough for a jump arc, small enough for an LLM turn. */
export const WINDOW_RADIUS_X = 10;
export const WINDOW_RADIUS_Y = 6;
/** One minimap character covers a 4x4 block of tiles. */
export const MINIMAP_SCALE = 4;
export const WINDOW_LEGEND =
  "# wall, = one-way platform, . empty, D door, E exit, g gem, a ammo, m enemy, * player, P spawn";

/** The tile under the body centre; used for the window and the LLM's `tx/ty`. */
export function playerCenter(snapshot: WorldSnapshot): BotPoint {
  return {
    tx: Math.floor((snapshot.player.x + snapshot.player.w / 2) / TILE),
    ty: Math.floor((snapshot.player.y + snapshot.player.h / 2) / TILE),
  };
}

/** The row the feet rest in; useful for "stand on this floor" reasoning. */
export function playerFeetRow(snapshot: WorldSnapshot): number {
  return Math.floor((snapshot.player.y + snapshot.player.h - 1) / TILE);
}

export function describePlayer(snapshot: WorldSnapshot): BotPlayer {
  const body = snapshot.player;
  const center = playerCenter(snapshot);
  return {
    tx: center.tx,
    ty: center.ty,
    feetTy: playerFeetRow(snapshot),
    x: Math.round(body.x),
    y: Math.round(body.y),
    w: body.w,
    h: body.h,
    vx: Math.round(body.vx),
    vy: Math.round(body.vy),
    onGround: body.onGround,
    facing: body.dir,
    blocked: body.blocked,
  };
}

/** Local ASCII window centred on the hero. */
export function buildWindow(
  level: Level,
  center: BotPoint,
  snapshot: WorldSnapshot,
  spawn: BotPoint,
): string[] {
  const rows: string[] = [];
  for (let dy = -WINDOW_RADIUS_Y; dy <= WINDOW_RADIUS_Y; dy++) {
    let row = "";
    for (let dx = -WINDOW_RADIUS_X; dx <= WINDOW_RADIUS_X; dx++) {
      row += windowChar(level, center.tx + dx, center.ty + dy, snapshot, spawn);
    }
    rows.push(row);
  }
  return rows;
}

function windowChar(
  level: Level,
  tx: number,
  ty: number,
  snapshot: WorldSnapshot,
  spawn: BotPoint,
): string {
  const center = playerCenter(snapshot);
  if (tx === center.tx && ty === center.ty) return "*";
  for (const body of snapshot.enemies) {
    if (!body.alive) continue;
    const enemyTx = Math.floor((body.x + body.w / 2) / TILE);
    const enemyTy = Math.floor((body.y + body.h / 2) / TILE);
    if (tx === enemyTx && ty === enemyTy) return "m";
  }
  return tileChar(level, tx, ty, spawn);
}

/** A single tile character; shared by the window and diagnostics. */
export function tileChar(level: Level, tx: number, ty: number, spawn: BotPoint): string {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return "#";
  if (tx === spawn.tx && ty === spawn.ty) return "P";
  const behavior = level.behaviorAt(tx, ty);
  if (behavior === 2) return "E";
  if (behavior === 1) return "D";
  if (behavior >= 52 && behavior <= 54) return "g";
  if (behavior >= 105 && behavior <= 109) return "a";
  if (isSolid(level, tx, ty)) return "#";
  if (level.blocks(tx, ty, "down")) return "=";
  return ".";
}

function isSolid(level: Level, tx: number, ty: number): boolean {
  return level.blocks(tx, ty, "left") || level.blocks(tx, ty, "right") || level.blocks(tx, ty, "up");
}

/** Coarse whole-level map: one character per 4x4 tiles. */
export function buildMinimap(level: Level, player: BotPoint, spawn: BotPoint): string[] {
  const cols = Math.ceil(level.width / MINIMAP_SCALE);
  const rows = Math.ceil(level.height / MINIMAP_SCALE);
  const result: string[] = [];

  for (let by = 0; by < rows; by++) {
    let row = "";
    for (let bx = 0; bx < cols; bx++) {
      let exit2 = false;
      let exit1 = false;
      let solid = false;
      let platform = false;
      for (let y = by * MINIMAP_SCALE; y < Math.min(level.height, (by + 1) * MINIMAP_SCALE); y++) {
        for (let x = bx * MINIMAP_SCALE; x < Math.min(level.width, (bx + 1) * MINIMAP_SCALE); x++) {
          const behavior = level.behaviorAt(x, y);
          if (behavior === 2) exit2 = true;
          else if (behavior === 1) exit1 = true;
          if (isSolid(level, x, y)) solid = true;
          else if (level.blocks(x, y, "down")) platform = true;
        }
      }

      const playerBlock = Math.floor(player.tx / MINIMAP_SCALE) === bx
        && Math.floor(player.ty / MINIMAP_SCALE) === by;
      const spawnBlock = Math.floor(spawn.tx / MINIMAP_SCALE) === bx
        && Math.floor(spawn.ty / MINIMAP_SCALE) === by;
      if (exit2) row += "E";
      else if (exit1) row += "D";
      else if (playerBlock) row += "*";
      else if (spawnBlock) row += "P";
      else if (solid) row += "#";
      else if (platform) row += "=";
      else row += ".";
    }
    result.push(row);
  }

  return result;
}

export interface BotEnemyRule {
  id: number;
  type: number;
  fly: boolean;
}

/** Living enemies within `radius` tiles, with both tile and pixel coordinates. */
export function describeEnemies(
  snapshot: WorldSnapshot,
  rules: readonly BotEnemyRule[],
  player: BotPoint,
  radius = 14,
): BotEnemy[] {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const result: BotEnemy[] = [];
  for (const body of snapshot.enemies) {
    if (!body.alive) continue;
    const tx = Math.floor((body.x + body.w / 2) / TILE);
    const ty = Math.floor((body.y + body.h / 2) / TILE);
    if (Math.abs(tx - player.tx) > radius || Math.abs(ty - player.ty) > radius) continue;
    const rule = byId.get(body.id);
    result.push({
      id: body.id,
      type: rule?.type ?? 0,
      tx,
      ty,
      x: Math.round(body.x),
      y: Math.round(body.y),
      vx: Math.round(body.vx),
      vy: Math.round(body.vy),
      dir: body.dir,
      fly: rule?.fly ?? false,
      sprite: body.sprite,
    });
  }
  return result;
}

/** Bullets near the hero; enemy projectiles will appear here when they exist. */
export function describeBullets(snapshot: WorldSnapshot, player: BotPoint, radius = 12): BotBullet[] {
  const result: BotBullet[] = [];
  for (const body of snapshot.bullets) {
    const tx = Math.floor(body.x / TILE);
    const ty = Math.floor(body.y / TILE);
    if (Math.abs(tx - player.tx) > radius || Math.abs(ty - player.ty) > radius) continue;
    result.push({
      id: body.id,
      x: Math.round(body.x),
      y: Math.round(body.y),
      vx: Math.round(body.vx),
      vy: Math.round(body.vy),
    });
  }
  return result;
}
