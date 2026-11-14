export const TILE = 16;
export const SCREEN_W = 320;
export const SCREEN_H = 200;
export const SPRITE_W = 24; // one S_*.DD2 frame
export const SPRITE_H = 32;

export const TILE_TEXTURE = "tiles";
export const TITLE_TEXTURE = "title";
export const BULLET_TEXTURE = "bullet";

export const SPRITE_NAMES = ["hero", "chunk1", "chunk2", "frank", "master"] as const;

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
