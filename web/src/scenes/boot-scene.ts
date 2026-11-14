import Phaser from "phaser";
import {
  LEVEL_COUNT,
  SPRITE_H,
  SPRITE_NAMES,
  SPRITE_W,
  TILE_TEXTURE,
  TITLE_TEXTURE,
  type Assets,
  type LevelData,
  type TileInfoData,
} from "../assets";

/** Loads every asset through the Phaser loader, then hands them to the game scene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    const base = "assets/";
    this.load.image(TILE_TEXTURE, `${base}tiles.png`);
    this.load.image(TITLE_TEXTURE, `${base}title1.png`);
    this.load.json("tileinfo", `${base}tileinfo.json`);

    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const file = String(i).padStart(2, "0");
      this.load.json(`level${i}`, `${base}levels/${file}.json`);
    }

    for (const name of SPRITE_NAMES) {
      this.load.spritesheet(name, `${base}sprites/s_${name}.png`, {
        frameWidth: SPRITE_W,
        frameHeight: SPRITE_H,
      });
    }
  }

  create(): void {
    const tileInfo = this.cache.json.get("tileinfo") as TileInfoData | undefined;
    if (!tileInfo) throw new Error("tileinfo.json was not loaded");

    const levels: LevelData[] = [];
    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const level = this.cache.json.get(`level${i}`) as LevelData | undefined;
      if (!level) throw new Error(`level ${i} was not loaded`);
      levels.push(level);
    }

    const assets: Assets = { tileInfo, levels };
    this.scene.start("game", { assets });
  }
}
