import Phaser from "phaser";
import {
  BULLET_TEXTURE,
  SCREEN_H,
  SCREEN_W,
  TILE,
  TILE_TEXTURE,
  TITLE_TEXTURE,
} from "./assets";
import type { Enemy, Game, Player } from "./game";

interface FrameRef {
  key: string;
  frame: number;
}

const HUD_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: "#ffff55",
  padding: { x: 1, y: 1 },
};

/**
 * Phaser side of the game: owns every visible object and only reads the state
 * produced by game.ts. All positions come from the fixed-step simulation.
 */
export class PhaserView {
  private readonly scene: Phaser.Scene;
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private readonly title: Phaser.GameObjects.Image;
  private hudBg: Phaser.GameObjects.Rectangle | null = null;
  private hudText: Phaser.GameObjects.Text | null = null;
  private hudAmmo: Phaser.GameObjects.Text | null = null;
  private readonly messageTitle: Phaser.GameObjects.Text;
  private readonly messageSub: Phaser.GameObjects.Text;
  private readonly playerSprite: Phaser.GameObjects.Sprite;
  private readonly enemySprites: Phaser.GameObjects.Sprite[] = [];
  private readonly bulletSprites: Phaser.GameObjects.Image[] = [];
  private readonly chunk1Frames: number;
  private readonly enemyFrameCount: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.chunk1Frames = this.frameCount("chunk1");
    this.enemyFrameCount = this.chunk1Frames + this.frameCount("chunk2");

    this.title = scene.add
      .image(0, 0, TITLE_TEXTURE)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(50);

    this.messageTitle = scene.add
      .text(SCREEN_W / 2, SCREEN_H / 2 - 14, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffff55",
        align: "center",
        padding: { x: 2, y: 2 },
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    this.messageSub = scene.add
      .text(SCREEN_W / 2, SCREEN_H / 2 + 14, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ffffff",
        align: "center",
        padding: { x: 2, y: 2 },
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    this.playerSprite = scene.add
      .sprite(0, 0, "hero", 0)
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setVisible(false);

    this.createBulletTexture();
  }

  showTitle(): void {
    this.title.setVisible(true);
  }

  hideTitle(): void {
    this.title.setVisible(false);
  }

  showMessage(title: string, subtitle: string): void {
    this.messageTitle.setText(title).setVisible(true);
    this.messageSub.setText(subtitle).setVisible(true);
  }

  hideMessage(): void {
    this.messageTitle.setVisible(false);
    this.messageSub.setVisible(false);
  }

  /** Rebuild the tilemap and HUD for a freshly created level. */
  buildLevel(game: Game): void {
    this.layer?.destroy();
    this.map?.destroy();

    const level = game.level;
    const data: number[][] = [];
    for (let ty = 0; ty < level.height; ty++) {
      const row: number[] = [];
      for (let tx = 0; tx < level.width; tx++) {
        const index = level.tileAt(tx, ty);
        row.push(index > 0 ? index : -1);
      }
      data.push(row);
    }

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE,
      tileHeight: TILE,
    });
    const tileset = map.addTilesetImage("tiles", TILE_TEXTURE, TILE, TILE, 0, 0);
    if (!tileset) throw new Error("failed to bind the tileset");
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error("failed to create the tilemap layer");

    layer.setDepth(0);
    this.map = map;
    this.layer = layer as Phaser.Tilemaps.TilemapLayer;

    if (!this.hudBg) {
      this.hudBg = this.scene.add
        .rectangle(0, 0, 132, 21, 0x000000, 0.7)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(100);
      this.hudText = this.scene.add
        .text(3, 2, "", HUD_STYLE)
        .setScrollFactor(0)
        .setDepth(101);
      this.hudAmmo = this.scene.add
        .text(3, 11, "", { ...HUD_STYLE, color: "#55ffff" })
        .setScrollFactor(0)
        .setDepth(101);
    }
  }

  /** Redraw only the changed tiles in the live tilemap layer. */
  patchTiles(patches: { x: number; y: number; index: number }[]): void {
    if (!this.layer) return;
    for (const patch of patches) {
      if (patch.index > 0) this.layer.putTileAt(patch.index, patch.x, patch.y);
      else this.layer.removeTileAt(patch.x, patch.y);
    }
  }

  render(game: Game, levelIndex: number): void {
    this.scene.cameras.main.setScroll(game.cameraX, game.cameraY);

    this.drawPlayer(game.player, game.tick);
    this.drawEnemies(game.enemies, game.tick);
    this.drawBullets(game);

    if (this.hudText && this.hudAmmo) {
      this.hudText.setText(`LVL ${levelIndex + 1}/8   LIVES ${game.lives}`);
      this.hudAmmo.setText(`AMMO ${game.player.ammo}   SCORE ${game.score}`);
    }
  }

  private drawPlayer(player: Player, tick: number): void {
    const frames = this.frameCount("hero");
    if (frames === 0) return;

    let index = 0;
    if (!player.onGround) index = Math.min(13, frames - 1);
    else if (Math.abs(player.vx) > 8) index = 1 + (Math.floor(tick / 5) % 6);

    this.playerSprite
      .setTexture("hero", Math.min(index, frames - 1))
      .setFlipX(player.facing > 0)
      .setPosition(
        Math.round(player.x + player.w / 2),
        Math.round(player.y + player.h),
      )
      .setVisible(true);
  }

  private drawEnemies(enemies: Enemy[], tick: number): void {
    while (this.enemySprites.length < enemies.length) {
      this.enemySprites.push(
        this.scene.add
          .sprite(0, 0, "chunk1", 0)
          .setOrigin(0.5, 1)
          .setDepth(11)
          .setVisible(false),
      );
    }

    for (let i = 0; i < this.enemySprites.length; i++) {
      const sprite = this.enemySprites[i];
      const enemy = enemies[i];
      if (!enemy || !enemy.alive || this.enemyFrameCount === 0) {
        sprite.setVisible(false);
        continue;
      }

      // Each enemy type is a 5-frame animation group inside the sprite bank.
      const group = Math.max(0, enemy.sprite - 2);
      const base = group * 5;
      const index = Math.min(
        this.enemyFrameCount - 1,
        base + (Math.floor(tick / 8) % 5),
      );
      const frame = this.enemyFrame(index);

      sprite
        .setTexture(frame.key, frame.frame)
        .setFlipX(enemy.dir > 0)
        .setPosition(Math.round(enemy.x + enemy.w / 2), Math.round(enemy.y + enemy.h))
        .setVisible(true);
    }
  }

  private drawBullets(game: Game): void {
    while (this.bulletSprites.length < game.bullets.length) {
      this.bulletSprites.push(
        this.scene.add
          .image(0, 0, BULLET_TEXTURE)
          .setDepth(10)
          .setVisible(false),
      );
    }

    for (let i = 0; i < this.bulletSprites.length; i++) {
      const sprite = this.bulletSprites[i];
      const bullet = game.bullets[i];
      if (!bullet) {
        sprite.setVisible(false);
        continue;
      }
      sprite
        .setPosition(Math.round(bullet.x), Math.round(bullet.y))
        .setVisible(true);
    }
  }

  private createBulletTexture(): void {
    if (this.scene.textures.exists(BULLET_TEXTURE)) return;
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xffff55, 1);
    graphics.fillRect(0, 0, 3, 1);
    graphics.generateTexture(BULLET_TEXTURE, 3, 1);
    graphics.destroy();
  }

  private enemyFrame(index: number): FrameRef {
    if (index < this.chunk1Frames) return { key: "chunk1", frame: index };
    return { key: "chunk2", frame: index - this.chunk1Frames };
  }

  private frameCount(key: string): number {
    // Phaser adds a `__BASE` frame to every texture, so subtract it.
    return Math.max(0, this.scene.textures.get(key).frameTotal - 1);
  }
}
