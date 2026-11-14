import { expect, test, type Page } from "@playwright/test";

type GameState = "title" | "play" | "gameover" | "win";

interface DebugApi {
  assets: { levels: Array<{ width: number; height: number }> };
  game: () => {
    player: { x: number; ammo: number };
    level: { pixelWidth: number; pixelHeight: number };
  };
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
      x: game.player.x,
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
  expect(canvas).toEqual({ width: 320, height: 200 });
  expect((await snapshot(page)).state).toBe("title");
  expect(errors).toEqual([]);
});

test("Space starts level 1 and the player runs and shoots", async ({ page }) => {
  await boot(page);

  await page.keyboard.press("Space");
  await expect.poll(async () => (await snapshot(page)).state).toBe("play");

  const start = await snapshot(page);
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(start.x + 8);
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
    return { width: level.width * 16, height: level.height * 16 };
  });

  await page.keyboard.press("Digit5");
  await expect.poll(async () => {
    const level = await snapshot(page);
    return `${level.levelWidth}x${level.levelHeight}`;
  }).toBe(`${expected.width}x${expected.height}`);
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
  expect(style.width).toBeGreaterThanOrEqual(320);
  expect(style.width).toBeLessThanOrEqual(700);
  expect(style.height).toBeLessThanOrEqual(500);
  expect(style.width / style.height).toBeCloseTo(320 / 200, 2);
});
