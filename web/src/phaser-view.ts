import type Phaser from "phaser";
import type { Game } from "./game";
import { CharacterView } from "./view/character-view";
import { HudView } from "./view/hud-view";
import { LevelView } from "./view/level-view";
import { MessageView } from "./view/message-view";

/**
 * Phaser side of the game: composes the view modules and exposes them to the
 * scene. It only reads the state produced by game.ts; all positions come from
 * the fixed-step simulation.
 */
export class PhaserView {
  private readonly levelView: LevelView;
  private readonly characters: CharacterView;
  private readonly hud: HudView;
  private readonly messages: MessageView;

  constructor(scene: Phaser.Scene) {
    this.messages = new MessageView(scene);
    this.characters = new CharacterView(scene);
    this.hud = new HudView(scene);
    this.levelView = new LevelView(scene);
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

  /** Rebuild the tilemap and HUD for a freshly created level. */
  buildLevel(game: Game): void {
    this.levelView.build(game.level);
    this.hud.ensureCreated();
  }

  /** Redraw only the changed tiles in the live tilemap layer. */
  patchTiles(patches: { x: number; y: number; index: number }[]): void {
    this.levelView.patch(patches);
  }

  render(game: Game, levelIndex: number): void {
    this.levelView.setCamera(game.cameraX, game.cameraY);
    this.characters.render(game.player, game.enemies, game.bullets);
    this.hud.render(game, levelIndex);
  }
}
