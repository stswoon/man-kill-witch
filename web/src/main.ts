import Phaser from "phaser";
import { SCREEN_H, SCREEN_W } from "./assets";
import { BootScene } from "./scenes/boot-scene";
import { GameScene } from "./scenes/game-scene";

function showError(error: unknown): void {
  console.error(error);
  const pre = document.createElement("pre");
  pre.style.cssText =
    "color:#f55;font:12px monospace;position:absolute;top:8px;left:8px;z-index:9;white-space:pre-wrap";
  pre.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  document.body.appendChild(pre);
}

window.addEventListener("error", (event) => showError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => showError(event.reason));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: SCREEN_W,
  height: SCREEN_H,
  backgroundColor: 0x000000,
  pixelArt: true,
  banner: false,
  audio: { noAudio: true },
  scale: {
    mode: Phaser.Scale.NONE,
    width: SCREEN_W,
    height: SCREEN_H,
    expandParent: false,
  },
  scene: [BootScene, GameScene],
});

game.canvas.id = "screen";
game.canvas.style.imageRendering = "pixelated";

function resize(): void {
  const scale = Math.max(1, Math.min(
    Math.floor(window.innerWidth / SCREEN_W),
    Math.floor(window.innerHeight / SCREEN_H),
  ));
  game.canvas.style.width = `${SCREEN_W * scale}px`;
  game.canvas.style.height = `${SCREEN_H * scale}px`;
  game.canvas.style.position = "absolute";
  game.canvas.style.inset = "0";
  game.canvas.style.margin = "auto";
}

window.addEventListener("resize", resize);
resize();
