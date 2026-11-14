export const TILE = 16;
export const SCREEN_W = 320;
export const SCREEN_H = 200;
export const TILES_W = 32; // columns in tiles.png
export const SPRITE_W = 24; // one S_*.DD2 frame
export const SPRITE_H = 32;
export const SPRITE_COLS = 16; // columns in the exported atlases

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

export const TILE_FLAG_MASK = 0x3ff;

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`image failed: ${src}`));
    img.src = src;
  });
  return img;
}

export async function loadJson<T>(src: string): Promise<T> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`json failed: ${src} (${res.status})`);
  return (await res.json()) as T;
}

export interface SpriteAtlas {
  image: HTMLImageElement;
  cellW: number;
  cellH: number;
  cols: number;
  count: number;
}

export interface Assets {
  tiles: HTMLImageElement;
  tileInfo: TileInfoData;
  levels: LevelData[];
  title: HTMLImageElement;
  sprites: Record<string, SpriteAtlas>;
}

export async function loadAssets(): Promise<Assets> {
  const base = "assets/";
  const spriteNames = ["hero", "chunk1", "chunk2", "frank", "master"];
  const [tiles, tileInfo, title, ...rest] = await Promise.all([
    loadImage(base + "tiles.png"),
    loadJson<TileInfoData>(base + "tileinfo.json"),
    loadImage(base + "title1.png"),
    ...Array.from({ length: 8 }, (_, i) =>
      loadJson<LevelData>(`${base}levels/${String(i + 1).padStart(2, "0")}.json`),
    ),
    ...spriteNames.map((n) => loadImage(`${base}sprites/s_${n}.png`)),
  ]);
  const levels = rest.slice(0, 8) as LevelData[];
  const images = rest.slice(8) as HTMLImageElement[];
  const sprites: Record<string, SpriteAtlas> = {};
  spriteNames.forEach((name, i) => {
    const image = images[i];
    sprites[name] = {
      image,
      cellW: SPRITE_W,
      cellH: SPRITE_H,
      cols: SPRITE_COLS,
      count: Math.floor(image.height / SPRITE_H) * SPRITE_COLS,
    };
  });
  return { tiles, tileInfo, title, levels, sprites };
}
