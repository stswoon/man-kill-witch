import Phaser from "phaser";
import { BULLET_TEXTURE } from "../assets";
import type { Bullet, Enemy, Player } from "../game";

interface FrameRef {
  key: string;
  frame: number;
}

/** Player, enemy and bullet sprites; frames are picked from the fixed-step tick. */
export class CharacterView {
  private readonly scene: Phaser.Scene;
  private readonly playerSprite: Phaser.GameObjects.Sprite;
  private readonly enemySprites: Phaser.GameObjects.Sprite[] = [];
  private readonly bulletSprites: Phaser.GameObjects.Image[] = [];
  private readonly chunk1Frames: number;
  private readonly enemyFrameCount: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.chunk1Frames = this.frameCount("chunk1");
    this.enemyFrameCount = this.chunk1Frames + this.frameCount("chunk2");

    this.playerSprite = scene.add
      .sprite(0, 0, "hero", 0)
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setVisible(false);

    this.createBulletTexture();
  }

  render(player: Player, enemies: Enemy[], bullets: Bullet[], tick: number): void {
    this.drawPlayer(player, tick);
    this.drawEnemies(enemies, tick);
    this.drawBullets(bullets);
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

  private drawBullets(bullets: Bullet[]): void {
    while (this.bulletSprites.length < bullets.length) {
      this.bulletSprites.push(
        this.scene.add
          .image(0, 0, BULLET_TEXTURE)
          .setDepth(10)
          .setVisible(false),
      );
    }

    for (let i = 0; i < this.bulletSprites.length; i++) {
      const sprite = this.bulletSprites[i];
      const bullet = bullets[i];
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
