import Phaser from "phaser";
import { SCREEN_H, SCREEN_W, TITLE_TEXTURE } from "../assets";

/** Title screen image and the centered title/subtitle message pair. */
export class MessageView {
  private readonly title: Phaser.GameObjects.Image;
  private readonly messageTitle: Phaser.GameObjects.Text;
  private readonly messageSub: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
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
}
