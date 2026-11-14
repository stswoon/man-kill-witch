import { LevelData, TileInfoData, TILE, TILE_FLAG_MASK } from "./assets";

/** The part of the keyboard state the simulation needs. `Input` satisfies it structurally. */
export interface InputState {
  isDown(...codes: string[]): boolean;
  wasPressed(...codes: string[]): boolean;
}

// Physics values are product decisions; the reference table lives in
// docs/design.md.
const GRAVITY = 980;
const RUN_SPEED = 132;
const ACCEL = 1400;
const FRICTION = 1800;
const JUMP_SPEED = 300;
const MAX_FALL = 520;
const BULLET_SPEED = 380;
const BULLET_LIFE = 40;
/** Drawn as 3x1, but the hit box is two pixels tall so edge-on shots still land. */
const BULLET_W = 3;
const BULLET_H = 2;
const SHOT_COOLDOWN = 8;
const RELOAD_TICKS = 26;

export type Dir = "up" | "down" | "left" | "right";

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

interface Body {
  x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean;
}

function blocked(level: Level, body: Body, x: number, y: number, dir: Dir): boolean {
  const y0 = Math.floor(y / TILE);
  const y1 = Math.floor((y + body.h - 1) / TILE);
  const x0 = Math.floor(x / TILE);
  const x1 = Math.floor((x + body.w - 1) / TILE);
  if (dir === "left" || dir === "right") {
    const tx = dir === "left" ? x0 : x1;
    for (let ty = y0; ty <= y1; ty++) if (level.blocks(tx, ty, dir)) return true;
  } else {
    const ty = dir === "up" ? y0 : y1;
    for (let tx = x0; tx <= x1; tx++) if (level.blocks(tx, ty, dir)) return true;
  }
  return false;
}

function moveBody(level: Level, body: Body, dx: number, dy: number): void {
  const step = 8;
  let remaining = Math.abs(dx || dy);
  const signX = Math.sign(dx);
  const signY = Math.sign(dy);
  while (remaining > 0) {
    const move = Math.min(step, remaining);
    remaining -= move;
    if (signX) {
      const nx = body.x + move * signX;
      if (blocked(level, body, nx, body.y, signX > 0 ? "right" : "left")) { body.vx = 0; break; }
      body.x = nx;
    }
    if (signY) {
      const ny = body.y + move * signY;
      if (blocked(level, body, body.x, ny, signY > 0 ? "down" : "up")) {
        body.vy = 0;
        break;
      }
      body.y = ny;
    }
  }
}

/**
 * Ground contact is probed one pixel below the feet instead of being derived
 * from a blocked step: gravity moves in fractions of a pixel, so the blocked
 * step only happens every other tick and `onGround` would flicker.
 */
function touchesGround(level: Level, body: Body): boolean {
  return blocked(level, body, body.x, body.y + 1, "down");
}

export class Player implements Body {
  x = 64;
  y = 64;
  vx = 0;
  vy = 0;
  readonly w = 12;
  readonly h = 24;
  onGround = false;
  facing = 1;
  aim = 0;
  ammo = 8;
  cooldown = 0;
  reload = 0;
  invuln = 0;

  get cx(): number { return this.x + this.w / 2; }
  get cy(): number { return this.y + this.h / 2; }

  update(dt: number, level: Level, input: InputState): void {
    this.cooldown = Math.max(0, this.cooldown - 1);
    this.invuln = Math.max(0, this.invuln - 1);
    // Reload only while standing: docs/design.md. Progress freezes in the air.
    if (this.cooldown === 0 && this.ammo === 0 && this.onGround) {
      this.reload++;
      if (this.reload >= RELOAD_TICKS) { this.ammo = 8; this.reload = 0; }
    }

    const left = input.isDown("ArrowLeft", "KeyA");
    const right = input.isDown("ArrowRight", "KeyD");
    this.aim = input.isDown("ArrowUp", "KeyW") ? -1 : input.isDown("ArrowDown", "KeyS") ? 1 : 0;

    let target = 0;
    if (left !== right) {
      target = (right ? 1 : -1) * RUN_SPEED;
      this.facing = right ? 1 : -1;
    }
    const rate = target === 0 ? FRICTION : ACCEL;
    if (this.vx < target) this.vx = Math.min(target, this.vx + rate * dt);
    else if (this.vx > target) this.vx = Math.max(target, this.vx - rate * dt);

    if (input.wasPressed("Space") && this.onGround) {
      this.vy = -JUMP_SPEED;
      this.onGround = false;
    }

    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);

    moveBody(level, this, this.vx * dt, 0);
    moveBody(level, this, 0, this.vy * dt);
    this.onGround = touchesGround(level, this);
  }
}

export class Enemy implements Body {
  alive = true;
  onGround = false;
  vy = 0;
  dir: number;
  w = 12;
  h = 12;
  sprite = 0;
  fly = false;
  speed = 30;
  /** `walker` turns at ledges, `charger` runs straight off them. */
  turnsAtLedge = true;
  private phase = Math.random() * Math.PI * 2;

  constructor(public type: number, public x: number, public y: number, public vx = 0) {
    this.dir = 1;
  }

  update(dt: number, level: Level): void {
    if (!this.alive) return;
    if (this.fly) {
      this.phase += dt * 2.4;
      this.x += this.dir * this.speed * dt;
      this.y += Math.sin(this.phase) * 24 * dt;
      const tx = Math.floor((this.dir > 0 ? this.x + this.w + 1 : this.x - 1) / TILE);
      const ty = Math.floor((this.y + this.h / 2) / TILE);
      if (level.blocks(tx, ty, this.dir > 0 ? "right" : "left")) this.dir = -this.dir;
      if (this.y < 8 || this.y > level.pixelHeight - 24) this.alive = false;
      return;
    }

    this.vx = this.dir * this.speed;
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);

    const beforeX = this.x;
    moveBody(level, this, this.vx * dt, 0);
    if (this.x === beforeX && this.vx === 0) this.dir = -this.dir;

    moveBody(level, this, 0, this.vy * dt);
    this.onGround = touchesGround(level, this);

    // turn at ledges
    if (this.onGround && this.turnsAtLedge) {
      const probeX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const tx = Math.floor(probeX / TILE);
      const ty = Math.floor((this.y + this.h + 1) / TILE);
      if (!level.blocks(tx, ty, "down")) this.dir = -this.dir;
    }
  }
}

export class Bullet {
  life = BULLET_LIFE;
  constructor(public x: number, public y: number, public vx: number, public vy: number) {}
}

/** Door animation frames: 3 x 2 tiles per step, three steps. */
const DOOR_FRAMES: number[][] = [
  [148, 151, 149, 152, 150, 153],
  [78, 79, 91, 92, 104, 105],
  [833, 832, 724, 725, 737, 738],
];

interface DoorState {
  tx: number;
  ty: number;
  step: number;
  timer: number;
}

export interface TilePatch { x: number; y: number; index: number }

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
  private door: DoorState | null = null;
  private nextExtraLife = 5000;

  constructor(level: Level) {
    this.level = level;
    this.spawn();
  }

  spawn(): void {
    let sx = 2, sy = 2;
    for (let i = 0; i < this.level.entities.length; i++) {
      if (this.level.entities[i] === 255) {
        sx = i % this.level.width;
        sy = Math.floor(i / this.level.width);
        break;
      }
    }
    this.player.x = sx * TILE + 2;
    this.player.y = sy * TILE + TILE - this.player.h;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invuln = 30;

    this.enemies = [];
    for (let i = 0; i < this.level.entities.length; i++) {
      const id = this.level.entities[i];
      if (id === 0 || id === 255 || id >= 0x8000) continue;
      const sprite = SPRITE_BY_ID[id];
      if (sprite === undefined) continue; // not a spawn marker we understand
      const tx = i % this.level.width;
      const ty = Math.floor(i / this.level.width);
      const e = new Enemy(id, tx * TILE + 2, ty * TILE + 4);
      e.sprite = sprite;
      if (id >= 14 && id <= 19) {
        e.fly = true;
        e.speed = 34;
        e.w = 12;
        e.h = 12;
      } else if (id === 1 || id === 2) {
        e.speed = 26;
      } else if (id === 6 || id === 7 || id === 9) {
        e.speed = 40;
        e.turnsAtLedge = false;
      } else {
        e.speed = 30;
      }
      this.enemies.push(e);
    }
    this.updateCamera();
  }

  update(dt: number, input: InputState): void {
    this.tick++;
    const p = this.player;
    p.update(dt, this.level, input);

    if (input.wasPressed("ControlLeft", "ControlRight") && p.ammo > 0 && p.cooldown === 0) {
      p.ammo--;
      p.cooldown = SHOT_COOLDOWN;
      const vx = p.facing * BULLET_SPEED;
      const vy = p.aim * BULLET_SPEED * 0.75;
      this.bullets.push(new Bullet(p.cx + p.facing * 6, p.cy + p.aim * 6, vx, vy));
    }

    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life--;
      const tx = Math.floor(b.x / TILE);
      const ty = Math.floor(b.y / TILE);
      if (this.level.blocks(tx, ty, "left") || this.level.blocks(tx, ty, "right")) b.life = 0;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (
          b.x + BULLET_W > e.x && b.x < e.x + e.w &&
          b.y + BULLET_H > e.y && b.y < e.y + e.h
        ) {
          e.alive = false;
          b.life = 0;
          this.score += 100;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    for (const e of this.enemies) {
      e.update(dt, this.level);
      if (e.alive && p.invuln === 0 && this.overlaps(p, e)) {
        this.hurtPlayer();
      }
    }

    this.clampPlayer();
    this.updateCamera();
    this.interact();

    while (this.score >= this.nextExtraLife) {
      this.lives++;
      this.nextExtraLife += 5000;
    }
  }

  /** Doors open with a 3x2 tile animation; special tiles act as pickups. */
  private interact(): void {
    const p = this.player;
    const tx = Math.floor((p.x + p.w / 2) / TILE);
    const ty = Math.floor((p.y + p.h / 2) / TILE);

    if (!this.door) {
      const beh = this.level.behaviorAt(tx, ty);
      if (beh === 1 || beh === 2) {
        this.door = { tx, ty, step: 0, timer: 0 };
      } else if (beh === 52 || beh === 53 || beh === 54) {
        this.score += beh === 52 ? 100 : beh === 53 ? 250 : 500;
        this.level.setTile(tx, ty, 0);
        this.tilePatches.push({ x: tx, y: ty, index: 0 });
      } else if (beh >= 105 && beh <= 109) {
        p.ammo = Math.min(8, p.ammo + 1);
        this.level.setTile(tx, ty, 0);
        this.tilePatches.push({ x: tx, y: ty, index: 0 });
      }
      return;
    }

    const d = this.door;
    d.timer++;
    if (d.timer < 5) return;
    d.timer = 0;
    d.step++;
    if (d.step >= DOOR_FRAMES.length) {
      this.levelComplete = true;
      this.score += 1000; // level bonus
      this.door = null;
      return;
    }
    const frame = DOOR_FRAMES[d.step];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const x = d.tx - 1 + c;
        const y = d.ty - 1 + r;
        const index = frame[r * 2 + c];
        this.level.setTile(x, y, index);
        this.tilePatches.push({ x, y, index });
      }
    }
  }

  private overlaps(a: Body, b: Body): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private hurtPlayer(): void {
    this.lives--;
    this.hurtFlash = 40;
    if (this.lives <= 0) {
      this.gameOver = true;
      return;
    }
    this.player.invuln = 60;
    let sx = 2, sy = 2;
    for (let i = 0; i < this.level.entities.length; i++) {
      if (this.level.entities[i] === 255) {
        sx = i % this.level.width;
        sy = Math.floor(i / this.level.width);
        break;
      }
    }
    this.player.x = sx * TILE + 2;
    this.player.y = sy * TILE + TILE - this.player.h;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  private clampPlayer(): void {
    const p = this.player;
    p.x = Math.max(0, Math.min(this.level.pixelWidth - p.w, p.x));
    if (p.y > this.level.pixelHeight) { p.y = 2 * TILE; p.vy = 0; }
    if (p.y < 0) { p.y = 0; p.vy = 0; }
  }

  private updateCamera(): void {
    const p = this.player;
    this.cameraX = Math.round(p.cx - 160);
    this.cameraY = Math.round(p.cy - 100);
    this.cameraX = Math.max(0, Math.min(this.level.pixelWidth - 320, this.cameraX));
    this.cameraY = Math.max(0, Math.min(this.level.pixelHeight - 200, this.cameraY));
  }
}
