import { expect, test, type Page } from "@playwright/test";
import { TILE } from "../web/src/assets";

type GameState = "title" | "play" | "gameover" | "win";

interface PlayerState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

interface DebugApi {
  phaser: { loop: { sleep: () => void } };
  game: () => { player: PlayerState };
  startLevel: (index: number) => void;
  tick: (count: number, dt?: number) => void;
  getState: () => GameState;
}

/** Ticks that let the player drop from the level 1 spawn marker onto the ledge. */
const SETTLE_TICKS = 30;

/**
 * Boots the game, focuses the page and stops the Phaser loop. With the loop
 * asleep only `mkw.tick` advances the simulation, so the real frame rate cannot
 * inject extra fixed steps between two reads and every expectation is exact.
 */
async function boot(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as unknown as { mkw?: unknown }).mkw));
  await page.locator("#screen").click();
  await page.evaluate(() => {
    (window as unknown as { mkw: DebugApi }).mkw.phaser.loop.sleep();
  });
}

/** Starts level 1 from a clean run state and settles the player on the ledge. */
async function startLevel1(page: Page): Promise<PlayerState> {
  const state = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    mkw.startLevel(0);
    return mkw.getState();
  });
  expect(state).toBe("play");
  await tick(page, SETTLE_TICKS);
  return player(page);
}

async function tick(page: Page, count: number): Promise<void> {
  await page.evaluate((steps) => {
    (window as unknown as { mkw: DebugApi }).mkw.tick(steps);
  }, count);
}

async function player(page: Page): Promise<PlayerState> {
  return page.evaluate(() => {
    const p = (window as unknown as { mkw: DebugApi }).mkw.game().player;
    return { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, onGround: p.onGround };
  });
}

test("Space jumps from the ground and clears two tiles but not three", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);
  expect(ground.onGround, "player must start on the ground").toBe(true);

  await page.keyboard.press("Space");
  const jump = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    const p = mkw.game().player;
    const startY = p.y;
    let highest = p.y;
    let landed = false;
    for (let i = 0; i < 120; i++) {
      mkw.tick(1);
      highest = Math.min(highest, p.y);
      if (p.onGround) {
        landed = true;
        break;
      }
    }
    return { rise: startY - highest, landed };
  });

  expect(jump.landed, "player must come back to the ground").toBe(true);
  expect(jump.rise, `rise ${jump.rise}px must clear two tiles`).toBeGreaterThan(2 * TILE);
  expect(jump.rise, `rise ${jump.rise}px must not reach three tiles`).toBeLessThan(3 * TILE);
  expect(jump.rise, `rise ${jump.rise}px should stay close to the documented 46px`).toBeGreaterThanOrEqual(40);
  expect(jump.rise, `rise ${jump.rise}px should stay close to the documented 46px`).toBeLessThanOrEqual(50);
});

test("Space in the air does not trigger a second jump", async ({ page }) => {
  await boot(page);
  await startLevel1(page);
  await page.keyboard.press("Space");
  await tick(page, 6);
  const airborne = await player(page);
  expect(airborne.onGround, "player must be airborne").toBe(false);

  await page.keyboard.press("Space");
  await tick(page, 1);
  const afterAirPress = await player(page);

  // The same ticks without the air press: only gravity may change the body, so
  // an unwanted relaunch would show up as a different y/vy.
  await startLevel1(page);
  await page.keyboard.press("Space");
  await tick(page, 6);
  await tick(page, 1);
  const control = await player(page);

  expect(afterAirPress.vy, "airborne Space must not relaunch").toBe(control.vy);
  expect(afterAirPress.y, "airborne Space must not relaunch").toBe(control.y);
});

test("a single Space press is consumed by exactly one tick", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);

  await page.keyboard.press("Space");
  await tick(page, 70);

  const rested = await player(page);
  expect(rested.onGround, "the jump must end and the player must stay down").toBe(true);
  expect(rested.vy, "landed player must not keep falling").toBe(0);
  expect(
    Math.abs(rested.y - ground.y),
    "a stuck press would launch a second jump and leave the floor",
  ).toBeLessThanOrEqual(1);
});

test("runs right up to the run speed within ten fixed ticks", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);

  await page.keyboard.down("ArrowRight");
  await tick(page, 10);
  const running = await player(page);
  await page.keyboard.up("ArrowRight");

  expect(running.vx).toBe(132);
  expect(running.x, "player must move right").toBeGreaterThan(ground.x);
  expect(running.onGround).toBe(true);
});

test("lands on the floor and does not sink into it", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);
  const groundFeet = ground.y + ground.h;

  await page.keyboard.press("Space");
  const landing = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    const p = mkw.game().player;
    let landed = false;
    for (let i = 0; i < 120; i++) {
      mkw.tick(1);
      if (p.onGround) {
        landed = true;
        break;
      }
    }
    const feetOnTouchdown = p.y + p.h;
    mkw.tick(10);
    return { landed, feetOnTouchdown, feet: p.y + p.h, onGround: p.onGround };
  });

  expect(landing.landed, "player must land").toBe(true);
  expect(landing.onGround, "player must stand on the floor after landing").toBe(true);
  expect(landing.feetOnTouchdown, "feet must not pass through the floor").toBeLessThanOrEqual(groundFeet + 1);
  expect(Math.abs(landing.feet - groundFeet), "body must rest on the floor").toBeLessThanOrEqual(1);
});

test("replaying the same tick sequence reproduces the same player position", async ({ page }) => {
  await boot(page);

  const run = async (): Promise<PlayerState> => {
    await startLevel1(page);
    await page.keyboard.press("Space");
    await tick(page, 12);
    await page.keyboard.down("ArrowRight");
    await tick(page, 20);
    await page.keyboard.up("ArrowRight");
    await tick(page, 45);
    return player(page);
  };

  const first = await run();
  const second = await run();

  expect(second.x).toBe(first.x);
  expect(second.y).toBe(first.y);
  expect(second.vx).toBe(first.vx);
  expect(second.vy).toBe(first.vy);
  expect(second.onGround).toBe(first.onGround);
});
