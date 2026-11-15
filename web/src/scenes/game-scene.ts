import Phaser from "phaser";
import { ArcadeSim } from "../arcade/arcade-sim";
import type { Assets } from "../assets";
import { BotSession } from "../bot/bot-session";
import { withSeededRandom } from "../bot/bot-random";
import type {
  BotAction,
  BotDebugApi,
  BotObservation,
  BotReplayOptions,
  BotResetOptions,
  BotRouteLog,
  BotStatus,
} from "../bot/types";
import { Game, Level } from "../game";
import { Input } from "../input";
import { PhaserView } from "../phaser-view";
import { Sfx } from "../sfx";
import { TICK, type WorldSnapshot } from "../sim-contract";

/** Fixed logic tick; the Arcade world is stepped once per tick with the same value. */
const DT = TICK;

type State = "title" | "play" | "gameover" | "win";

interface DebugApi {
  assets: Assets;
  phaser: Phaser.Game;
  game: () => Game;
  snapshot: () => WorldSnapshot;
  startLevel: (index: number) => void;
  renderer: PhaserView;
  step: (dt: number) => void;
  tick: (count: number, dt?: number) => void;
  getState: () => State;
  setSpeed: (speed: number) => void;
  bot: BotDebugApi;
}

/** Owns the state machine, the rules and the Arcade layer, and drives the fixed step. */
export class GameScene extends Phaser.Scene {
  private assets!: Assets;
  private controls!: Input;
  private sfx!: Sfx;
  private view!: PhaserView;
  private sim!: Game;
  private arcade!: ArcadeSim;
  private state: State = "title";
  private levelIndex = 0;
  private stateTimer = 0;
  private acc = 0;
  private speed = 1;
  private bot: BotSession | null = null;

  constructor() {
    // `customUpdate` keeps Arcade out of the render delta: the scene calls the
    // single world step itself, exactly once per 1/70 s rules tick.
    super({ key: "game", physics: { arcade: { customUpdate: true } } });
  }

  init(data: { assets: Assets }): void {
    this.assets = data.assets;
  }

  create(): void {
    this.controls = new Input();
    this.sfx = new Sfx();
    this.view = new PhaserView(this);
    // The level is prepared behind the opaque title screen, without the HUD.
    this.loadLevel(0, false);
    this.state = "title";
    this.levelIndex = 0;
    this.stateTimer = 0;
    this.acc = 0;
    this.view.showTitle();

    (window as unknown as { mkw: DebugApi }).mkw = {
      assets: this.assets,
      phaser: this.game,
      game: () => this.sim,
      snapshot: () => this.arcade.snapshot(),
      startLevel: (index: number) => this.startLevel(index),
      renderer: this.view,
      step: (dt: number) => this.step(dt),
      tick: (count: number, dt?: number) => this.tick(count, dt ?? DT),
      getState: () => this.state,
      setSpeed: (speed: number) => this.setSpeed(speed),
      bot: {
        reset: (level: number, options?: BotResetOptions) => this.botReset(level, options),
        observe: () => this.botObserve(),
        act: (action: BotAction, ticks?: number) => this.botAct(action, ticks),
        status: () => this.botStatus(),
        log: () => this.botLog(),
        replay: (route: BotRouteLog, options?: BotReplayOptions) => this.botReplay(route, options),
        stop: () => this.botStop(),
      },
    };
  }

  update(_time: number, delta: number): void {
    this.acc += Math.min(0.25, (delta / 1000) * this.speed);
    let guard = 0;
    // Fixed ticks only: no render and no `endFrame` inside the loop.
    while (this.acc >= DT && guard++ < 8) {
      this.step(DT);
      this.acc -= DT;
    }
    // One render frame: the accumulated tile patches, then the single render.
    this.flushTilePatches();
    if (this.state !== "title") this.view.render(this.sim, this.arcade.snapshot(), this.levelIndex);
    this.controls.endFrame();
  }

  private startLevel(index: number, seed?: number): void {
    this.bot = null;
    this.loadLevel(index, true, seed);
    this.view.hideTitle();
    this.view.hideMessage();
    this.state = "play";
    this.stateTimer = 0;
  }

  /** Rebuilds the rules, the Arcade world and the tilemap for level `index`. */
  private loadLevel(index: number, withHud = true, seed?: number): void {
    this.levelIndex = Math.max(0, Math.min(this.assets.levels.length - 1, index));
    const level = new Level(this.assets.levels[this.levelIndex], this.assets.tileInfo);
    this.sim = withSeededRandom(seed, () => new Game(level));
    this.arcade?.destroy();
    this.view.buildLevel(this.sim, withHud);
    this.arcade = new ArcadeSim(
      this,
      this.view.tilemapLayer,
      { width: this.sim.level.pixelWidth, height: this.sim.level.pixelHeight },
      this.assets.tileInfo,
      {
        player: { x: this.sim.spawnX, y: this.sim.spawnY },
        enemies: this.sim.enemies,
      },
    );
  }

  private setState(next: State, title: string, subtitle: string): void {
    this.state = next;
    this.stateTimer = 0;
    this.view.showMessage(title, subtitle);
  }

  /**
   * Test-only hook for `e2e/physics.spec.ts`: advances rules and Arcade exactly
   * `count` fixed steps and clears one-shot presses after every step, so a
   * single key press cannot stick to the whole batch. It does not render and
   * leaves the normal frame loop untouched, which still patches and renders
   * once per rendered frame.
   */
  private tick(count: number, dt: number): void {
    const steps = Math.max(0, Math.floor(count));
    for (let i = 0; i < steps; i++) {
      this.step(dt);
      this.controls.endFrame();
    }
    this.flushTilePatches();
  }

  /** Fixed tick: snapshot -> rules -> Arcade commands -> tile patches -> one step. */
  private step(dt: number): void {
    this.stateTimer++;
    const input = this.bot?.input ?? this.controls;

    if (this.state === "title") {
      if (input.wasPressed("Space", "Enter")) this.startLevel(0);
      return;
    }
    if (this.state === "gameover" || this.state === "win") {
      if (this.stateTimer > 30 && input.wasPressed("Space", "Enter")) {
        if (this.state === "win") this.startLevel(0);
        else this.startLevel(this.levelIndex);
      }
      return;
    }

    const prevAmmo = this.sim.player.ammo;
    const prevScore = this.sim.score;
    const prevLives = this.sim.lives;

    const snapshot = this.arcade.snapshot();
    const commands = this.sim.update(dt, input, snapshot);
    this.arcade.apply(commands);
    this.arcade.applyTilePatches(this.sim.tilePatches);
    this.arcade.step(dt);

    if (this.sim.player.ammo < prevAmmo) this.sfx.shoot();
    if (this.sim.score > prevScore) this.sfx.hit();
    if (this.sim.lives < prevLives) {
      if (this.sim.gameOver) {
        this.sfx.die();
        this.setState("gameover", "GAME OVER", "PRESS SPACE");
        return;
      }
      this.sfx.die();
    }

    for (let i = 1; i <= 8; i++) {
      if (input.wasPressed(`Digit${i}`)) this.startLevel(i - 1);
    }

    if (this.sim.levelComplete) {
      // The bot run needs the final door and tick count; it starts the next
      // level explicitly, so the scene must not auto-advance underneath it.
      if (this.bot) {
        this.bot.onLevelComplete();
        return;
      }
      if (this.levelIndex < this.assets.levels.length - 1) {
        this.sfx.door();
        this.startLevel(this.levelIndex + 1);
      } else if (this.state === "play") {
        this.sfx.win();
        this.setState("win", "CONGRATULATIONS!", "THE WITCH IS GONE — PRESS SPACE");
      }
    }
  }

  /** Debug-only speed multiplier for the normal render loop (x1..x8). */
  private setSpeed(speed: number): void {
    this.speed = Math.max(1, Math.min(8, Math.round(speed)));
  }

  /**
   * Starts a level for the LLM pilot, stops the Phaser render loop and settles
   * the hero on the spawn ledge. `mkw.bot.act` is the only thing that advances
   * the world while the loop sleeps, so observations are deterministic.
   */
  private botReset(level: number, options: BotResetOptions = {}): BotObservation {
    const seed = options.seed ?? 1;
    this.startLevel(level, seed);
    this.game.loop.sleep();
    const session = new BotSession({
      levelIndex: this.levelIndex,
      seed,
      game: this.sim,
      level: this.sim.level,
      snapshot: () => this.arcade.snapshot(),
      step: () => this.step(DT),
      render: () => this.renderNow(),
      renderEnabled: options.render !== false,
      maxActions: options.maxActions ?? 500,
      maxTicks: options.maxTicks ?? 8000,
    });
    this.bot = session;
    session.settle();
    return session.observe();
  }

  private botObserve(): BotObservation {
    return this.requireBot().observe();
  }

  private botAct(action: BotAction, ticks?: number): BotObservation {
    return this.requireBot().act(action, ticks);
  }

  private botStatus(): BotStatus {
    return this.requireBot().status();
  }

  private botLog(): BotRouteLog {
    return this.requireBot().log();
  }

  private botReplay(route: BotRouteLog, options: BotReplayOptions = {}): BotStatus {
    this.botReset(route.level - 1, { seed: route.seed, render: options.render ?? false });
    for (const entry of route.actions) {
      if (this.botStatus().done) break;
      this.botAct(entry.action, entry.ticks);
    }
    return this.botStatus();
  }

  private botStop(): void {
    this.bot?.dispose();
    this.bot = null;
    this.game.loop.wake();
  }

  private requireBot(): BotSession {
    if (!this.bot) throw new Error("mkw.bot.reset(level) first");
    return this.bot;
  }

  /** Draws once after a bot action so the Playwright page shows the result. */
  private renderNow(): void {
    if (this.state === "title") return;
    this.flushTilePatches();
    this.view.render(this.sim, this.arcade.snapshot(), this.levelIndex);
  }

  /** Applies the tile changes of the finished ticks to the shared tilemap once. */
  private flushTilePatches(): void {
    const patches = this.sim.tilePatches;
    if (!patches.length) return;
    this.view.patchTiles(patches);
    patches.length = 0;
  }
}
