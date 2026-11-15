import Phaser from "phaser";
import { BACKDROP_TILE, TILE, TILE_TEXTURE } from "../assets";
import type { Level } from "../game";

/** Owns the Phaser tilemap layer and the camera scroll of the level. */
export class LevelView {
  private readonly scene: Phaser.Scene;
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private backdropMap: Phaser.Tilemaps.Tilemap | null = null;
  private backdropLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Rebuilds the tilemap for a freshly created level. */
  build(level: Level): void {
    this.layer?.destroy();
    this.map?.destroy();
    this.backdropLayer?.destroy();
    this.backdropMap?.destroy();

    const backdrop: number[][] = [];
    const data: number[][] = [];
    for (let ty = 0; ty < level.height; ty++) {
      const backdropRow: number[] = [];
      const row: number[] = [];
      for (let tx = 0; tx < level.width; tx++) {
        backdropRow.push(BACKDROP_TILE);
        const index = level.tileAt(tx, ty);
        row.push(index > 0 ? index : -1);
      }
      backdrop.push(backdropRow);
      data.push(row);
    }

    const backdropMap = this.scene.make.tilemap({
      data: backdrop,
      tileWidth: TILE,
      tileHeight: TILE,
    });
    const backdropTileset = backdropMap.addTilesetImage("tiles", TILE_TEXTURE, TILE, TILE, 0, 0);
    if (!backdropTileset) throw new Error("failed to bind the backdrop tileset");
    const backdropLayer = backdropMap.createLayer(0, backdropTileset, 0, 0);
    if (!backdropLayer) throw new Error("failed to create the backdrop layer");
    backdropLayer.setDepth(-10);

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE,
      tileHeight: TILE,
    });
    const tileset = map.addTilesetImage("tiles", TILE_TEXTURE, TILE, TILE, 0, 0);
    if (!tileset) throw new Error("failed to bind the tileset");
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error("failed to create the tilemap layer");

    layer.setDepth(0);
    this.backdropMap = backdropMap;
    this.backdropLayer = backdropLayer as Phaser.Tilemaps.TilemapLayer;
    this.map = map;
    this.layer = layer as Phaser.Tilemaps.TilemapLayer;
  }

  /** Redraws only the changed tiles in the live tilemap layer. */
  patch(patches: { x: number; y: number; index: number }[]): void {
    if (!this.layer) return;
    for (const patch of patches) {
      if (patch.index > 0) this.layer.putTileAt(patch.index, patch.x, patch.y);
      else this.layer.removeTileAt(patch.x, patch.y);
    }
  }

  setCamera(x: number, y: number): void {
    this.scene.cameras.main.setScroll(x, y);
  }

  /**
   * The live tilemap layer. `ArcadeSim` reuses it for collisions instead of
   * building a second hidden layer.
   */
  get tilemapLayer(): Phaser.Tilemaps.TilemapLayer {
    if (!this.layer) throw new Error("level view is not built yet");
    return this.layer;
  }
}
