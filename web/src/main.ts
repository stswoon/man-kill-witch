import { loadAssets, TILE } from "./assets";
import { Game, Level } from "./game";
import { Input } from "./input";
import { PixiRenderer } from "./pixi-render";
import { Sfx } from "./sfx";

const DT = 1 / 70;

type State = "title" | "play" | "gameover" | "win";

async function boot(): Promise<void> {
  const input = new Input();
  const assets = await loadAssets();
  const sfx = new Sfx();

  const renderer = new PixiRenderer();
  await renderer.init(document.body);
  await renderer.loadTextures(assets);
  renderer.setTitle(assets);

  let state: State = "title";
  let levelIndex = 0;
  let game = new Game(new Level(assets.levels[levelIndex], assets.tileInfo));
  let stateTimer = 0;

  function startLevel(index: number): void {
    levelIndex = Math.max(0, Math.min(assets.levels.length - 1, index));
    game = new Game(new Level(assets.levels[levelIndex], assets.tileInfo));
    renderer.buildLevel(game);
    renderer.clearTitle();
    renderer.hideMessage();
    state = "play";
    stateTimer = 0;
  }

  function setState(next: State, title: string, subtitle: string): void {
    state = next;
    stateTimer = 0;
    renderer.showMessage(title, subtitle);
  }

  function step(dt: number): void {
    stateTimer++;

    if (state === "title") {
      if (input.wasPressed("Space", "Enter")) startLevel(0);
      return;
    }
    if (state === "gameover" || state === "win") {
      if (stateTimer > 30 && input.wasPressed("Space", "Enter")) {
        if (state === "win") startLevel(0);
        else startLevel(levelIndex);
      }
      return;
    }

    const prevAmmo = game.player.ammo;
    const prevScore = game.score;
    const prevLives = game.lives;
    game.update(dt, input);

    if (game.player.ammo < prevAmmo) sfx.shoot();
    if (game.score > prevScore) sfx.hit();
    if (game.lives < prevLives) {
      if (game.gameOver) {
        sfx.die();
        setState("gameover", "GAME OVER", "PRESS SPACE");
        return;
      }
      sfx.die();
    }

    for (let i = 1; i <= 8; i++) {
      if (input.wasPressed(`Digit${i}`)) startLevel(i - 1);
    }

    if (game.tilePatches.length) {
      renderer.patchTiles(game.tilePatches);
      game.tilePatches.length = 0;
    }

    if (game.levelComplete) {
      if (levelIndex < assets.levels.length - 1) {
        sfx.door();
        startLevel(levelIndex + 1);
      } else if (state === "play") {
        sfx.win();
        setState("win", "CONGRATULATIONS!", "THE WITCH IS GONE — PRESS SPACE");
      }
    }
  }

  let acc = 0;
  let last = performance.now();
  function frame(now: number): void {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += elapsed;
    let guard = 0;
    while (acc >= DT && guard++ < 8) {
      step(DT);
      acc -= DT;
    }
    if (state !== "title") renderer.render(game, levelIndex);
    input.endFrame();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  (window as unknown as { mkw: unknown }).mkw = {
    assets,
    game: () => game,
    startLevel,
    renderer,
    step,
    getState: () => state,
  };
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="color:#f55;font:12px monospace;position:absolute;top:8px;left:8px;z-index:9">${String(err)}</pre>`,
  );
});
