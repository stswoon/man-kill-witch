import { expect, test, type Page } from "@playwright/test";
import type { WorldSnapshot } from "../web/src/sim-contract";

type GameState = "title" | "play" | "gameover" | "win";

interface DebugGame {
  player: { ammo: number };
  level: { pixelWidth: number; pixelHeight: number };
  score: number;
  lives: number;
  levelComplete: boolean;
  run: { lives: number; score: number; nextExtraLife: number };
}

interface DebugApi {
  assets: { levels: Array<{ width: number; height: number }> };
  game: () => DebugGame;
  snapshot: () => WorldSnapshot;
  startLevel: (index: number) => void;
  advanceLevel: (index: number) => void;
  tick: (count: number, dt?: number) => void;
  getState: () => GameState;
}

interface Snapshot {
  state: GameState;
  x: number;
  ammo: number;
  levelWidth: number;
  levelHeight: number;
}

/** Waits for the boot scene to hand control to the game scene, then focuses the page. */
async function boot(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as unknown as { mkw?: unknown }).mkw));
  await page.locator("#screen").click();
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const api = (window as unknown as { mkw: DebugApi }).mkw;
    const game = api.game();
    return {
      state: api.getState(),
      x: api.snapshot().player.x,
      ammo: game.player.ammo,
      levelWidth: game.level.pixelWidth,
      levelHeight: game.level.pixelHeight,
    };
  });
}

test("boots to the title screen without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await boot(page);

  await expect(page.locator("#screen")).toBeVisible();
  const canvas = await page.locator("#screen").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return { width: canvas.width, height: canvas.height };
  });
  expect(canvas).toEqual({ width: 1920, height: 1080 });
  expect((await snapshot(page)).state).toBe("title");
  expect(errors).toEqual([]);
});

test("Space starts level 1 and the player runs and shoots", async ({ page }) => {
  await boot(page);

  await page.keyboard.press("Space");
  await expect.poll(async () => (await snapshot(page)).state).toBe("play");

  const start = await snapshot(page);
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(start.x + 40);
  await page.keyboard.up("ArrowRight");

  await page.keyboard.press("ControlLeft");
  await expect.poll(async () => (await snapshot(page)).ammo).toBe(7);
});

test("number keys switch to the matching level data", async ({ page }) => {
  await boot(page);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await snapshot(page)).state).toBe("play");

  const expected = await page.evaluate(() => {
    const level = (window as unknown as { mkw: DebugApi }).mkw.assets.levels[4];
    return { width: level.width * 80, height: level.height * 80 };
  });

  await page.keyboard.press("Digit5");
  await expect.poll(async () => {
    const level = await snapshot(page);
    return `${level.levelWidth}x${level.levelHeight}`;
  }).toBe(`${expected.width}x${expected.height}`);
});

test("advanceLevel carries the run and startLevel resets it", async ({ page }) => {
  await boot(page);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await snapshot(page)).state).toBe("play");

  const advanced = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    const game = mkw.game();
    game.lives = 2;
    game.score = 4321;
    game.run.nextExtraLife = 10000;
    mkw.advanceLevel(1);
    const next = mkw.game();
    const level = mkw.assets.levels[1];
    return {
      state: mkw.getState(),
      lives: next.lives,
      score: next.score,
      nextExtraLife: next.run.nextExtraLife,
      levelSize: `${next.level.pixelWidth}x${next.level.pixelHeight}`,
      expectedSize: `${level.width * 80}x${level.height * 80}`,
    };
  });

  expect(advanced.state).toBe("play");
  expect(advanced.levelSize).toBe(advanced.expectedSize);
  expect(advanced.lives).toBe(2);
  expect(advanced.score).toBe(4321);
  expect(advanced.nextExtraLife).toBe(10000);

  const reset = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    mkw.startLevel(2);
    const game = mkw.game();
    return { lives: game.lives, score: game.score, nextExtraLife: game.run.nextExtraLife };
  });

  expect(reset).toEqual({ lives: 3, score: 0, nextExtraLife: 5000 });
});

test("win restarts level 1 with a fresh run", async ({ page }) => {
  await boot(page);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await snapshot(page)).state).toBe("play");

  await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    mkw.startLevel(7);
    const game = mkw.game();
    game.lives = 4;
    game.score = 4321;
    game.run.nextExtraLife = 10000;
    // The last level is finished, so the next step shows the win screen.
    game.levelComplete = true;
  });
  await expect.poll(async () => (await snapshot(page)).state).toBe("win");

  const won = await page.evaluate(() => {
    const game = (window as unknown as { mkw: DebugApi }).mkw.game();
    return { lives: game.lives, score: game.score, nextExtraLife: game.run.nextExtraLife };
  });
  expect(won, "the win screen keeps the run until Space").toEqual({
    lives: 4,
    score: 4321,
    nextExtraLife: 10000,
  });

  await page.evaluate(() => {
    // The restart ignores Space for the first 30 ticks of the win screen.
    (window as unknown as { mkw: DebugApi }).mkw.tick(31);
  });
  await page.keyboard.press("Space");
  await expect.poll(async () => (await snapshot(page)).state).toBe("play");

  const restarted = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    const game = mkw.game();
    const first = mkw.assets.levels[0];
    return {
      lives: game.lives,
      score: game.score,
      nextExtraLife: game.run.nextExtraLife,
      levelSize: `${game.level.pixelWidth}x${game.level.pixelHeight}`,
      expectedSize: `${first.width * 80}x${first.height * 80}`,
    };
  });

  expect(restarted.levelSize).toBe(restarted.expectedSize);
  expect(restarted.lives).toBe(3);
  expect(restarted.score).toBe(0);
  expect(restarted.nextExtraLife).toBe(5000);
});

test("the canvas fits the viewport and keeps its aspect ratio", async ({ page }) => {
  await boot(page);
  await page.setViewportSize({ width: 700, height: 500 });

  const measure = () => page.locator("#screen").evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      width: Number.parseFloat(computed.width),
      height: Number.parseFloat(computed.height),
    };
  });

  await expect.poll(async () => (await measure()).width).toBeLessThanOrEqual(700);

  const style = await measure();
  expect(style.width).toBeGreaterThan(0);
  expect(style.width).toBeLessThanOrEqual(700);
  expect(style.height).toBeLessThanOrEqual(500);
  expect(style.width / style.height).toBeCloseTo(16 / 9, 2);
});
