import Phaser from "phaser";
import { BACKDROP_COLOR, SCREEN_H, SCREEN_W } from "./assets";
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
  backgroundColor: BACKDROP_COLOR,
  banner: false,
  audio: { noAudio: true },
  render: { antialias: true, pixelArt: false },
  scale: {
    mode: Phaser.Scale.NONE,
    width: SCREEN_W,
    height: SCREEN_H,
    expandParent: false,
  },
  scene: [BootScene, GameScene],
});

game.canvas.id = "screen";

function resize(): void {
  const scale = Math.max(0.1, Math.min(
    window.innerWidth / SCREEN_W,
    window.innerHeight / SCREEN_H,
  ));
  game.canvas.style.width = `${SCREEN_W * scale}px`;
  game.canvas.style.height = `${SCREEN_H * scale}px`;
  game.canvas.style.position = "absolute";
  game.canvas.style.inset = "0";
  game.canvas.style.margin = "auto";
}

window.addEventListener("resize", resize);
resize();
