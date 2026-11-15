import type { DoorState, Game, Level } from "../game";
import type { WorldSnapshot } from "../sim-contract";
import { exitPolicy, findExitClusters, spawnTile, type BotExitPolicy } from "./bot-exits";
import { BotInput } from "./bot-input";
import {
  buildMinimap,
  buildWindow,
  describeBullets,
  describeEnemies,
  describePlayer,
  MINIMAP_SCALE,
  playerCenter,
  WINDOW_LEGEND,
} from "./bot-observe";
import {
  BOT_ACTIONS,
  type BotAction,
  type BotActionResult,
  type BotDone,
  type BotExit,
  type BotLastAction,
  type BotObservation,
  type BotPoint,
  type BotRouteLog,
  type BotStatus,
} from "./types";

export interface BotSessionOptions {
  /** Zero-based level index, as `GameScene` stores it. */
  levelIndex: number;
  seed: number;
  game: Game;
  level: Level;
  snapshot: () => WorldSnapshot;
  step: () => void;
  render: () => void;
  renderEnabled: boolean;
  maxActions: number;
  maxTicks: number;
}

/** Ticks a walk/wait action uses when the caller does not pass a count. */
const DEFAULT_TICKS = 10;
/** Hard cap per action; a jump normally ends much earlier, on landing. */
const MAX_ACTION_TICKS = 70;
/** The player starts on the spawn marker; let gravity settle it first. */
const SETTLE_TICKS = 40;

/**
 * One LLM-driven level run. The session owns the action log, the target exits,
 * the virtual keyboard and the verdict. It never writes into `Game`; the only
 * way to move the hero is `input` plus the scene's fixed step.
 */
export class BotSession {
  readonly input = new BotInput();

  private readonly levelIndex: number;
  private readonly seed: number;
  private readonly game: Game;
  private readonly level: Level;
  private readonly snapshotFn: () => WorldSnapshot;
  private readonly stepFn: () => void;
  private readonly renderFn: () => void;
  private readonly renderEnabled: boolean;
  private readonly maxActions: number;
  private readonly maxTicks: number;
  private readonly spawn: BotPoint;
  private readonly exits: BotExit[];
  private readonly policy: BotExitPolicy;
  private readonly route: BotRouteLog["actions"] = [];

  private lastAction: BotLastAction | null = null;
  private lastDoor: DoorState | null = null;
  private done: BotDone | null = null;
  private actions = 0;
  private deaths = 0;
  private previousLives: number;

  constructor(options: BotSessionOptions) {
    this.levelIndex = options.levelIndex;
    this.seed = options.seed;
    this.game = options.game;
    this.level = options.level;
    this.snapshotFn = options.snapshot;
    this.stepFn = options.step;
    this.renderFn = options.render;
    this.renderEnabled = options.renderEnabled;
    this.maxActions = options.maxActions;
    this.maxTicks = options.maxTicks;
    this.spawn = spawnTile(this.level);
    this.exits = findExitClusters(this.level, this.spawn);
    this.policy = exitPolicy(this.exits);
    this.previousLives = this.game.lives;
  }

  /** Lets the hero drop onto the spawn ledge before the first action. */
  settle(): void {
    this.input.clear();
    const start = this.game.tick;
    while (this.game.tick - start < SETTLE_TICKS && !this.done) {
      if (this.snapshotFn().player.onGround) break;
      this.stepOnce();
    }
    if (this.renderEnabled) this.renderFn();
  }

  /**
   * Runs one macro action for up to `ticks` fixed steps. Jumps, hops and drops
   * end when the hero lands again; walks end on a wall or the tick limit.
   */
  act(action: BotAction, ticks?: number): BotObservation {
    if (!BOT_ACTIONS.includes(action)) {
      throw new Error(`unknown bot action: ${String(action)}`);
    }
    if (this.done) return this.observe();

    const maxTicks = this.actionTicks(action, ticks);
    const startSnapshot = this.snapshotFn();
    const from = playerCenter(startSnapshot);
    const startLives = this.game.lives;
    const startAmmo = this.game.player.ammo;
    const startCooldown = this.game.player.cooldown;
    let wasAirborne = !startSnapshot.player.onGround;
    let result: BotActionResult = "timeout";
    let ran = 0;

    for (let tick = 0; tick < maxTicks; tick++) {
      if (this.done) break;
      if (this.game.tick >= this.maxTicks) {
        this.done = { kind: "budget" };
        break;
      }

      this.input.set(action, tick);
      this.stepOnce();
      ran = tick + 1;
      if (this.done) break;

      const snapshot = this.snapshotFn();
      if (this.game.lives < startLives) {
        result = "died";
        break;
      }
      if (!snapshot.player.onGround) wasAirborne = true;
      if (this.stopsOnLanding(action) && wasAirborne && snapshot.player.onGround) {
        result = "landed";
        break;
      }
      if (this.isWalk(action) && this.blockedInto(snapshot, action)) {
        result = "blocked";
        break;
      }
    }

    this.input.clear();
    this.actions++;

    const endSnapshot = this.snapshotFn();
    const to = playerCenter(endSnapshot);
    if (this.done?.kind === "levelComplete") result = "levelComplete";
    else if (this.done?.kind === "gameOver") result = "gameOver";
    else if (!this.done && result === "timeout") {
      if (this.isShoot(action)) {
        result = this.game.player.ammo < startAmmo || this.game.player.cooldown > startCooldown
          ? "shot"
          : this.game.player.cooldown > 0 ? "cooldown" : "no-ammo";
      } else if (action === "wait") {
        result = "waited";
      } else if (action === "stop") {
        result = "stopped";
      } else if (this.changed(startSnapshot, endSnapshot)) {
        result = "moved";
      } else {
        result = "blocked";
      }
    }

    this.lastAction = { action, ticks: ran, result, from, to };
    this.route.push({ action, ticks: ran });
    if (!this.done && this.actions >= this.maxActions) this.done = { kind: "budget" };
    if (this.renderEnabled) this.renderFn();
    return this.observe();
  }

  /** The scene calls this when a door finishes opening. */
  onLevelComplete(): void {
    if (!this.done) this.done = { kind: "levelComplete" };
  }

  /** Clears held keys before the scene hands control back to the keyboard. */
  dispose(): void {
    this.input.clear();
  }

  observe(): BotObservation {
    const snapshot = this.snapshotFn();
    const player = describePlayer(snapshot);
    const status = this.status();
    const target = this.policy.target;
    const hint = target
      ? `target exit (${target.tx},${target.ty}) at dx=${target.tx - player.tx}, dy=${target.ty - player.ty}`
      : "no exit found";

    return {
      level: this.levelIndex + 1,
      seed: this.seed,
      tick: this.game.tick,
      state: status.state,
      player,
      ammo: this.game.player.ammo,
      lives: this.game.lives,
      score: this.game.score,
      cooldown: this.game.player.cooldown,
      reload: this.game.player.reload,
      invuln: this.game.player.invuln,
      target,
      exits: this.exits,
      enemies: describeEnemies(snapshot, this.game.enemies, player),
      bullets: describeBullets(snapshot, player),
      door: this.game.door ? { ...this.game.door } : null,
      window: buildWindow(this.level, player, snapshot, this.spawn),
      minimap: buildMinimap(this.level, player, this.spawn),
      minimapScale: MINIMAP_SCALE,
      legend: WINDOW_LEGEND,
      hint,
      warnings: status.warnings,
      actions: BOT_ACTIONS,
      lastAction: this.lastAction,
      done: this.done,
      status: {
        verdict: status.verdict,
        reason: status.reason,
        exitNextToSpawn: status.exitNextToSpawn,
        noExit2: status.noExit2,
        reachedDoor: status.reachedDoor,
        earlyExit: status.earlyExit,
      },
    };
  }

  /** Harness verdict. The LLM reads it; it cannot declare a pass itself. */
  status(): BotStatus {
    const reachedDoor = this.reachedDoor();
    const earlyExit = Boolean(
      reachedDoor?.cluster && this.policy.target && reachedDoor.cluster !== this.policy.target,
    );
    const warnings: string[] = [];
    if (this.policy.noExit2) warnings.push("no behavior-2 exit; using behavior-1 fallback");
    if (this.policy.exitNextToSpawn) warnings.push("exit is within 2 tiles of the spawn");
    if (this.game.player.ammo === 0) warnings.push("ammo is empty; stand still to reload");
    if (this.deaths >= 2) warnings.push("two deaths; the next one can end the run");
    if (earlyExit) warnings.push("reached a different exit than the suggested target");

    const finish = this.finish(reachedDoor);
    return {
      level: this.levelIndex + 1,
      seed: this.seed,
      state: this.done?.kind ?? "play",
      done: this.done,
      tick: this.game.tick,
      actions: this.actions,
      deaths: this.deaths,
      lives: this.game.lives,
      ammo: this.game.player.ammo,
      score: this.game.score,
      target: this.policy.target,
      exits: this.exits,
      exitBehavior: this.policy.exitBehavior,
      exitNextToSpawn: this.policy.exitNextToSpawn,
      noExit2: this.policy.noExit2,
      reachedDoor,
      earlyExit,
      verdict: finish.verdict,
      reason: finish.reason,
      warnings,
      lastAction: this.lastAction,
    };
  }

  /** Action log plus the final status; save it to replay the route later. */
  log(): BotRouteLog {
    return {
      level: this.levelIndex + 1,
      seed: this.seed,
      target: this.policy.target,
      actions: this.route.map((entry) => ({ ...entry })),
      status: this.status(),
    };
  }

  private stepOnce(): void {
    if (this.done) return;
    const door = this.game.door;
    if (door) this.lastDoor = door;
    this.stepFn();
    this.input.endTick();
    if (this.game.lives < this.previousLives) {
      this.deaths++;
      this.previousLives = this.game.lives;
    }
    if (this.game.levelComplete) this.done = { kind: "levelComplete" };
    else if (this.game.gameOver) this.done = { kind: "gameOver" };
  }

  private reachedDoor(): BotStatus["reachedDoor"] {
    if (!this.lastDoor) return null;
    const { tx, ty } = this.lastDoor;
    const cluster = this.exits.find((exit) =>
      exit.tiles.some((tile) => tile.tx === tx && tile.ty === ty),
    ) ?? null;
    return { tx, ty, behavior: cluster?.behavior ?? 0, cluster };
  }

  private finish(reachedDoor: BotStatus["reachedDoor"]): {
    verdict: BotStatus["verdict"];
    reason: string;
  } {
    if (this.policy.exitNextToSpawn) return { verdict: "FAIL", reason: "exit-next-to-spawn" };
    if (this.done?.kind === "gameOver") return { verdict: "FAIL", reason: "game-over" };
    if (this.done?.kind === "budget") return { verdict: "FAIL", reason: "budget" };
    if (this.done?.kind === "stopped") return { verdict: "CANCELLED", reason: "stopped" };
    if (this.done?.kind === "levelComplete") {
      if (reachedDoor?.behavior === this.policy.exitBehavior) {
        return { verdict: "PASS", reason: "reached-exit" };
      }
      return { verdict: "FAIL", reason: "wrong-exit" };
    }
    return { verdict: "IN_PROGRESS", reason: "in-progress" };
  }

  private actionTicks(action: BotAction, ticks?: number): number {
    const fallback = this.isJumpLike(action) || this.isDrop(action) ? MAX_ACTION_TICKS
      : DEFAULT_TICKS;
    const requested = ticks === undefined ? fallback : Math.max(1, Math.floor(ticks));
    if (this.isShoot(action) || action === "stop") return 1;
    return Math.min(requested, MAX_ACTION_TICKS);
  }

  private isJumpLike(action: BotAction): boolean {
    return action === "jump"
      || action === "jump_left"
      || action === "jump_right"
      || action === "hop_left"
      || action === "hop_right";
  }

  private isDrop(action: BotAction): boolean {
    return action === "drop_left" || action === "drop_right";
  }

  private isWalk(action: BotAction): boolean {
    return action === "left" || action === "right";
  }

  private isShoot(action: BotAction): boolean {
    return action === "shoot" || action === "shoot_up" || action === "shoot_down";
  }

  private stopsOnLanding(action: BotAction): boolean {
    return this.isJumpLike(action) || this.isDrop(action);
  }

  private blockedInto(snapshot: WorldSnapshot, action: BotAction): boolean {
    if (action === "left") return snapshot.player.blocked.left;
    if (action === "right") return snapshot.player.blocked.right;
    return false;
  }

  private changed(before: WorldSnapshot, after: WorldSnapshot): boolean {
    return Math.round(before.player.x) !== Math.round(after.player.x)
      || Math.round(before.player.y) !== Math.round(after.player.y);
  }
}
