import Phaser from "phaser";
import { registerAnimations } from "../animations";
import { BULLET_TEXTURE } from "../assets";
import type {
  BulletSnapshot,
  EnemySnapshot,
  PlayerSnapshot,
  WorldSnapshot,
} from "../sim-contract";

/** Enemy sprite ids 2-8 live in `chunk1`, 9-12 in `chunk2` (05-animation.md). */
function enemyTexture(sprite: number): string {
  return sprite <= 8 ? "chunk1" : "chunk2";
}

/** Player, enemy and bullet sprites; frames come from the Phaser AnimationManager. */
export class CharacterView {
  private readonly scene: Phaser.Scene;
  private readonly playerSprite: Phaser.GameObjects.Sprite;
  private readonly enemySprites: Phaser.GameObjects.Sprite[] = [];
  private readonly bulletSprites: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    registerAnimations(scene);

    this.playerSprite = scene.add
      .sprite(0, 0, "hero", 0)
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setVisible(false);

    this.createBulletTexture();
  }

  render(snapshot: WorldSnapshot): void {
    this.drawPlayer(snapshot.player);
    this.drawEnemies(snapshot.enemies);
    this.drawBullets(snapshot.bullets);
  }

  private drawPlayer(player: PlayerSnapshot): void {
    let animation = "hero-idle";
    if (!player.onGround) animation = "hero-jump";
    else if (Math.abs(player.vx) > 40) animation = "hero-run";

    // `play(key, true)` keeps a running animation going instead of restarting it every frame.
    this.playerSprite
      .setFlipX(player.dir > 0)
      .setPosition(
        Math.round(player.x + player.w / 2),
        Math.round(player.y + player.h),
      )
      .setVisible(true)
      .play(animation, true);
  }

  private drawEnemies(enemies: EnemySnapshot[]): void {
    while (this.enemySprites.length < enemies.length) {
      const enemy = enemies[this.enemySprites.length];
      this.enemySprites.push(
        this.scene.add
          .sprite(0, 0, enemyTexture(enemy.sprite), 0)
          .setOrigin(0.5, 1)
          .setDepth(11)
          .setVisible(false),
      );
    }

    for (let i = 0; i < this.enemySprites.length; i++) {
      const sprite = this.enemySprites[i];
      const enemy = enemies[i];
      if (!enemy || !enemy.alive) {
        sprite.setVisible(false);
        if (sprite.anims.isPlaying) sprite.anims.stop();
        continue;
      }

      sprite
        .setFlipX(enemy.dir > 0)
        .setPosition(Math.round(enemy.x + enemy.w / 2), Math.round(enemy.y + enemy.h))
        .setVisible(true)
        .play(`enemy-${enemy.sprite}`, true);
    }
  }

  private drawBullets(bullets: BulletSnapshot[]): void {
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
    graphics.fillRect(0, 0, 15, 5);
    graphics.generateTexture(BULLET_TEXTURE, 15, 5);
    graphics.destroy();
  }
}
