import Phaser from "phaser";
import type { Assets } from "../assets";
import { Game, Level } from "../game";
import { Input } from "../input";
import { PhaserView } from "../phaser-view";
import { Sfx } from "../sfx";

const DT = 1 / 70;

type State = "title" | "play" | "gameover" | "win";

interface DebugApi {
  assets: Assets;
  phaser: Phaser.Game;
  game: () => Game;
  startLevel: (index: number) => void;
  renderer: PhaserView;
  step: (dt: number) => void;
  getState: () => State;
}

/** Owns the state machine and drives the fixed-step simulation. */
export class GameScene extends Phaser.Scene {
  private assets!: Assets;
  private controls!: Input;
  private sfx!: Sfx;
  private view!: PhaserView;
  private sim!: Game;
  private state: State = "title";
  private levelIndex = 0;
  private stateTimer = 0;
  private acc = 0;

  constructor() {
    super("game");
  }

  init(data: { assets: Assets }): void {
    this.assets = data.assets;
  }

  create(): void {
    this.controls = new Input();
    this.sfx = new Sfx();
    this.view = new PhaserView(this);
    this.sim = new Game(new Level(this.assets.levels[0], this.assets.tileInfo));
    this.state = "title";
    this.levelIndex = 0;
    this.stateTimer = 0;
    this.acc = 0;
    this.view.showTitle();

    (window as unknown as { mkw: DebugApi }).mkw = {
      assets: this.assets,
      phaser: this.game,
      game: () => this.sim,
      startLevel: (index: number) => this.startLevel(index),
      renderer: this.view,
      step: (dt: number) => this.step(dt),
      getState: () => this.state,
    };
  }

  update(_time: number, delta: number): void {
    this.acc += Math.min(0.25, delta / 1000);
    let guard = 0;
    while (this.acc >= DT && guard++ < 8) {
      this.step(DT);
      this.acc -= DT;
    }
    if (this.state !== "title") this.view.render(this.sim, this.levelIndex);
    this.controls.endFrame();
  }

  private startLevel(index: number): void {
    this.levelIndex = Math.max(0, Math.min(this.assets.levels.length - 1, index));
    this.sim = new Game(new Level(this.assets.levels[this.levelIndex], this.assets.tileInfo));
    this.view.buildLevel(this.sim);
    this.view.hideTitle();
    this.view.hideMessage();
    this.state = "play";
    this.stateTimer = 0;
  }

  private setState(next: State, title: string, subtitle: string): void {
    this.state = next;
    this.stateTimer = 0;
    this.view.showMessage(title, subtitle);
  }

  private step(dt: number): void {
    this.stateTimer++;

    if (this.state === "title") {
      if (this.controls.wasPressed("Space", "Enter")) this.startLevel(0);
      return;
    }
    if (this.state === "gameover" || this.state === "win") {
      if (this.stateTimer > 30 && this.controls.wasPressed("Space", "Enter")) {
        if (this.state === "win") this.startLevel(0);
        else this.startLevel(this.levelIndex);
      }
      return;
    }

    const prevAmmo = this.sim.player.ammo;
    const prevScore = this.sim.score;
    const prevLives = this.sim.lives;
    this.sim.update(dt, this.controls);

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
      if (this.controls.wasPressed(`Digit${i}`)) this.startLevel(i - 1);
    }

    if (this.sim.tilePatches.length) {
      this.view.patchTiles(this.sim.tilePatches);
      this.sim.tilePatches.length = 0;
    }

    if (this.sim.levelComplete) {
      if (this.levelIndex < this.assets.levels.length - 1) {
        this.sfx.door();
        this.startLevel(this.levelIndex + 1);
      } else if (this.state === "play") {
        this.sfx.win();
        this.setState("win", "CONGRATULATIONS!", "THE WITCH IS GONE — PRESS SPACE");
      }
    }
  }
}
