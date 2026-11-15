import { describe, expect, test } from "vitest";
import { Game } from "../web/src/game";
import { RUN_SPEED } from "../web/src/sim-contract";
import { fakeInput, makeArena, makeSnapshot, tick } from "./helpers";

/**
 * Rules-side player tests. Motion, gravity, walls, ceilings and landings moved
 * to `e2e/physics.spec.ts`: the rules only turn input into `PlayerIntent`.
 */
describe("Player intents", () => {
  test("running right asks Arcade for the run speed and faces right", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.down.add("ArrowRight");

    const [commands] = tick(game, input);

    expect(commands.player).toEqual({ targetVx: RUN_SPEED, jump: false, facing: 1 });
    expect(commands.player.targetVx).toBe(660);
  });

  test("released keys ask for friction and keep the last facing", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.down.add("ArrowLeft");
    tick(game, input);

    input.down.delete("ArrowLeft");
    const [commands] = tick(game, input);

    expect(commands.player, "target 0 means friction, not a reverse run").toEqual({
      targetVx: 0,
      jump: false,
      facing: -1,
    });
  });

  test("faces left while running left", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.down.add("ArrowLeft");

    const [commands] = tick(game, input);

    expect(commands.player.targetVx).toBe(-RUN_SPEED);
    expect(commands.player.facing).toBe(-1);
    expect(game.player.facing).toBe(-1);
  });

  test("jumps only from the ground", () => {
    const game = new Game(makeArena());
    const input = fakeInput();

    input.press("Space");
    const [airborne] = tick(game, input, makeSnapshot(game, { player: { onGround: false } }));
    expect(airborne.player.jump, "airborne Space must not request a jump").toBe(false);

    input.press("Space");
    const [grounded] = tick(game, input, makeSnapshot(game, { player: { onGround: true } }));
    expect(grounded.player.jump).toBe(true);
  });

  test("aim follows the vertical keys and never changes the facing", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    input.down.add("ArrowRight");
    tick(game, input);

    input.down.add("ArrowUp");
    tick(game, input);
    expect(game.player.aim).toBe(-1);
    expect(game.player.facing).toBe(1);

    input.down.delete("ArrowUp");
    input.down.add("ArrowDown");
    tick(game, input);
    expect(game.player.aim).toBe(1);

    input.down.delete("ArrowDown");
    tick(game, input);
    expect(game.player.aim).toBe(0);
  });
});

describe("Player reload", () => {
  test("reloads while standing on the ground", () => {
    const game = new Game(makeArena());
    game.player.ammo = 0;
    game.player.cooldown = 0;

    tick(game, fakeInput(), makeSnapshot(game), 26);

    expect(game.player.ammo).toBe(8);
    expect(game.player.reload).toBe(0);
  });

  test("freezes reload progress in the air and resumes on landing", () => {
    const game = new Game(makeArena());
    const input = fakeInput();
    game.player.ammo = 0;
    game.player.cooldown = 0;

    tick(game, input, makeSnapshot(game, { player: { onGround: false } }), 10);
    expect(game.player.reload, "reload must not advance in the air").toBe(0);

    tick(game, input, makeSnapshot(game, { player: { onGround: true } }), 26);
    expect(game.player.ammo).toBe(8);
  });

  test("waits for the shot cooldown before reloading", () => {
    const game = new Game(makeArena());
    game.player.ammo = 0;
    game.player.cooldown = 5;

    tick(game, fakeInput(), makeSnapshot(game), 1);
    expect(game.player.reload).toBe(0);

    tick(game, fakeInput(), makeSnapshot(game), 4);
    expect(game.player.reload).toBe(1);
  });
});
