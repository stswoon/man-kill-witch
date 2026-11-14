import {
  Application,
  Container,
  Graphics,
  Rectangle,
  RenderTexture,
  Sprite,
  Text,
  Texture,
  TextureSource,
} from "pixi.js";
import { Assets, SCREEN_H, SCREEN_W, TILE, TILES_W, type SpriteAtlas } from "./assets";
import { Enemy, Game, Player, TilePatch } from "./game";

export class PixiRenderer {
  readonly app = new Application();
  private world = new Container();
  private levelSprite: Sprite | null = null;
  private entityLayer = new Container();
  private hudText!: Text;
  private hudAmmo!: Text;
  private titleSprite: Sprite | null = null;
  private messageLayer = new Container();
  private messageTitle!: Text;
  private messageSub!: Text;
  private enemyTex!: Texture;
  private bulletLayer = new Container();
  private tileTextures: Texture[] = [];

  async init(mount: HTMLElement): Promise<void> {
    TextureSource.defaultOptions.scaleMode = "nearest";
    await this.app.init({
      width: SCREEN_W,
      height: SCREEN_H,
      background: 0x000000,
      antialias: false,
      resolution: 1,
      autoDensity: false,
      preference: "webgl",
    });
    mount.appendChild(this.app.canvas);
    this.app.canvas.id = "screen";
    this.app.stage.addChild(this.world);
    this.world.addChild(this.entityLayer);
    this.world.addChild(this.bulletLayer);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private heroFrames: Texture[] = [];
  private enemyFrames: Texture[] = [];

  async loadTextures(assets: Assets): Promise<void> {
    const base = Texture.from(assets.tiles);
    this.tileTextures = [];
    for (let i = 0; i < 32 * 28; i++) {
      const sx = (i % TILES_W) * TILE;
      const sy = Math.floor(i / TILES_W) * TILE;
      if (sy >= assets.tiles.height) break;
      this.tileTextures.push(new Texture({ source: base.source, frame: new Rectangle(sx, sy, TILE, TILE) }));
    }

    this.heroFrames = this.buildSpriteFrames(assets.sprites.hero);
    this.enemyFrames = this.buildSpriteFrames(assets.sprites.chunk1);
    this.enemyFrames.push(...this.buildSpriteFrames(assets.sprites.chunk2));
  }

  private buildSpriteFrames(atlas: SpriteAtlas | undefined): Texture[] {
    if (!atlas) return [];
    const base = Texture.from(atlas.image);
    const frames: Texture[] = [];
    for (let i = 0; i < atlas.count; i++) {
      const sx = (i % atlas.cols) * atlas.cellW;
      const sy = Math.floor(i / atlas.cols) * atlas.cellH;
      if (sy + atlas.cellH > atlas.image.height) break;
      frames.push(new Texture({
        source: base.source,
        frame: new Rectangle(sx, sy, atlas.cellW, atlas.cellH),
      }));
    }
    return frames;
  }

  setTitle(assets: Assets): void {
    if (this.titleSprite) this.titleSprite.destroy();
    this.titleSprite = new Sprite(Texture.from(assets.title));
    this.app.stage.addChild(this.titleSprite);
  }

  clearTitle(): void {
    this.titleSprite?.destroy();
    this.titleSprite = null;
  }

  showMessage(title: string, subtitle: string): void {
    if (!this.messageTitle) {
      this.messageTitle = new Text({
        text: "",
        style: { fontFamily: "monospace", fontSize: 16, fill: 0xffff55, align: "center", padding: 2 },
      });
      this.messageSub = new Text({
        text: "",
        style: { fontFamily: "monospace", fontSize: 8, fill: 0xffffff, align: "center", padding: 2 },
      });
      this.messageTitle.anchor.set(0.5, 0.5);
      this.messageSub.anchor.set(0.5, 0.5);
      this.messageTitle.x = SCREEN_W / 2;
      this.messageTitle.y = SCREEN_H / 2 - 14;
      this.messageSub.x = SCREEN_W / 2;
      this.messageSub.y = SCREEN_H / 2 + 14;
      this.messageLayer.addChild(this.messageTitle, this.messageSub);
      this.app.stage.addChild(this.messageLayer);
    }
    this.messageLayer.visible = true;
    this.messageTitle.text = title;
    this.messageSub.text = subtitle;
  }

  hideMessage(): void {
    if (this.messageLayer) this.messageLayer.visible = false;
  }

  resize(): void {
    const scale = Math.max(1, Math.min(
      Math.floor(window.innerWidth / SCREEN_W),
      Math.floor(window.innerHeight / SCREEN_H),
    ));
    this.app.renderer.resize(SCREEN_W, SCREEN_H);
    this.app.canvas.style.width = `${SCREEN_W * scale}px`;
    this.app.canvas.style.height = `${SCREEN_H * scale}px`;
    this.app.canvas.style.position = "absolute";
    this.app.canvas.style.inset = "0";
    this.app.canvas.style.margin = "auto";
    this.app.canvas.style.imageRendering = "pixelated";
  }

  /** Rasterise the whole level once into a RenderTexture. */
  buildLevel(game: Game): void {
    const level = game.level;
    const rt = RenderTexture.create({
      width: level.pixelWidth,
      height: level.pixelHeight,
      scaleMode: "nearest",
    });
    const tmp = new Container();
    for (let ty = 0; ty < level.height; ty++) {
      for (let tx = 0; tx < level.width; tx++) {
        const index = level.tileAt(tx, ty);
        if (index <= 0) continue;
        const tex = this.tileTextures[index];
        if (!tex) continue;
        const s = new Sprite(tex);
        s.x = tx * TILE;
        s.y = ty * TILE;
        tmp.addChild(s);
      }
    }
    this.app.renderer.render({ container: tmp, target: rt, clear: true });
    tmp.destroy({ children: true });

    if (this.levelSprite) {
      const old = this.levelSprite;
      const oldTexture = old.texture;
      this.world.removeChild(old);
      old.destroy();
      oldTexture?.destroy(true);
    }
    this.levelSprite = new Sprite(rt);
    this.world.addChildAt(this.levelSprite, 0);

    if (!this.hudText) {
      const bg = new Graphics().rect(0, 0, 132, 21).fill({ color: 0x000000, alpha: 0.7 });
      bg.zIndex = 0;
      this.hudText = new Text({
        text: "",
        style: { fontFamily: "monospace", fontSize: 8, fill: 0xffff55, padding: 1 },
      });
      this.hudAmmo = new Text({
        text: "",
        style: { fontFamily: "monospace", fontSize: 8, fill: 0x55ffff, padding: 1 },
      });
      this.hudText.x = 3; this.hudText.y = 2;
      this.hudAmmo.x = 3; this.hudAmmo.y = 11;
      this.app.stage.addChild(bg, this.hudText, this.hudAmmo);
    }
  }

  /** Redraw only the changed tiles into the baked level texture. */
  patchTiles(patches: TilePatch[]): void {
    if (!this.levelSprite || patches.length === 0) return;
    const rt = this.levelSprite.texture as RenderTexture;
    const tmp = new Container();
    for (const p of patches) {
      const tex = this.tileTextures[p.index];
      if (tex) {
        const s = new Sprite(tex);
        s.x = p.x * TILE;
        s.y = p.y * TILE;
        tmp.addChild(s);
      } else {
        const g = new Graphics().rect(p.x * TILE, p.y * TILE, TILE, TILE).fill(0x000000);
        tmp.addChild(g);
      }
    }
    this.app.renderer.render({ container: tmp, target: rt, clear: false });
    tmp.destroy({ children: true });
  }

  render(game: Game, levelIndex: number): void {
    this.world.x = -game.cameraX;
    this.world.y = -game.cameraY;

    this.drawPlayer(game.player, game.tick);
    this.drawEnemies(game.enemies, game.tick);
    this.drawBullets(game);

    if (this.hudText) {
      this.hudText.text = `LVL ${levelIndex + 1}/8   LIVES ${game.lives}`;
      this.hudAmmo.text = `AMMO ${game.player.ammo}   SCORE ${game.score}`;
    }
  }

  private playerSprite: Sprite | null = null;
  private drawPlayer(player: Player, tick: number): void {
    if (!this.playerSprite) {
      this.playerSprite = new Sprite();
      this.entityLayer.addChild(this.playerSprite);
    }
    const frames = this.heroFrames;
    if (frames.length) {
      let idx = 0;
      if (!player.onGround) idx = Math.min(13, frames.length - 1);
      else if (Math.abs(player.vx) > 8) idx = 1 + (Math.floor(tick / 5) % 6);
      this.playerSprite.texture = frames[Math.min(idx, frames.length - 1)];
    }
    const w = 24, h = 24;
    this.playerSprite.anchor.set(0.5, 1);
    // Hero frames face left, so mirror when running right.
    this.playerSprite.scale.x = player.facing > 0 ? -1 : 1;
    this.playerSprite.x = Math.round(player.x + player.w / 2);
    this.playerSprite.y = Math.round(player.y + player.h);
    void w; void h;
  }

  private enemySprites: Sprite[] = [];
  private drawEnemies(enemies: Enemy[], tick: number): void {
    while (this.enemySprites.length < enemies.length) {
      const s = new Sprite();
      this.enemySprites.push(s);
      this.entityLayer.addChild(s);
    }
    for (let i = 0; i < this.enemySprites.length; i++) {
      const s = this.enemySprites[i];
      const e = enemies[i];
      if (!e || !e.alive || this.enemyFrames.length === 0) { s.visible = false; continue; }
      s.visible = true;
      // Each enemy type is a 5-frame animation group inside the bank.
      const group = Math.max(0, e.sprite - 2);
      const base = group * 5;
      const idx = Math.min(this.enemyFrames.length - 1, base + (Math.floor(tick / 8) % 5));
      s.texture = this.enemyFrames[idx];
      s.anchor.set(0.5, 1);
      s.scale.x = e.dir > 0 ? -1 : 1;
      s.x = Math.round(e.x + e.w / 2);
      s.y = Math.round(e.y + e.h);
    }
  }

  private bulletSprites: Sprite[] = [];
  private drawBullets(game: Game): void {
    while (this.bulletSprites.length < game.bullets.length) {
      const g = new Graphics().rect(0, 0, 3, 1).fill(0xffff55);
      const s = new Sprite(this.app.renderer.generateTexture(g));
      g.destroy();
      this.bulletSprites.push(s);
      this.bulletLayer.addChild(s);
    }
    for (let i = 0; i < this.bulletSprites.length; i++) {
      const s = this.bulletSprites[i];
      const b = game.bullets[i];
      if (!b) { s.visible = false; continue; }
      s.visible = true;
      s.position.set(Math.round(b.x), Math.round(b.y));
    }
  }

  destroy(): void {
    this.app.destroy(true);
  }
}
