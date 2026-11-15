import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { type LevelData, type TileInfoData } from "../web/src/assets";
import { exitPolicy, findExitClusters, spawnTile } from "../web/src/bot/bot-exits";
import { Level } from "../web/src/game";

const ASSETS = resolve(process.cwd(), "web/public/assets");
const LEVEL_DIR = join(ASSETS, "levels");
const info = JSON.parse(readFileSync(join(ASSETS, "tileinfo.json"), "utf8")) as TileInfoData;
const levelFiles = readdirSync(LEVEL_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort();
const levels = levelFiles.map(
  (name) => JSON.parse(readFileSync(join(LEVEL_DIR, name), "utf8")) as LevelData,
);

function report(index: number) {
  const level = new Level(levels[index], info);
  const spawn = spawnTile(level);
  const exits = findExitClusters(level, spawn);
  return { level, spawn, exits, policy: exitPolicy(exits) };
}

describe("bot exit report", () => {
  test("loads the eight level files", () => {
    expect(levelFiles).toHaveLength(8);
  });

  test("groups connected door tiles into logical exits", () => {
    const behavior2 = levels.map((_, index) =>
      report(index).exits.filter((exit) => exit.behavior === 2).length,
    );
    const behavior1 = levels.map((_, index) =>
      report(index).exits.filter((exit) => exit.behavior === 1).length,
    );

    expect(behavior2).toEqual([1, 0, 1, 0, 2, 1, 3, 1]);
    expect(behavior1).toEqual([12, 21, 3, 1, 9, 0, 12, 0]);
  });

  test("a 2x4 behavior-2 exit is one cluster, not eight tiles", () => {
    const exit = report(5).exits.find((cluster) => cluster.behavior === 2);
    expect(exit?.tiles).toHaveLength(8);
  });

  test("prefers behavior 2 and falls back to behavior 1", () => {
    expect(levels.map((_, index) => report(index).policy.exitBehavior))
      .toEqual([2, 1, 2, 1, 2, 2, 2, 2]);
    expect(levels.map((_, index) => report(index).policy.noExit2))
      .toEqual([false, true, false, true, false, false, false, false]);
  });

  test("flags the spawn-adjacent exits of levels 4, 6 and 7", () => {
    expect(levels.map((_, index) => report(index).policy.exitNextToSpawn))
      .toEqual([false, false, false, true, false, true, true, false]);
  });

  test("the suggested target is far from the spawn", () => {
    for (let index = 0; index < levels.length; index++) {
      const { policy } = report(index);
      expect(policy.target, `level ${index + 1} has no target`).not.toBeNull();
      // Levels 4 and 6 only have a door right next to the spawn; that is the
      // defect this tool reports, not a target the agent should chase.
      if (index === 3 || index === 5) continue;
      expect(policy.target?.distance, `level ${index + 1}`).toBeGreaterThan(2);
    }
  });
});
