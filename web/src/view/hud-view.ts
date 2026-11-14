import Phaser from "phaser";
import type { Game } from "../game";

const HUD_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: "#ffff55",
  padding: { x: 1, y: 1 },
};

/** Level, lives, ammo and score readout in the top-left corner. */
export class HudView {
  private readonly scene: Phaser.Scene;
  private hudBg: Phaser.GameObjects.Rectangle | null = null;
  private hudText: Phaser.GameObjects.Text | null = null;
  private hudAmmo: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Creates the HUD objects once, on the first level build. */
  ensureCreated(): void {
    if (this.hudBg) return;
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

  render(game: Game, levelIndex: number): void {
    if (this.hudText && this.hudAmmo) {
      this.hudText.setText(`LVL ${levelIndex + 1}/8   LIVES ${game.lives}`);
      this.hudAmmo.setText(`AMMO ${game.player.ammo}   SCORE ${game.score}`);
    }
  }
}
