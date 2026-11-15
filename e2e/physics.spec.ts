import { expect, test, type Page } from "@playwright/test";
import { TILE } from "../web/src/assets";
import type { EnemySnapshot, PlayerSnapshot, WorldSnapshot } from "../web/src/sim-contract";

type GameState = "title" | "play" | "gameover" | "win";

interface EnemyRule {
  id: number;
  type: number;
  speed: number;
  fly: boolean;
}

interface GameRule {
  player: { ammo: number };
  enemies: EnemyRule[];
  level: { pixelWidth: number; pixelHeight: number };
  door: { tx: number; ty: number; step: number; timer: number } | null;
}

interface DebugApi {
  assets: { levels: Array<{ width: number; height: number; tiles: number[] }> };
  phaser: { loop: { sleep: () => void } };
  game: () => GameRule;
  snapshot: () => WorldSnapshot;
  startLevel: (index: number) => void;
  tick: (count: number, dt?: number) => void;
  getState: () => GameState;
}

/** Ticks that let the player drop from the level 1 spawn marker onto the ledge. */
const SETTLE_TICKS = 30;

/**
 * Boots the game, focuses the page and stops the Phaser loop. With the loop
 * asleep only `mkw.tick` advances the rules and the Arcade world, so the real
 * frame rate cannot inject extra fixed steps between two reads.
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
async function startLevel1(page: Page): Promise<PlayerSnapshot> {
  const state = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    mkw.startLevel(0);
    return mkw.getState();
  });
  expect(state).toBe("play");
  await tick(page, SETTLE_TICKS);
  return player(page);
}

async function startLevel(page: Page, index: number): Promise<void> {
  await page.evaluate((level) => {
    (window as unknown as { mkw: DebugApi }).mkw.startLevel(level);
  }, index);
}

async function tick(page: Page, count: number): Promise<void> {
  await page.evaluate((steps) => {
    (window as unknown as { mkw: DebugApi }).mkw.tick(steps);
  }, count);
}

async function snapshot(page: Page): Promise<WorldSnapshot> {
  return page.evaluate(() => (window as unknown as { mkw: DebugApi }).mkw.snapshot());
}

async function player(page: Page): Promise<PlayerSnapshot> {
  return (await snapshot(page)).player;
}

async function enemies(page: Page): Promise<EnemySnapshot[]> {
  return (await snapshot(page)).enemies;
}

/** Row of the injected ceiling: it ends at `(CEILING_ROW + 1) * TILE`. */
const CEILING_ROW = 32;

/**
 * Puts a solid ceiling over the level 1 spawn. The level data is edited in the
 * page before `startLevel`, so both the tilemap and the Arcade collision are
 * built from the patched rows. The row is wide enough for an upward shot, which
 * travels 27 px right per 20 px up.
 */
async function injectCeiling(page: Page): Promise<void> {
  await page.evaluate((row) => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    const level = mkw.assets.levels[0];
    const solid = level.tiles[35 * level.width + 4]; // the floor tile under the spawn
    for (let x = 3; x <= 8; x++) level.tiles[row * level.width + x] = solid;
  }, CEILING_ROW);
}

interface BulletProbe {
  /** Tick the bullet first showed `vy = 0`, i.e. it touched the surface. -1 if never. */
  contactTick: number;
  /** Tick the bullet was gone. -1 if it survived the observation window. */
  goneTick: number;
}

/** Ticks one bullet until it disappears and reports when it touched the surface. */
async function watchBullet(page: Page): Promise<BulletProbe> {
  return page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    let contactTick = -1;
    let goneTick = -1;
    for (let i = 1; i <= 40; i++) {
      mkw.tick(1);
      const bullets = mkw.snapshot().bullets;
      if (bullets.length === 0) {
        if (contactTick >= 0) goneTick = i;
        break;
      }
      if (contactTick < 0 && bullets[0].vy === 0) contactTick = i;
    }
    return { contactTick, goneTick };
  });
}

test("Space jumps from the ground and clears two tiles but not three", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);
  expect(ground.onGround, "player must start on the ground").toBe(true);

  await page.keyboard.press("Space");
  const jump = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    const startY = mkw.snapshot().player.y;
    let highest = startY;
    let landed = false;
    for (let i = 0; i < 120; i++) {
      mkw.tick(1);
      highest = Math.min(highest, mkw.snapshot().player.y);
      if (mkw.snapshot().player.onGround) {
        landed = true;
        break;
      }
    }
    return { rise: startY - highest, landed };
  });

  expect(jump.landed, "player must come back to the ground").toBe(true);
  expect(jump.rise, `rise ${jump.rise}px must clear two tiles`).toBeGreaterThan(2 * TILE);
  expect(jump.rise, `rise ${jump.rise}px must not reach three tiles`).toBeLessThan(3 * TILE);
  expect(jump.rise, `rise ${jump.rise}px should stay in the documented 200-250px band`).toBeGreaterThanOrEqual(200);
  expect(jump.rise, `rise ${jump.rise}px should stay in the documented 200-250px band`).toBeLessThanOrEqual(250);
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
  ).toBeLessThanOrEqual(5);
});

test("runs right up to the run speed within ten fixed ticks", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);

  await page.keyboard.down("ArrowRight");
  await tick(page, 10);
  const running = await player(page);
  await page.keyboard.up("ArrowRight");

  expect(running.vx).toBe(660);
  expect(running.x, "player must move right").toBeGreaterThan(ground.x);
  expect(running.onGround).toBe(true);

  await page.keyboard.up("ArrowRight");
  await tick(page, 10);
  const stopped = await player(page);
  expect(stopped.vx, "friction must bring the run to a full stop").toBe(0);
  expect(stopped.x, "the body must coast forward while it brakes").toBeGreaterThan(running.x);
});

test("caps the fall speed at the documented 2600 px/s", async ({ page }) => {
  await boot(page);
  // Level 8 spawns over a deep shaft, so the body reaches terminal velocity.
  await startLevel(page, 7);

  const fall = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    let maxVy = 0;
    let landed = false;
    for (let i = 0; i < 200; i++) {
      mkw.tick(1);
      const player = mkw.snapshot().player;
      maxVy = Math.max(maxVy, player.vy);
      if (player.onGround) {
        landed = true;
        break;
      }
    }
    return { maxVy, landed };
  });

  expect(fall.maxVy, "MAX_FALL must clamp the body").toBe(2600);
  expect(fall.landed, "the body must reach the floor of the shaft").toBe(true);
});

test("lands on the floor and does not sink into it", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);
  const groundFeet = ground.y + ground.h;

  await page.keyboard.press("Space");
  const landing = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    let landed = false;
    for (let i = 0; i < 120; i++) {
      mkw.tick(1);
      if (mkw.snapshot().player.onGround) {
        landed = true;
        break;
      }
    }
    const player = mkw.snapshot().player;
    const feetOnTouchdown = player.y + player.h;
    mkw.tick(10);
    const rested = mkw.snapshot().player;
    return { landed, feetOnTouchdown, feet: rested.y + rested.h, onGround: rested.onGround };
  });

  expect(landing.landed, "player must land").toBe(true);
  expect(landing.onGround, "player must stand on the floor after landing").toBe(true);
  expect(landing.feetOnTouchdown, "feet must not pass through the floor").toBeLessThanOrEqual(groundFeet + 5);
  expect(Math.abs(landing.feet - groundFeet), "body must rest on the floor").toBeLessThanOrEqual(5);
});

test("a bullet fired down dies on the floor and does not slide", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);
  expect(ground.onGround, "player must stand on the floor").toBe(true);

  await page.keyboard.down("ArrowDown");
  await page.keyboard.press("ControlLeft");
  const shot = await watchBullet(page);
  await page.keyboard.up("ArrowDown");

  expect(shot.contactTick, "the bullet must reach the floor").toBeGreaterThan(0);
  expect(shot.goneTick, "the bullet must be despawned").toBeGreaterThan(0);
  expect(
    shot.goneTick - shot.contactTick,
    "a solid floor must despawn the bullet on contact, not let it slide",
  ).toBeLessThanOrEqual(2);
});

test("a bullet fired up dies on the ceiling and does not slide", async ({ page }) => {
  await boot(page);
  await injectCeiling(page);
  await startLevel1(page);

  await page.keyboard.down("ArrowUp");
  await page.keyboard.press("ControlLeft");
  const shot = await watchBullet(page);
  await page.keyboard.up("ArrowUp");

  expect(shot.contactTick, "the bullet must reach the ceiling").toBeGreaterThan(0);
  expect(shot.goneTick, "the bullet must be despawned").toBeGreaterThan(0);
  expect(
    shot.goneTick - shot.contactTick,
    "a solid ceiling must despawn the bullet on contact, not let it slide",
  ).toBeLessThanOrEqual(2);
});

test("jumps into a ceiling and has the jump cut short", async ({ page }) => {
  await boot(page);
  await injectCeiling(page);
  const ground = await startLevel1(page);

  await page.keyboard.press("Space");
  const jump = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    let highest = mkw.snapshot().player.y;
    let blockedUp = false;
    let landed = false;
    for (let i = 0; i < 120; i++) {
      mkw.tick(1);
      const player = mkw.snapshot().player;
      highest = Math.min(highest, player.y);
      blockedUp = blockedUp || player.blocked.up;
      if (player.onGround && i > 5) {
        landed = true;
        break;
      }
    }
    return { highest, blockedUp, landed };
  });

  // The injected ceiling ends at `(CEILING_ROW + 1) * TILE`; the body must not pass it.
  expect(jump.highest, "the head must stop at the ceiling").toBeGreaterThanOrEqual((CEILING_ROW + 1) * TILE);
  expect(ground.y - jump.highest, "the ceiling must cut the 230 px jump short").toBeLessThan(200);
  expect(jump.blockedUp, "the ceiling must be reported to the rules").toBe(true);
  expect(jump.landed, "the player must fall back to the floor").toBe(true);
});

test("stops at the wall right of the spawn ledge", async ({ page }) => {
  await boot(page);
  const ground = await startLevel1(page);

  await page.keyboard.down("ArrowRight");
  await tick(page, 60);
  const blocked = await player(page);
  await page.keyboard.up("ArrowRight");

  // The intermediate step at column 8 starts at x = 640; the 60 px body stops at 580.
  expect(blocked.x, "body must rest against the step").toBeCloseTo(8 * TILE - ground.w, 0);
  expect(blocked.blocked.right, "the wall must be reported to the rules").toBe(true);
  expect(blocked.vx, "a wall stops the run").toBe(0);
});

test("stops at the left wall of the level", async ({ page }) => {
  await boot(page);
  await startLevel1(page);

  await page.keyboard.down("ArrowLeft");
  await tick(page, 40);
  const blocked = await player(page);
  await page.keyboard.up("ArrowLeft");

  // The spawn ledge starts with solid columns 0-1, so the body rests at x = 160.
  expect(blocked.x, "body must rest against the left wall").toBeCloseTo(2 * TILE, 0);
  expect(blocked.blocked.left).toBe(true);
  expect(blocked.x, "the body must never leave the level").toBeGreaterThanOrEqual(0);
});

test("enemy bodies match the documented speeds and sizes", async ({ page }) => {
  await boot(page);
  await startLevel(page, 0);
  await tick(page, 2);

  const rules = await page.evaluate(() => (window as unknown as { mkw: DebugApi }).mkw.game().enemies);
  const bodies = await enemies(page);

  expect(bodies.length, "every rule enemy owns one body").toBe(rules.length);
  expect(rules.some((enemy) => enemy.speed === 130), "level 1 has walkers").toBe(true);
  expect(rules.some((enemy) => enemy.fly), "level 1 has flyers").toBe(true);
  for (const body of bodies) {
    const rule = rules.find((candidate) => candidate.id === body.id);
    expect(rule, `body ${body.id} must have a rule enemy`).toBeDefined();
    expect(body.alive).toBe(true);
    expect([body.w, body.h], "enemy body is 60x60").toEqual([60, 60]);
    if (!rule) continue;
    if (rule.fly) {
      expect(Math.abs(body.vy), "a flyer never exceeds the sine amplitude").toBeLessThanOrEqual(121);
    } else {
      expect(
        Math.abs(body.vx) === 0 || Math.abs(body.vx) === rule.speed,
        `walker speed ${body.vx} must be 0 or ${rule.speed}`,
      ).toBe(true);
    }
  }
});

test("a walker keeps its documented speed in the open room of level 4", async ({ page }) => {
  await boot(page);
  await startLevel(page, 3);
  await tick(page, 60);

  const before = (await enemies(page))[0];
  await tick(page, 10);
  const after = (await enemies(page))[0];

  expect(before.alive).toBe(true);
  expect(Math.abs(before.vx), "level 4 walker runs at 150 px/s").toBe(150);
  expect(after.x - before.x, "ten ticks move the body by vx * 10 * 1/70").toBeCloseTo(
    before.vx * 10 * (1 / 70),
    6,
  );
});

test("a walker turns around at the wall of level 4", async ({ page }) => {
  await boot(page);
  await startLevel(page, 3);

  // Catch the tick the patrol direction flips: the body must be at the wall.
  const turn = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    let previous = mkw.snapshot().enemies[0].dir;
    for (let i = 0; i < 400; i++) {
      mkw.tick(1);
      const enemy = mkw.snapshot().enemies[0];
      if (enemy.dir !== previous) return { tick: i + 1, x: enemy.x, dir: enemy.dir, w: enemy.w };
      previous = enemy.dir;
    }
    return null;
  });

  if (!turn) throw new Error("the walker never reached the wall");
  expect(turn.dir, "the wall must flip the patrol direction").toBe(-1);
  // The flip is read one step after the separation: allow one tick of walk-back.
  expect(
    Math.abs(turn.x - (22 * TILE - turn.w)),
    "the body must rest at the wall when it turns",
  ).toBeLessThanOrEqual(3);

  await tick(page, 30);
  const walkedBack = (await enemies(page))[0];
  expect(walkedBack.x, "a turned walker must walk away from the wall").toBeLessThan(turn.x - 30);
});

test("the S10 exit door still opens and completes the level", async ({ page }) => {
  await boot(page);
  // Level 4 is one screen wide: the spawn is in (4, 12), the door tile in (3, 12).
  await startLevel(page, 3);
  await tick(page, 20);

  await page.keyboard.down("ArrowLeft");
  const centreTile = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    const tile = (): number => {
      const player = mkw.snapshot().player;
      return Math.floor((player.x + player.w / 2) / 80);
    };
    for (let i = 0; i < 60 && tile() > 3; i++) mkw.tick(1);
    return tile();
  });
  await page.keyboard.up("ArrowLeft");
  expect(centreTile, "the hero must stand under the door tile").toBe(3);

  // The door row is above the standing centre, so the jump puts the centre in it.
  await page.keyboard.press("Space");
  const door = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    let opened = mkw.game().door;
    for (let i = 0; i < 40 && !opened; i++) {
      mkw.tick(1);
      opened = mkw.game().door;
    }
    return opened;
  });
  expect(door).toEqual({ tx: 3, ty: 12, step: 0, timer: 0 });

  const nextLevelWidth = await page.evaluate(() => {
    const mkw = (window as unknown as { mkw: DebugApi }).mkw;
    mkw.tick(15);
    return mkw.game().level.pixelWidth;
  });
  // 15 ticks after the trigger the level is complete and level 5 (56 tiles) starts.
  expect(nextLevelWidth).toBe(56 * TILE);
});

test("replaying the same tick sequence reproduces the same player position", async ({ page }) => {
  await boot(page);

  const run = async (): Promise<PlayerSnapshot> => {
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
