// Full HD render on a 384x216 reference grid: one grid unit is 5 screen px,
// a tile is 16 units and a sprite frame is 24x32 units.
export const TILE = 80;
export const SCREEN_W = 1920;
export const SCREEN_H = 1080;
export const SPRITE_W = 120;
export const SPRITE_H = 160;

export const TILE_TEXTURE = "tiles";
export const TITLE_TEXTURE = "title";
export const BULLET_TEXTURE = "bullet";
export const DOOR_TEXTURE = "door";
export const HUD_TEXTURE = "hud";
export const HUD_FONT = "hud-font";

/** Door frame: a 2x3 block of tiles at `TILE = 80`, three frames side by side. */
export const DOOR_W = 160;
export const DOOR_H = 240;

export const SPRITE_NAMES = ["hero", "chunk1", "chunk2"] as const;

export interface LevelData {
  width: number;
  height: number;
  tiles: number[];
  entities: number[];
}

export interface TileInfoData {
  count: number;
  blockUp: number[];
  blockDown: number[];
  blockLeft: number[];
  blockRight: number[];
  flags: number[];
  behavior: number[];
}

export interface Assets {
  tileInfo: TileInfoData;
  levels: LevelData[];
}

export const TILE_FLAG_MASK = 0x3ff;

export const LEVEL_COUNT = 8;
