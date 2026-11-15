import { expect, test, type Page } from "@playwright/test";
import type {
  BotAction,
  BotObservation,
  BotRouteLog,
  BotStatus,
} from "../web/src/bot/types";

interface DebugApi {
  bot: {
    reset: (
      level: number,
      options?: { seed?: number; render?: boolean; maxActions?: number; maxTicks?: number },
    ) => BotObservation;
    observe: () => BotObservation;
    act: (action: BotAction, ticks?: number) => BotObservation;
    status: () => BotStatus;
    log: () => BotRouteLog;
    replay: (route: BotRouteLog, options?: { render?: boolean }) => BotStatus;
    stop: () => void;
  };
}

/** Boots the game and waits for the debug API; the bot sleeps the loop itself. */
async function boot(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as unknown as { mkw?: unknown }).mkw));
}

async function reset(page: Page, level: number): Promise<BotObservation> {
  return page.evaluate((index) => {
    const api = (window as unknown as { mkw: DebugApi }).mkw;
    return api.bot.reset(index, { seed: 7, render: false });
  }, level);
}

async function act(page: Page, action: BotAction, ticks?: number): Promise<BotObservation> {
  return page.evaluate(({ action, ticks }) => {
    const api = (window as unknown as { mkw: DebugApi }).mkw;
    return api.bot.act(action, ticks);
  }, { action, ticks });
}

async function status(page: Page): Promise<BotStatus> {
  return page.evaluate(() => (window as unknown as { mkw: DebugApi }).mkw.bot.status());
}

test("bot API observes the hero, walks, jumps and logs actions", async ({ page }) => {
  await boot(page);
  const initial = await reset(page, 0);

  expect(initial.level).toBe(1);
  expect(initial.state).toBe("play");
  expect(initial.player.onGround, "the settle step must land the hero").toBe(true);
  expect(initial.target?.behavior, "level 1 has a behavior-2 exit").toBe(2);
  expect(initial.window).toHaveLength(13);
  expect(initial.window[0]?.length).toBe(21);
  expect(initial.minimap.length).toBeGreaterThan(0);
  expect(initial.status.verdict).toBe("IN_PROGRESS");
  expect(initial.status.exitNextToSpawn).toBe(false);

  const moved = await act(page, "right", 10);
  expect(moved.player.x).toBeGreaterThan(initial.player.x);
  expect(moved.tick).toBeGreaterThan(initial.tick);

  const air = await act(page, "jump", 1);
  expect(air.player.onGround, "one jump tick must lift the body").toBe(false);

  const landed = await act(page, "wait", 70);
  expect(landed.player.onGround, "the hero must come back to the floor").toBe(true);

  const after = await status(page);
  expect(after.actions).toBe(3);
  expect(after.verdict).toBe("IN_PROGRESS");
  expect(after.reachedDoor).toBeNull();

  const observed = await page.evaluate(() => (window as unknown as { mkw: DebugApi }).mkw.bot.observe());
  expect(observed.tick).toBe(after.tick);

  const log = await page.evaluate(() => (window as unknown as { mkw: DebugApi }).mkw.bot.log());
  expect(log.actions.map((entry) => entry.action)).toEqual(["right", "jump", "wait"]);
  expect(log.seed).toBe(7);

  const replay = await page.evaluate((route) => {
    const api = (window as unknown as { mkw: DebugApi }).mkw;
    return api.bot.replay(route, { render: false });
  }, log);
  expect(replay.actions).toBe(log.status.actions);
  expect(replay.tick).toBe(log.status.tick);
  expect(replay.verdict).toBe("IN_PROGRESS");
});

test("spawn-adjacent exits fail immediately; level 2 warns about the fallback", async ({ page }) => {
  await boot(page);

  for (const level of [3, 5, 6]) {
    const observation = await reset(page, level);
    expect(observation.status.exitNextToSpawn, `level ${level + 1}`).toBe(true);
    expect(observation.status.verdict, `level ${level + 1}`).toBe("FAIL");
    expect(observation.status.reason, `level ${level + 1}`).toBe("exit-next-to-spawn");
  }

  const level2 = await reset(page, 1);
  expect(level2.status.noExit2).toBe(true);
  expect(level2.status.exitNextToSpawn).toBe(false);
  expect(level2.status.verdict).toBe("IN_PROGRESS");
  expect(level2.target?.behavior).toBe(1);

  // The level-6 exit is one tile from the spawn. Walking into it proves that the
  // harness captures the door and the completion, while the verdict stays FAIL
  // because of the data defect.
  const level6 = await reset(page, 5);
  expect(level6.status.exitNextToSpawn).toBe(true);
  await act(page, "left", 10);
  const finished = await act(page, "wait", 40);
  expect(finished.done?.kind).toBe("levelComplete");
  expect(finished.status.reachedDoor?.behavior).toBe(2);
  expect(finished.status.verdict).toBe("FAIL");
  expect(finished.status.reason).toBe("exit-next-to-spawn");
  expect(finished.status.earlyExit).toBe(false);
});
