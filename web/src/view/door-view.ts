import Phaser from "phaser";
import { registerAnimations } from "../animations";
import { DOOR_TEXTURE, TILE } from "../assets";
import type { DoorState } from "../game";

/** Above the tilemap (0), behind bullets (10) and the characters (11-12). */
const DOOR_DEPTH = 5;

/**
 * `s_door.png` drawn over the cleared 2x3 tile block. The view only reads
 * `Game.door`: the simulation owns the trigger and the 15-tick timeline.
 */
export class DoorView {
  private readonly sprite: Phaser.GameObjects.Sprite;
  /** Trigger tile of the door the opening was started for; keeps it single-shot. */
  private triggerTx = -1;
  private triggerTy = -1;

  constructor(scene: Phaser.Scene) {
    registerAnimations(scene);
    this.sprite = scene.add
      .sprite(0, 0, DOOR_TEXTURE, 0)
      .setOrigin(0, 0)
      .setDepth(DOOR_DEPTH)
      .setVisible(false);
  }

  render(door: DoorState | null): void {
    if (!door) {
      this.hide();
      return;
    }

    this.sprite
      .setPosition((door.tx - 1) * TILE, (door.ty - 1) * TILE)
      .setVisible(true);

    if (door.tx === this.triggerTx && door.ty === this.triggerTy) return;
    this.triggerTx = door.tx;
    this.triggerTy = door.ty;
    this.sprite.play("door-open", true);
  }

  /** Hides the sprite on level completion and on every level change. */
  hide(): void {
    this.triggerTx = -1;
    this.triggerTy = -1;
    this.sprite.setVisible(false);
    if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
  }
}
