import { TILE, type LevelData, type TileInfoData } from "../web/src/assets";
import { Game, Level, type InputState } from "../web/src/game";

/** Fixed simulation step, same as `DT` in the game scene. */
export const DT = 1 / 70;

/** Spawn marker id that `Game.spawn` looks for in the entity layer. */
export const SPAWN = 255;

/**
 * Synthetic tile set used by the tests. The real tileset has 858 entries, but
 * every rule the simulation cares about fits in eight:
 * 0 empty, 1 solid, 2 one-way platform (blocks downwards only),
 * 3 exit door, 4/5/6 gems, 7 ammo pickup.
 */
export const SOLID = 1;
export const PLATFORM = 2;
export const DOOR = 3;
export const GEM_100 = 4;
export const GEM_250 = 5;
export const GEM_500 = 6;
export const AMMO = 7;

const TILE_COUNT = 8;

function makeInfo(): TileInfoData {
  const zeros = (): number[] => new Array<number>(TILE_COUNT).fill(0);
  const blockUp = zeros();
  const blockDown = zeros();
  const blockLeft = zeros();
  const blockRight = zeros();
  for (const column of [blockUp, blockDown, blockLeft, blockRight]) column[SOLID] = 1;
  blockDown[PLATFORM] = 1;

  const behavior = zeros();
  behavior[DOOR] = 2;
  behavior[GEM_100] = 52;
  behavior[GEM_250] = 53;
  behavior[GEM_500] = 54;
  behavior[AMMO] = 105;

  return { count: TILE_COUNT, blockUp, blockDown, blockLeft, blockRight, flags: zeros(), behavior };
}

export const INFO: TileInfoData = makeInfo();

export interface LevelSpec {
  width?: number;
  height?: number;
  /** Row filled with solid tiles across the whole width. */
  floor?: number;
  /** Extra `[tx, ty, tile]` cells written after the floor. */
  tiles?: Array<[number, number, number]>;
  /** `[tx, ty, entityId]` cells. */
  entities?: Array<[number, number, number]>;
}

export function makeLevel(spec: LevelSpec = {}): Level {
  const width = spec.width ?? 20;
  const height = spec.height ?? 15;
  const data: LevelData = {
    width,
    height,
    tiles: new Array<number>(width * height).fill(0),
    entities: new Array<number>(width * height).fill(0),
  };

  if (spec.floor !== undefined) {
    for (let x = 0; x < width; x++) data.tiles[spec.floor * width + x] = SOLID;
  }
  for (const [x, y, tile] of spec.tiles ?? []) data.tiles[y * width + x] = tile;
  for (const [x, y, id] of spec.entities ?? []) data.entities[y * width + x] = id;

  return new Level(data, INFO);
}

/**
 * Level with a floor and a single spawn marker one row above it, so the player
 * starts standing. Width 30 tiles, floor row 12: the camera has room to move.
 */
export function makeArena(spec: LevelSpec = {}): Level {
  return makeLevel({
    width: 30,
    height: 15,
    floor: 12,
    entities: [[2, 11, SPAWN]],
    ...spec,
  });
}

/** Stands the player on top of `floorRow` at tile column `tx`. */
export function placeOnFloor(player: { x: number; y: number; h: number }, tx: number, floorRow: number): void {
  player.x = tx * TILE + 10;
  player.y = floorRow * TILE - player.h;
}

export interface FakeInput extends InputState {
  readonly down: Set<string>;
  readonly hits: Set<string>;
  press(...codes: string[]): void;
  release(...codes: string[]): void;
}

/** Structural stand-in for `Input` with mutable key state. */
export function fakeInput(): FakeInput {
  const down = new Set<string>();
  const hits = new Set<string>();
  return {
    down,
    hits,
    press(...codes: string[]): void {
      for (const code of codes) hits.add(code);
    },
    release(...codes: string[]): void {
      for (const code of codes) down.delete(code);
    },
    isDown: (...codes: string[]): boolean => codes.some((code) => down.has(code)),
    wasPressed: (...codes: string[]): boolean => codes.some((code) => hits.has(code)),
  };
}

/**
 * Advances the simulation `count` fixed steps. One-shot presses are cleared
 * after each step, mirroring `Input.endFrame` in the scene loop.
 */
export function tick(game: Game, input: FakeInput, count = 1, dt = DT): void {
  for (let i = 0; i < count; i++) {
    game.update(dt, input);
    input.hits.clear();
  }
}
