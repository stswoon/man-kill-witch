import type { Level } from "../game";
import type { BotExit, BotPoint } from "./types";

/**
 * A door cluster closer than this many tiles to the spawn means the level can
 * be finished by accident in the first seconds. The bot reports it as FAIL.
 */
export const NEAR_SPAWN_TILES = 2;

export interface BotExitPolicy {
  /** Behavior `2` is the exit; levels without one fall back to behavior `1`. */
  exitBehavior: 1 | 2;
  /** Suggested target: the farthest reachable-looking cluster of that kind. */
  target: BotExit | null;
  /** Some exit of the chosen kind sits right next to the spawn. */
  exitNextToSpawn: boolean;
  /** The level has no behavior-2 exit at all. */
  noExit2: boolean;
}

/**
 * Groups adjacent door tiles of the same behavior into one door. A 2x3 or 2x4
 * exit block is one logical door, not six separate targets.
 */
export function findExitClusters(level: Level, spawn: BotPoint): BotExit[] {
  const width = level.width;
  const height = level.height;
  const seen = new Uint8Array(width * height);
  const clusters: BotExit[] = [];

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const behavior = level.behaviorAt(tx, ty);
      if (behavior !== 1 && behavior !== 2) continue;
      const index = ty * width + tx;
      if (seen[index]) continue;

      const tiles: BotPoint[] = [];
      const queue: BotPoint[] = [{ tx, ty }];
      seen[index] = 1;
      while (queue.length) {
        const cell = queue.pop() as BotPoint;
        tiles.push(cell);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cell.tx + dx;
          const ny = cell.ty + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (seen[next]) continue;
          if (level.behaviorAt(nx, ny) !== behavior) continue;
          seen[next] = 1;
          queue.push({ tx: nx, ty: ny });
        }
      }

      let closest = tiles[0];
      let distance = manhattan(closest, spawn);
      let x0 = closest.tx;
      let y0 = closest.ty;
      let x1 = closest.tx;
      let y1 = closest.ty;
      for (const tile of tiles) {
        const candidate = manhattan(tile, spawn);
        if (candidate < distance) {
          closest = tile;
          distance = candidate;
        }
        x0 = Math.min(x0, tile.tx);
        y0 = Math.min(y0, tile.ty);
        x1 = Math.max(x1, tile.tx);
        y1 = Math.max(y1, tile.ty);
      }

      clusters.push({
        behavior: behavior as 1 | 2,
        tx: closest.tx,
        ty: closest.ty,
        tiles,
        distance,
        nearSpawn: distance <= NEAR_SPAWN_TILES,
        bounds: { x0, y0, x1, y1 },
      });
    }
  }

  return clusters;
}

/** Chooses the exit behavior and the farthest suggested target. */
export function exitPolicy(clusters: readonly BotExit[]): BotExitPolicy {
  const behavior2 = clusters.filter((cluster) => cluster.behavior === 2);
  const exitBehavior: 1 | 2 = behavior2.length ? 2 : 1;
  const candidates = clusters.filter((cluster) => cluster.behavior === exitBehavior);

  let target: BotExit | null = null;
  for (const cluster of candidates) {
    if (!target || cluster.distance > target.distance) target = cluster;
  }

  return {
    exitBehavior,
    target,
    exitNextToSpawn: candidates.some((cluster) => cluster.nearSpawn),
    noExit2: behavior2.length === 0,
  };
}

/** The spawn marker `255`, or the `Game` fallback tile if the level is broken. */
export function spawnTile(level: Level): BotPoint {
  for (let i = 0; i < level.entities.length; i++) {
    if (level.entities[i] === 255) {
      return { tx: i % level.width, ty: Math.floor(i / level.width) };
    }
  }
  return { tx: 2, ty: 2 };
}

function manhattan(a: BotPoint, b: BotPoint): number {
  return Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
}
