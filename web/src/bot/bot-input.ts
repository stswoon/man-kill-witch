import type { InputState } from "../game";
import type { BotAction } from "./types";

const DIRECTION: Partial<Record<BotAction, "left" | "right">> = {
  left: "left",
  right: "right",
  jump_left: "left",
  jump_right: "right",
  hop_left: "left",
  hop_right: "right",
  drop_left: "left",
  drop_right: "right",
};

/** How many ticks a directional hop holds before letting go. */
const HOP_HOLD_TICKS = 8;

/**
 * Virtual keyboard for the LLM pilot. The harness sets the keys for exactly one
 * fixed tick, lets the scene step the rules and Arcade, and clears one-shot
 * presses. The bot never writes into the game state directly.
 */
export class BotInput implements InputState {
  private readonly down = new Set<string>();
  private readonly hits = new Set<string>();

  clear(): void {
    this.down.clear();
    this.hits.clear();
  }

  /** Sets the keys for tick `tick` (0-based) of `action`. */
  set(action: BotAction, tick: number): void {
    this.down.clear();
    this.hits.clear();

    const direction = DIRECTION[action];
    if (direction === "left") this.down.add("ArrowLeft");
    if (direction === "right") this.down.add("ArrowRight");
    if (action === "shoot_up") this.down.add("ArrowUp");
    if (action === "shoot_down") this.down.add("ArrowDown");
    if (action === "up") this.down.add("ArrowUp");

    if (tick === 0 && (action.startsWith("jump") || action.startsWith("hop"))) {
      this.hits.add("Space");
    }
    if (tick === 0 && (action === "shoot" || action.startsWith("shoot_"))) {
      this.hits.add("ControlLeft");
    }

    if (action.startsWith("hop") && tick >= HOP_HOLD_TICKS) {
      if (direction === "left") this.down.delete("ArrowLeft");
      if (direction === "right") this.down.delete("ArrowRight");
    }
  }

  endTick(): void {
    this.hits.clear();
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.down.has(code));
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((code) => this.hits.has(code));
  }
}
