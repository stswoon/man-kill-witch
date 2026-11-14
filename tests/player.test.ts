import assert from "node:assert/strict";
import { describe, test } from "node:test";
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

    assert.equal(player.onGround, true);
    assert.ok(player.y + player.h <= FLOOR_TOP + 1, "feet must not sink into the floor");
    assert.ok(player.y + player.h >= FLOOR_TOP - 1, "feet must come to rest on the floor");
    assert.equal(player.vy, 0);
  });

  test("accelerates up to the run speed", () => {
    const { player, level, input } = standOnFloor();
    const startX = player.x;
    input.down.add("ArrowRight");

    step(player, level, input, 10);

    assert.equal(player.vx, 132);
    assert.equal(player.facing, 1);
    assert.ok(player.x > startX);
  });

  test("friction stops the player when input is released", () => {
    const { player, level, input } = standOnFloor();
    input.down.add("ArrowRight");
    step(player, level, input, 10);

    input.down.delete("ArrowRight");
    step(player, level, input, 10);

    assert.equal(player.vx, 0);
    assert.equal(player.facing, 1);
  });

  test("faces left while running left", () => {
    const { player, level, input } = standOnFloor();
    input.down.add("ArrowLeft");
    step(player, level, input, 5);
    assert.equal(player.facing, -1);
    assert.ok(player.vx < 0);
  });

  test("caps the falling speed", () => {
    const level = makeLevel({ width: 20, height: 40 });
    const player = new Player();
    const input = fakeInput();

    step(player, level, input, 50);

    assert.equal(player.vy, 520);
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

    assert.ok(player.x + player.w <= 5 * TILE + 1, "body must not pass the wall");
    assert.ok(player.x + player.w >= 5 * TILE, "body must reach the wall");
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

    assert.ok(highest >= 7 * TILE, "head must not pass the ceiling");
    assert.equal(player.onGround, true);
  });
});

describe("Player jump", () => {
  test("jumps only from the ground", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);

    input.press("Space");
    player.update(DT, level, input);
    input.hits.clear();
    assert.ok(player.vy < 0, "jump must launch upwards");
    assert.equal(player.onGround, false);

    const beforeSecondPress = player.vy;
    input.press("Space");
    player.update(DT, level, input);
    input.hits.clear();
    assert.ok(player.vy > beforeSecondPress, "airborne Space must not re-launch");
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
    assert.ok(rise > 2 * TILE, `rise ${rise}px must clear two tiles`);
    assert.ok(rise < 3 * TILE, `rise ${rise}px must not reach three tiles`);
    assert.ok(rise >= 40 && rise <= 50, `rise ${rise}px should stay close to the documented 46px`);
  });
});

describe("Player reload", () => {
  test("reloads while standing on the ground", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);
    player.ammo = 0;
    player.cooldown = 0;

    step(player, level, input, 26);

    assert.equal(player.ammo, 8);
    assert.equal(player.reload, 0);
  });

  test("freezes reload progress in the air and resumes on landing", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);
    player.ammo = 0;
    player.cooldown = 0;
    step(player, level, input, 10);
    assert.equal(player.reload, 10);

    input.press("Space");
    step(player, level, input, 1);
    const frozen = player.reload;
    assert.equal(player.onGround, false);
    step(player, level, input, 5);
    assert.equal(player.reload, frozen, "reload must not advance in the air");
    assert.equal(player.ammo, 0);

    step(player, level, input, 100);
    assert.equal(player.onGround, true);
    assert.equal(player.ammo, 8);
  });

  test("waits for the shot cooldown before reloading", () => {
    const { player, level, input } = standOnFloor();
    step(player, level, input, 1);
    player.ammo = 0;
    player.cooldown = 5;

    step(player, level, input, 1);
    assert.equal(player.reload, 0);

    step(player, level, input, 4);
    assert.equal(player.reload, 1);
  });
});
