import Phaser from "phaser";
import { HUD_FONT, HUD_TEXTURE } from "../assets";
import type { Game } from "../game";

/** Both readout lines start 20 px inside the 680x120 panel, 50 px apart. */
const TEXT_LEFT = 20;
const TEXT_TOP = 15;
const TEXT_BOTTOM = 65;

/** Level, lives, ammo and score readout over the HD HUD panel. */
export class HudView {
  private readonly scene: Phaser.Scene;
  private panel: Phaser.GameObjects.Image | null = null;
  private hudText: Phaser.GameObjects.BitmapText | null = null;
  private hudAmmo: Phaser.GameObjects.BitmapText | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Creates the HUD objects once, on the first level build. */
  ensureCreated(): void {
    if (this.panel) return;
    this.panel = this.scene.add
      .image(0, 0, HUD_TEXTURE)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.hudText = this.scene.add
      .bitmapText(TEXT_LEFT, TEXT_TOP, HUD_FONT, "")
      .setScrollFactor(0)
      .setDepth(101);
    this.hudAmmo = this.scene.add
      .bitmapText(TEXT_LEFT, TEXT_BOTTOM, HUD_FONT, "")
      .setScrollFactor(0)
      .setDepth(101);
  }

  render(game: Game, levelIndex: number): void {
    if (this.hudText && this.hudAmmo) {
      this.hudText.setText(`LVL ${levelIndex + 1}/8   LIVES ${game.lives}`);
      this.hudAmmo.setText(`AMMO ${game.player.ammo}   SCORE ${game.score}`);
    }
  }
}
