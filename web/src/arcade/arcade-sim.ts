import type Phaser from "phaser";
import { TILE, TILE_FLAG_MASK, type TileInfoData } from "../assets";
import {
  ACCEL,
  BULLET_H,
  BULLET_W,
  ENEMY_H,
  ENEMY_W,
  FRICTION,
  GRAVITY,
  JUMP_SPEED,
  MAX_FALL,
  PLAYER_H,
  PLAYER_W,
  RUN_SPEED,
  type BlockedSides,
  type BulletSnapshot,
  type BulletSpawn,
  type EnemyIntent,
  type EnemySpawn,
  type EnemySnapshot,
  type PhysicsEvent,
  type PlayerIntent,
  type TickCommands,
  type TilePatch,
  type WorldSnapshot,
  type WorldSpawn,
} from "../sim-contract";

/**
 * Tile bias for the tilemap collision. The rules fall at 2600 px/s, which is
 * ~37 px per `1/70` tick, so the default 16 px would let a body tunnel through
 * a tile. One tile of bias keeps every documented speed on the surface.
 */
const TILE_BIAS = TILE;

/** Level bounds in screen px; everything else comes from the shared contract. */
export interface LevelBounds {
  width: number;
  height: number;
}

interface EnemyBody {
  readonly id: number;
  readonly sprite: number;
  readonly fly: boolean;
  dir: number;
  alive: boolean;
  readonly body: Phaser.Physics.Arcade.Body;
}

/**
 * The only owner of the Arcade world: the hero, enemy and bullet bodies and the
 * tilemap collision. It moves bodies and reports what happened; every rule
 * (score, lives, doors, pickups) stays in `game.ts`.
 */
export class ArcadeSim {
  private readonly world: Phaser.Physics.Arcade.World;
  private readonly layer: Phaser.Tilemaps.TilemapLayer;
  private readonly info: TileInfoData;
  private readonly playerBody: Phaser.Physics.Arcade.Body;
  private readonly enemies: EnemyBody[];
  private readonly bullets = new Map<number, Phaser.Physics.Arcade.Body>();
  private playerDir = 1;
  /** Collisions of the last step, read by the rules at the start of the next tick. */
  private events: PhysicsEvent[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.Tilemaps.TilemapLayer,
    bounds: LevelBounds,
    info: TileInfoData,
    spawn: WorldSpawn,
  ) {
    this.layer = layer;
    this.info = info;
    this.world = scene.physics.world;
    this.world.gravity.set(0, GRAVITY);
    this.world.TILE_BIAS = TILE_BIAS;
    this.world.setBounds(0, 0, bounds.width, bounds.height);
    this.setTileCollisions();

    this.playerBody = this.createBody(spawn.player.x, spawn.player.y, PLAYER_W, PLAYER_H, true, true);
    this.enemies = spawn.enemies.map((enemy: EnemySpawn) => ({
      id: enemy.id,
      sprite: enemy.sprite,
      fly: enemy.fly,
      dir: 1,
      alive: true,
      body: this.createBody(enemy.x, enemy.y, ENEMY_W, ENEMY_H, !enemy.fly, !enemy.fly),
    }));
  }

  /** Detaches every body from the world; the scene builds a new sim per level. */
  destroy(): void {
    this.playerBody.destroy();
    for (const enemy of this.enemies) enemy.body.destroy();
    for (const body of this.bullets.values()) body.destroy();
    this.bullets.clear();
  }

  /** Start-of-tick world state for the rules and the view. */
  snapshot(): WorldSnapshot {
    return {
      player: {
        x: this.playerBody.x,
        y: this.playerBody.y,
        w: this.playerBody.width,
        h: this.playerBody.height,
        vx: this.playerBody.velocity.x,
        vy: this.playerBody.velocity.y,
        onGround: this.playerBody.blocked.down,
        blocked: sides(this.playerBody),
        dir: this.playerDir,
      },
      enemies: this.enemies.map((enemy) => this.enemySnapshot(enemy)),
      bullets: [...this.bullets].map(([id, body]): BulletSnapshot => ({
        id,
        x: body.x,
        y: body.y,
        w: body.width,
        h: body.height,
        vx: body.velocity.x,
        vy: body.velocity.y,
      })),
      events: [...this.events],
    };
  }

  /**
   * Applies the rules decisions. Runs before the single world step, so the
   * bodies integrate this tick with the velocities and jumps chosen here.
   */
  apply(commands: TickCommands): void {
    this.applyPlayer(commands.player);
    for (const intent of commands.enemies) this.applyEnemy(intent);
    for (const id of commands.despawnBullet) this.removeBullet(id);
    for (const id of commands.killEnemy) this.removeEnemy(id);
    if (commands.spawnBullet) this.spawnBullet(commands.spawnBullet);
    if (commands.respawnPlayer) this.playerBody.reset(commands.respawnPlayer.x, commands.respawnPlayer.y);
  }

  /** Mirrors the runtime tile changes into the collision layer before the step. */
  applyTilePatches(patches: readonly TilePatch[]): void {
    for (const patch of patches) {
      if (patch.index > 0) {
        const tile = this.layer.putTileAt(patch.index, patch.x, patch.y);
        if (tile) this.setTileCollision(tile);
      } else {
        this.layer.removeTileAt(patch.x, patch.y);
      }
    }
  }

  /**
   * Exactly one Arcade step of `dt` plus `postUpdate`, so a render frame that
   * runs several ticks never loses body movement. The world frame time is
   * pinned to `dt`, which keeps the physics step equal to the rules tick.
   * Tilemap collisions are resolved here, after the bodies moved, because the
   * sim owns no colliders that would run inside the world step.
   */
  step(dt: number): void {
    this.events = [];
    this.world.setFPS(1 / dt);
    this.world.singleStep();
    this.resolveCollisions();
  }

  private applyPlayer(intent: PlayerIntent): void {
    this.playerDir = intent.facing;
    const body = this.playerBody;
    if (intent.targetVx === 0) {
      body.setAccelerationX(0);
      body.setDragX(FRICTION);
    } else {
      body.setDragX(0);
      body.setAccelerationX(Math.sign(intent.targetVx) * ACCEL);
    }
    if (intent.jump) body.setVelocityY(-JUMP_SPEED);
  }

  private applyEnemy(intent: EnemyIntent): void {
    const enemy = this.enemies.find((candidate) => candidate.id === intent.id);
    if (!enemy || !enemy.alive || !enemy.body.enable) return;
    enemy.dir = intent.dir;
    enemy.body.setVelocityX(intent.targetVx);
    if (enemy.fly) enemy.body.setVelocityY(intent.flyerVy);
  }

  private resolveCollisions(): void {
    const world = this.world;

    world.collide(this.playerBody, this.layer);
    for (const enemy of this.enemies) {
      // Flyers cross tiles and turn by the rules probe, like the old flyer did.
      if (!enemy.alive || enemy.fly) continue;
      world.collide(enemy.body, this.layer);
    }

    for (const [id, body] of this.bullets) {
      if (!body.enable) continue;
      // The bullet dies on the tile it actually touches, on any face: a solid
      // floor or ceiling stops it exactly like a wall. One-way platforms are
      // filtered out by `stopsBullet`, so the shot still passes through them.
      let hitWall = false;
      world.collide(
        body,
        this.layer,
        () => {
          if (hitWall) return;
          hitWall = true;
          this.events.push({ type: "bulletHitWall", bulletId: id });
        },
        (_bullet: unknown, tile: unknown) => this.stopsBullet(tile as Phaser.Tilemaps.Tile),
      );
      for (const enemy of this.enemies) {
        if (!enemy.alive || !enemy.body.enable) continue;
        if (world.overlap(body, enemy.body)) {
          this.events.push({ type: "bulletHitEnemy", bulletId: id, enemyId: enemy.id });
        }
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.body.enable) continue;
      if (world.overlap(this.playerBody, enemy.body)) {
        this.events.push({ type: "playerTouchedEnemy", enemyId: enemy.id });
      }
    }
  }

  private enemySnapshot(enemy: EnemyBody): EnemySnapshot {
    const body = enemy.body;
    return {
      id: enemy.id,
      x: body.x,
      y: body.y,
      w: body.width,
      h: body.height,
      vx: body.velocity.x,
      vy: body.velocity.y,
      onGround: body.blocked.down,
      blocked: sides(body),
      dir: enemy.dir,
      alive: enemy.alive,
      sprite: enemy.sprite,
    };
  }

  private createBody(
    x: number,
    y: number,
    w: number,
    h: number,
    gravity: boolean,
    bounded: boolean,
  ): Phaser.Physics.Arcade.Body {
    const body = this.scene.physics.add.body(x, y, w, h);
    body.setAllowGravity(gravity);
    body.setCollideWorldBounds(bounded);
    body.setMaxVelocity(RUN_SPEED, MAX_FALL);
    return body;
  }

  private spawnBullet(bullet: BulletSpawn): void {
    const body = this.scene.physics.add.body(bullet.x, bullet.y, BULLET_W, BULLET_H);
    body.setAllowGravity(false);
    body.setCollideWorldBounds(false);
    body.setVelocity(bullet.vx, bullet.vy);
    this.bullets.set(bullet.id, body);
  }

  private removeBullet(id: number): void {
    const body = this.bullets.get(id);
    if (!body) return;
    this.bullets.delete(id);
    body.destroy();
  }

  private removeEnemy(id: number): void {
    const enemy = this.enemies.find((candidate) => candidate.id === id);
    if (!enemy || !enemy.alive) return;
    enemy.alive = false;
    enemy.body.destroy();
  }

  /** A bullet dies on a tile that blocks left/right, never on a one-way platform. */
  private stopsBullet(tile: Phaser.Tilemaps.Tile): boolean {
    if (tile.index < 0) return false;
    const index = tile.index & TILE_FLAG_MASK;
    if (index >= this.info.count) return false;
    return this.info.blockLeft[index] !== 0 || this.info.blockRight[index] !== 0;
  }

  /** Directional tilemap collision: `tileinfo.json` flags map to tile faces. */
  private setTileCollisions(): void {
    this.layer.forEachTile((tile) => this.setTileCollision(tile));
    this.layer.calculateFacesWithin(0, 0, this.layer.width, this.layer.height);
  }

  private setTileCollision(tile: Phaser.Tilemaps.Tile): void {
    if (tile.index < 0) {
      tile.setCollision(false, false, false, false, false);
      return;
    }
    const index = tile.index & TILE_FLAG_MASK;
    if (index >= this.info.count) {
      tile.setCollision(false, false, false, false, false);
      return;
    }
    // `blockRight` stops a body moving right, i.e. the tile's left face, etc.
    tile.setCollision(
      this.info.blockRight[index] !== 0,
      this.info.blockLeft[index] !== 0,
      this.info.blockDown[index] !== 0,
      this.info.blockUp[index] !== 0,
      false,
    );
  }
}

function sides(body: Phaser.Physics.Arcade.Body): BlockedSides {
  return {
    left: body.blocked.left,
    right: body.blocked.right,
    up: body.blocked.up,
    down: body.blocked.down,
  };
}
