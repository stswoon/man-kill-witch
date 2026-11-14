import { describe, expect, test } from "vitest";
import { TILE } from "../web/src/assets";
import { Player, type Level } from "../web/src/game";
import { DT, SOLID, fakeInput, makeLevel, placeOnFloor, type FakeInput } from "./helpers";

const FLOOR = 10;
const FLOOR_TOP = FLOOR * TILE;

function step(player: Player, level: Level, input: FakeInput, count = 1): void {
  for (let i = 0; i < count; i++) {
    player.update(DT, level, input);
    input.hits.clear();
  }
}

function standOnFloor(): { player: Player; level: Level; input: FakeInput } {
  const level = makeLevel({ width: 20, height: 15, floor: FLOOR });
  const player = new Player();
  placeOnFloor(player, 2, FLOOR);
  return { player, level, input: fakeInput() };
}

describe("Player movement", () => {
  test("falls with gravity and lands on the floor", () => {
    const level = makeLevel({ width: 20, height: 15, floor: FLOOR });
    const player = new Player();
    placeOnFloor(player, 2, FLOOR);
    player.y = 3 * TILE;
    const input = fakeInput();

    step(player, level, input, 60);

    expect(player.onGround).toBe(true);
    expect(player.y + player.h, "feet must not sink into the floor").toBeLessThanOrEqual(FLOOR_TOP + 1);
    expect(player.y + player.h, "feet must come to rest on the floor").toBeGreaterThanOrEqual(FLOOR_TOP - 1);
    expect(player.vy).toBe(0);
  });

  test("accelerates up to the run speed", () => {
    const { player, level, input } = standOnFloor();
    const startX = player.x;
    input.down.add("ArrowRight");

    step(player, level, input, 10);

    expect(player.vx).toBe(132);
    expect(player.facing).toBe(1);
    expect(player.x).toBeGreaterThan(startX);
  });

  test("friction stops the player when input is released", () => {
    const { player, level, input } = standOnFloor();
    input.down.add("ArrowRight");
    step(player, level, input, 10);

    input.down.delete("ArrowRight");
    step(player, level, input, 10);

    expect(player.vx).toBe(0);
    expect(player.facing).toBe(1);
  });

  test("faces left while running left", () => {
    const { player, level, input } = standOnFloor();
    input.down.add("ArrowLeft");
    step(player, level, input, 5);
    expect(player.facing).toBe(-1);
    expect(player.vx).toBeLessThan(0);
  });

  test("caps the falling speed", () => {
    const level = makeLevel({ width: 20, height: 40 });
    const player = new Player();
    const input = fakeInput();

    step(player, level, input, 50);

    expect(player.vy).toBe(520);
  });

  test("stops at a wall", () => {
    const level = makeLevel({
      width: 20,
      height: 15,
      floor: FLOOR,
      tiles: [
        [5, 8, SOLID],
        [5, 9, SOLID],
      ],
    });
    const player = new Player();
    placeOnFloor(player, 3, FLOOR);
    const input = fakeInput();
    input.down.add("ArrowRight");

    step(player, level, input, 120);

    expect(player.x + player.w, "body must not pass the wall").toBeLessThanOrEqual(5 * TILE + 1);
    expect(player.x + player.w, "body must reach the wall").toBeGreaterThanOrEqual(5 * TILE);
  });

  test("stops at a ceiling", () => {
    const level = makeLevel({
      width: 20,
      height: 15,
      floor: FLOOR,
      tiles: [
        [0, 6, SOLID],
        [1, 6, SOLID],
        [2, 6, SOLID],
        [3, 6, SOLID],
        [4, 6, SOLID],
      ],
    });
    const player = new Player();
    placeOnFloor(player, 2, FLOOR);
    const input = fakeInput();

    input.press("Space");
    let highest = player.y;
    for (let i = 0; i < 60; i++) {
      player.update(DT, level, input);
      input.hits.clear();
      highest = Math.min(highest, player.y);
    }

    expect(highest, "head must not pass the ceiling").toBeGreaterThanOrEqual(7 * TILE);
    expect(player.onGround).toBe(true);
  });
});

describe("Player jump", () => {
  test("jumps only from the ground", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);

    input.press("Space");
    player.update(DT, level, input);
    input.hits.clear();
    expect(player.vy, "jump must launch upwards").toBeLessThan(0);
    expect(player.onGround).toBe(false);

    const beforeSecondPress = player.vy;
    input.press("Space");
    player.update(DT, level, input);
    input.hits.clear();
    expect(player.vy, "airborne Space must not re-launch").toBeGreaterThan(beforeSecondPress);
  });

  test("clears two tiles but not three, as design.md requires", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);
    const startY = player.y;

    input.press("Space");
    player.update(DT, level, input);
    input.hits.clear();
    let highest = player.y;
    for (let i = 0; i < 90; i++) {
      player.update(DT, level, input);
      input.hits.clear();
      highest = Math.min(highest, player.y);
      if (player.onGround && i > 5) break;
    }

    const rise = startY - highest;
    expect(rise, `rise ${rise}px must clear two tiles`).toBeGreaterThan(2 * TILE);
    expect(rise, `rise ${rise}px must not reach three tiles`).toBeLessThan(3 * TILE);
    expect(rise, `rise ${rise}px should stay close to the documented 46px`).toBeGreaterThanOrEqual(40);
    expect(rise, `rise ${rise}px should stay close to the documented 46px`).toBeLessThanOrEqual(50);
  });
});

describe("Player reload", () => {
  test("reloads while standing on the ground", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);
    player.ammo = 0;
    player.cooldown = 0;

    step(player, level, input, 26);

    expect(player.ammo).toBe(8);
    expect(player.reload).toBe(0);
  });

  test("freezes reload progress in the air and resumes on landing", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);
    player.ammo = 0;
    player.cooldown = 0;
    step(player, level, input, 10);
    expect(player.reload).toBe(10);

    input.press("Space");
    step(player, level, input, 1);
    const frozen = player.reload;
    expect(player.onGround).toBe(false);
    step(player, level, input, 5);
    expect(player.reload, "reload must not advance in the air").toBe(frozen);
    expect(player.ammo).toBe(0);

    step(player, level, input, 100);
    expect(player.onGround).toBe(true);
    expect(player.ammo).toBe(8);
  });

  test("waits for the shot cooldown before reloading", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);
    player.ammo = 0;
    player.cooldown = 5;

    step(player, level, input, 1);
    expect(player.reload).toBe(0);

    step(player, level, input, 4);
    expect(player.reload).toBe(1);
  });
});
