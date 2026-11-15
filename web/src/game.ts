import { LevelData, SCREEN_H, SCREEN_W, TILE, TILE_FLAG_MASK, TileInfoData } from "./assets";
import {
  BULLET_LIFE,
  MAGAZINE,
  PLAYER_H,
  PLAYER_W,
  RELOAD_TICKS,
  RUN_SPEED,
  SHOT_COOLDOWN,
  BULLET_SPEED,
  type BulletSpawn,
  type EnemyIntent,
  type PlayerIntent,
  type RespawnPoint,
  type TickCommands,
  type TilePatch,
  type WorldSnapshot,
} from "./sim-contract";

/** The part of the keyboard state the simulation needs. `Input` satisfies it structurally. */
export interface InputState {
  isDown(...codes: string[]): boolean;
  wasPressed(...codes: string[]): boolean;
}

export type Dir = "up" | "down" | "left" | "right";

/** Flyer sine: `phase += dt * 2.4`, vertical speed `sin(phase) * 120`. */
const FLYER_PHASE_RATE = 2.4;
const FLYER_AMPLITUDE = 120;
/** A flyer above this line or below `pixelHeight - 120` is lost. */
const FLYER_TOP_LIMIT = 40;
const FLYER_BOTTOM_MARGIN = 120;

/** Entity marker id -> sprite id. Temporary mapping for the prototype level data. */
const SPRITE_BY_ID: Record<number, number> = {
  1: 2, 2: 3, 3: 4, 4: 6, 5: 6, 6: 5, 7: 8, 9: 7, 11: 10, 12: 11, 13: 12,
  14: 9, 15: 9, 16: 9, 17: 9, 18: 9, 19: 9,
};

export class Level {
  readonly width: number;
  readonly height: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly tiles: Uint16Array;
  readonly entities: Uint16Array;
  private readonly info: TileInfoData;

  constructor(data: LevelData, info: TileInfoData) {
    this.width = data.width;
    this.height = data.height;
    this.pixelWidth = data.width * TILE;
    this.pixelHeight = data.height * TILE;
    this.tiles = Uint16Array.from(data.tiles);
    this.entities = Uint16Array.from(data.entities);
    this.info = info;
  }

  tileAt(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return -1;
    return this.tiles[ty * this.width + tx] & TILE_FLAG_MASK;
  }

  blocks(tx: number, ty: number, dir: Dir): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
    const t = this.tiles[ty * this.width + tx] & TILE_FLAG_MASK;
    const i = this.info;
    switch (dir) {
      case "up": return i.blockUp[t] !== 0;
      case "down": return i.blockDown[t] !== 0;
      case "left": return i.blockLeft[t] !== 0;
      case "right": return i.blockRight[t] !== 0;
    }
  }

  behaviorAt(tx: number, ty: number): number {
    const t = this.tileAt(tx, ty);
    return t < 0 ? 0 : this.info.behavior[t];
  }

  setTile(tx: number, ty: number, index: number): void {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return;
    const i = ty * this.width + tx;
    const flags = this.tiles[i] & ~TILE_FLAG_MASK;
    this.tiles[i] = flags | (index & TILE_FLAG_MASK);
  }
}

/**
 * Rules-side hero state: ammo, timers and facing. The body and its motion live
 * in the Arcade layer and arrive as a `WorldSnapshot`.
 */
export class Player {
  facing = 1;
  aim = 0;
  ammo = MAGAZINE;
  cooldown = 0;
  reload = 0;
  invuln = 0;
}

/**
 * Rules-side enemy: spawn data, patrol state and the decisions the rules make.
 * `ArcadeSim` owns the body that moves; `alive` mirrors the kill decision.
 */
export class Enemy {
  alive = true;
  dir = 1;
  sprite = 0;
  fly = false;
  speed = 150;
  /** `walker` turns at ledges, `charger` runs straight off them. */
  turnsAtLedge = true;
  private phase = Math.random() * Math.PI * 2;

  constructor(
    public readonly id: number,
    public readonly type: number,
    /** Spawn position, kept for tests and for the Arcade layer to build the body. */
    public readonly x: number,
    public readonly y: number,
  ) {}

  /** Advances the flyer sine and returns its vertical speed. */
  flyerSpeed(dt: number): number {
    this.phase += dt * FLYER_PHASE_RATE;
    return Math.sin(this.phase) * FLYER_AMPLITUDE;
  }
}

/** Rules-side bullet: the 40-tick life; the body is created and removed by Arcade. */
export class Bullet {
  constructor(public readonly id: number, public life = BULLET_LIFE) {}
}

/** Door opening: 2 tiles wide, 3 tall, top-left corner at `(tx-1, ty-1)`. */
const DOOR_TILE_COLUMNS = 2;
const DOOR_TILE_ROWS = 3;
/** 70 / 5 ticks per shown frame; the third step ends the level, 15 ticks in total. */
const DOOR_TICKS_PER_STEP = 5;
const DOOR_STEPS = 3;

/** Trigger tile and opening progress of the exit door. Read-only for the view. */
export interface DoorState {
  readonly tx: number;
  readonly ty: number;
  readonly step: number;
  readonly timer: number;
}

export class Game {
  level: Level;
  player = new Player();
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  cameraX = 0;
  cameraY = 0;
  tick = 0;
  lives = 3;
  score = 0;
  gameOver = false;
  hurtFlash = 0;
  levelComplete = false;
  tilePatches: TilePatch[] = [];
  /** Top-left corner of the hero body on the spawn marker. */
  readonly spawnX: number;
  readonly spawnY: number;
  private doorState: DoorState | null = null;
  private nextExtraLife = 5000;
  private nextBulletId = 1;

  constructor(level: Level) {
    this.level = level;
    const [spawnTx, spawnTy] = this.findSpawn();
    this.spawnX = spawnTx * TILE + 10;
    this.spawnY = spawnTy * TILE + TILE - PLAYER_H;
    this.enemies = this.spawnEnemies();
    this.player.invuln = 30;
    this.focusCamera(this.spawnX + PLAYER_W / 2, this.spawnY + PLAYER_H / 2);
  }

  /** Active door opening; the view can read it but never write it. */
  get door(): DoorState | null {
    return this.doorState;
  }

  /**
   * One fixed tick of rules. Reads the world as it was at the start of the
   * tick, never integrates motion, and returns what the Arcade layer has to do
   * before its single `1/70` step.
   */
  update(dt: number, input: InputState, snapshot: WorldSnapshot): TickCommands {
    this.tick++;
    const p = this.player;
    p.cooldown = Math.max(0, p.cooldown - 1);
    p.invuln = Math.max(0, p.invuln - 1);
    // Reload only while standing: docs/design.md. Progress freezes in the air.
    if (p.cooldown === 0 && p.ammo === 0 && snapshot.player.onGround) {
      p.reload++;
      if (p.reload >= RELOAD_TICKS) { p.ammo = MAGAZINE; p.reload = 0; }
    }

    const left = input.isDown("ArrowLeft", "KeyA");
    const right = input.isDown("ArrowRight", "KeyD");
    p.aim = input.isDown("ArrowUp", "KeyW") ? -1 : input.isDown("ArrowDown", "KeyS") ? 1 : 0;

    let targetVx = 0;
    if (left !== right) {
      targetVx = (right ? 1 : -1) * RUN_SPEED;
      p.facing = right ? 1 : -1;
    }

    const killed = new Set<number>();
    const despawned = new Set<number>();
    const enemyIntents = this.updateEnemies(dt, snapshot, killed);
    const spawnBullet = this.tryShoot(input, snapshot);
    let respawnPlayer: RespawnPoint | null = null;

    for (const event of snapshot.events) {
      if (event.type === "bulletHitEnemy") {
        if (this.killEnemy(event.enemyId)) {
          killed.add(event.enemyId);
          this.score += 100;
        }
        despawned.add(event.bulletId);
      } else if (event.type === "bulletHitWall") {
        despawned.add(event.bulletId);
      }
    }

    // Touches come after the kills: an enemy shot in this same step is already
    // dead and cannot hurt the hero (the pre-S11 order did the same).
    for (const event of snapshot.events) {
      if (event.type !== "playerTouchedEnemy") continue;
      if (this.gameOver || p.invuln > 0) continue;
      const enemy = this.enemies.find((candidate) => candidate.id === event.enemyId);
      if (!enemy || !enemy.alive) continue;
      respawnPlayer = this.hurtPlayer();
    }

    // The 40-tick life belongs to the rules; Arcade only owns the body.
    for (const bullet of this.bullets) {
      bullet.life--;
      if (bullet.life <= 0) despawned.add(bullet.id);
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && !despawned.has(b.id));

    this.interact(snapshot);
    this.focusCamera(
      snapshot.player.x + snapshot.player.w / 2,
      snapshot.player.y + snapshot.player.h / 2,
    );

    while (this.score >= this.nextExtraLife) {
      this.lives++;
      this.nextExtraLife += 5000;
    }

    const player: PlayerIntent = {
      targetVx,
      jump: input.wasPressed("Space") && snapshot.player.onGround,
      facing: p.facing,
    };

    return {
      player,
      enemies: enemyIntents,
      spawnBullet,
      despawnBullet: [...despawned],
      killEnemy: [...killed],
      respawnPlayer,
    };
  }

  /** Door tiles before the opening, the sprite trigger after it. */
  private interact(snapshot: WorldSnapshot): void {
    const tx = Math.floor((snapshot.player.x + snapshot.player.w / 2) / TILE);
    const ty = Math.floor((snapshot.player.y + snapshot.player.h / 2) / TILE);

    if (this.doorState) {
      this.advanceDoor();
      return;
    }

    const beh = this.level.behaviorAt(tx, ty);
    if (beh === 1 || beh === 2) {
      this.openDoor(tx, ty);
    } else if (beh === 52 || beh === 53 || beh === 54) {
      this.score += beh === 52 ? 100 : beh === 53 ? 250 : 500;
      this.level.setTile(tx, ty, 0);
      this.tilePatches.push({ x: tx, y: ty, index: 0 });
    } else if (beh >= 105 && beh <= 109) {
      this.player.ammo = Math.min(MAGAZINE, this.player.ammo + 1);
      this.level.setTile(tx, ty, 0);
      this.tilePatches.push({ x: tx, y: ty, index: 0 });
    }
  }

  /**
   * The center of the player entered an exit tile: remember the trigger and
   * clear every in-map cell of the 2x3 block. The opening itself is the
   * `door-open` sprite, so no other tiles change.
   */
  private openDoor(tx: number, ty: number): void {
    this.doorState = { tx, ty, step: 0, timer: 0 };
    for (let row = 0; row < DOOR_TILE_ROWS; row++) {
      for (let column = 0; column < DOOR_TILE_COLUMNS; column++) {
        const x = tx - 1 + column;
        const y = ty - 1 + row;
        if (this.level.tileAt(x, y) < 0) continue; // outside the map
        this.level.setTile(x, y, 0);
        this.tilePatches.push({ x, y, index: 0 });
      }
    }
  }

  /** Five ticks per sprite frame; the third step completes the level. */
  private advanceDoor(): void {
    const door = this.doorState;
    if (!door) return;

    const timer = door.timer + 1;
    if (timer < DOOR_TICKS_PER_STEP) {
      this.doorState = { ...door, timer };
      return;
    }

    const step = door.step + 1;
    if (step < DOOR_STEPS) {
      this.doorState = { tx: door.tx, ty: door.ty, step, timer: 0 };
      return;
    }

    this.levelComplete = true;
    this.score += 1000; // level bonus
    this.doorState = null;
  }

  private tryShoot(input: InputState, snapshot: WorldSnapshot): BulletSpawn | null {
    const p = this.player;
    if (!input.wasPressed("ControlLeft", "ControlRight") || p.ammo === 0 || p.cooldown !== 0) {
      return null;
    }
    p.ammo--;
    p.cooldown = SHOT_COOLDOWN;
    const bullet = new Bullet(this.nextBulletId++);
    this.bullets.push(bullet);
    return {
      id: bullet.id,
      x: snapshot.player.x + snapshot.player.w / 2 + p.facing * 30,
      y: snapshot.player.y + snapshot.player.h / 2 + p.aim * 30,
      vx: p.facing * BULLET_SPEED,
      vy: p.aim * BULLET_SPEED * 0.75,
    };
  }

  /**
   * AI decisions from the snapshot: walkers and chargers patrol and turn at
   * walls and (walkers only) ledges, flyers follow a sine and die out of bounds.
   */
  private updateEnemies(dt: number, snapshot: WorldSnapshot, killed: Set<number>): EnemyIntent[] {
    const intents: EnemyIntent[] = [];
    const bodies = new Map(snapshot.enemies.map((body) => [body.id, body]));

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const body = bodies.get(enemy.id);
      if (!body || !body.alive) {
        // Arcade no longer has a live body: keep the rules in sync.
        enemy.alive = false;
        continue;
      }

      if (enemy.fly) {
        const flyerVy = enemy.flyerSpeed(dt);
        const probeX = enemy.dir > 0 ? body.x + body.w + 1 : body.x - 1;
        const tx = Math.floor(probeX / TILE);
        const ty = Math.floor((body.y + body.h / 2) / TILE);
        if (this.level.blocks(tx, ty, enemy.dir > 0 ? "right" : "left")) enemy.dir = -enemy.dir;
        if (body.x < 0 || body.x + body.w > this.level.pixelWidth) enemy.dir = -enemy.dir;
        if (body.y < FLYER_TOP_LIMIT || body.y > this.level.pixelHeight - FLYER_BOTTOM_MARGIN) {
          enemy.alive = false;
          killed.add(enemy.id);
          continue;
        }
        intents.push({ id: enemy.id, targetVx: enemy.dir * enemy.speed, dir: enemy.dir, flyerVy });
        continue;
      }

      if (body.blocked.left && enemy.dir < 0) enemy.dir = 1;
      if (body.blocked.right && enemy.dir > 0) enemy.dir = -1;
      if (body.onGround && enemy.turnsAtLedge) {
        const probeX = enemy.dir > 0 ? body.x + body.w + 1 : body.x - 1;
        const tx = Math.floor(probeX / TILE);
        const ty = Math.floor((body.y + body.h + 1) / TILE);
        if (!this.level.blocks(tx, ty, "down")) enemy.dir = -enemy.dir;
      }
      intents.push({ id: enemy.id, targetVx: enemy.dir * enemy.speed, dir: enemy.dir, flyerVy: 0 });
    }

    return intents;
  }

  private killEnemy(id: number): boolean {
    const enemy = this.enemies.find((candidate) => candidate.id === id);
    if (!enemy || !enemy.alive) return false;
    enemy.alive = false;
    return true;
  }

  private hurtPlayer(): RespawnPoint | null {
    this.lives = Math.max(0, this.lives - 1);
    this.hurtFlash = 40;
    if (this.lives === 0) {
      this.gameOver = true;
      return null;
    }
    this.player.invuln = 60;
    return { x: this.spawnX, y: this.spawnY };
  }

  private focusCamera(cx: number, cy: number): void {
    this.cameraX = Math.round(cx - SCREEN_W / 2);
    this.cameraY = Math.round(cy - SCREEN_H / 2);
    this.cameraX = Math.max(0, Math.min(this.level.pixelWidth - SCREEN_W, this.cameraX));
    this.cameraY = Math.max(0, Math.min(this.level.pixelHeight - SCREEN_H, this.cameraY));
  }

  private findSpawn(): [number, number] {
    for (let i = 0; i < this.level.entities.length; i++) {
      if (this.level.entities[i] === 255) {
        return [i % this.level.width, Math.floor(i / this.level.width)];
      }
    }
    return [2, 2];
  }

  private spawnEnemies(): Enemy[] {
    const enemies: Enemy[] = [];
    for (let i = 0; i < this.level.entities.length; i++) {
      const id = this.level.entities[i];
      if (id === 0 || id === 255 || id >= 0x8000) continue;
      const sprite = SPRITE_BY_ID[id];
      if (sprite === undefined) continue; // not a spawn marker we understand
      const tx = i % this.level.width;
      const ty = Math.floor(i / this.level.width);
      const enemy = new Enemy(enemies.length, id, tx * TILE + 10, ty * TILE + 20);
      enemy.sprite = sprite;
      if (id >= 14 && id <= 19) {
        enemy.fly = true;
        enemy.speed = 170;
      } else if (id === 1 || id === 2) {
        enemy.speed = 130;
      } else if (id === 6 || id === 7 || id === 9) {
        enemy.speed = 200;
        enemy.turnsAtLedge = false;
      } else {
        enemy.speed = 150;
      }
      enemies.push(enemy);
    }
    return enemies;
  }
}
