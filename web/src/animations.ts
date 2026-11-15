import type Phaser from "phaser";
import { ANIMATIONS } from "./animation-catalog";

/**
 * Registers the animation catalog on the scene's AnimationManager.
 *
 * Phaser warns when a key is created twice, and the manager survives scene
 * restarts, so an already registered key is skipped instead of recreated.
 */
export function registerAnimations(scene: Phaser.Scene): void {
  for (const animation of ANIMATIONS) {
    if (scene.anims.exists(animation.key)) continue;

    scene.anims.create({
      key: animation.key,
      frames: scene.anims.generateFrameNumbers(animation.texture, {
        start: animation.start,
        end: animation.end,
      }),
      frameRate: animation.frameRate,
      repeat: animation.repeat,
    });
  }
}
