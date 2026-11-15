import type Phaser from "phaser";
import type { Game } from "./game";
import type { TilePatch, WorldSnapshot } from "./sim-contract";
import { CharacterView } from "./view/character-view";
import { DoorView } from "./view/door-view";
import { HudView } from "./view/hud-view";
import { LevelView } from "./view/level-view";
import { MessageView } from "./view/message-view";

/**
 * Phaser side of the game: composes the view modules and exposes them to the
 * scene. It only reads the state produced by game.ts and the Arcade snapshot;
 * the view never changes the rules.
 */
export class PhaserView {
  private readonly levelView: LevelView;
  private readonly door: DoorView;
  private readonly characters: CharacterView;
  private readonly hud: HudView;
  private readonly messages: MessageView;

  constructor(scene: Phaser.Scene) {
    this.messages = new MessageView(scene);
    this.characters = new CharacterView(scene);
    this.hud = new HudView(scene);
    this.levelView = new LevelView(scene);
    this.door = new DoorView(scene);
  }

  /** The live tilemap layer shared with `ArcadeSim`. */
  get tilemapLayer(): Phaser.Tilemaps.TilemapLayer {
    return this.levelView.tilemapLayer;
  }

  showTitle(): void {
    this.messages.showTitle();
  }

  hideTitle(): void {
    this.messages.hideTitle();
  }

  showMessage(title: string, subtitle: string): void {
    this.messages.showMessage(title, subtitle);
  }

  hideMessage(): void {
    this.messages.hideMessage();
  }

  /**
   * Rebuild the tilemap and the level objects for a freshly created level.
   * `withHud` is false for the level prepared behind the title screen, which
   * must not show the HUD panel yet.
   */
  buildLevel(game: Game, withHud = true): void {
    this.levelView.build(game.level);
    this.door.hide();
    if (withHud) this.hud.ensureCreated();
  }

  /** Redraw only the changed tiles in the live tilemap layer. */
  patchTiles(patches: TilePatch[]): void {
    this.levelView.patch(patches);
  }

  render(game: Game, snapshot: WorldSnapshot, levelIndex: number): void {
    this.levelView.setCamera(game.cameraX, game.cameraY);
    this.door.render(game.door);
    this.characters.render(snapshot);
    this.hud.render(game, levelIndex);
  }
}
