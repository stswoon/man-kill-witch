import type { BlockedSides } from "../sim-contract";

/**
 * Actions an LLM pilot can ask the in-game bot to perform. They are deliberately
 * coarse: one call moves the hero for several fixed ticks, and jumps run until
 * the hero lands. Per-tick control stays in the harness, not in the model.
 */
export type BotAction =
  | "left"
  | "right"
  | "jump"
  | "jump_left"
  | "jump_right"
  | "hop_left"
  | "hop_right"
  | "drop_left"
  | "drop_right"
  | "shoot"
  | "shoot_up"
  | "shoot_down"
  | "up"
  | "wait"
  | "stop";

/** The complete action vocabulary, echoed in every observation. */
export const BOT_ACTIONS: readonly BotAction[] = [
  "left",
  "right",
  "jump",
  "jump_left",
  "jump_right",
  "hop_left",
  "hop_right",
  "drop_left",
  "drop_right",
  "shoot",
  "shoot_up",
  "shoot_down",
  "up",
  "wait",
  "stop",
];

/** Tile coordinates; the bot reads the world as data, never as pixels. */
export interface BotPoint {
  tx: number;
  ty: number;
}

/** One connected door/exit cluster and its closest trigger tile to the spawn. */
export interface BotExit {
  behavior: 1 | 2;
  tx: number;
  ty: number;
  tiles: BotPoint[];
  distance: number;
  nearSpawn: boolean;
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

/** Hero state as the LLM sees it. `tx`/`ty` are the body centre tile. */
export interface BotPlayer {
  tx: number;
  ty: number;
  feetTy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: number;
  blocked: BlockedSides;
}

export interface BotEnemy {
  id: number;
  type: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number;
  fly: boolean;
  sprite: number;
}

export interface BotBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BotDoor {
  tx: number;
  ty: number;
  step: number;
  timer: number;
}

export type BotDoneKind = "levelComplete" | "gameOver" | "budget" | "stopped";

export interface BotDone {
  kind: BotDoneKind;
}

export type BotActionResult =
  | "moved"
  | "landed"
  | "blocked"
  | "died"
  | "shot"
  | "no-ammo"
  | "cooldown"
  | "waited"
  | "stopped"
  | "levelComplete"
  | "gameOver"
  | "timeout";

export interface BotLastAction {
  action: BotAction;
  ticks: number;
  result: BotActionResult;
  from: BotPoint;
  to: BotPoint;
}

export type BotVerdict = "PASS" | "FAIL" | "IN_PROGRESS" | "CANCELLED";

export interface BotReachedDoor {
  tx: number;
  ty: number;
  behavior: number;
  cluster: BotExit | null;
}

/**
 * Verdict computed by the harness, not by the LLM. A level with an exit within
 * two tiles of the spawn is a data defect and fails immediately.
 */
export interface BotStatus {
  level: number;
  seed: number;
  state: "play" | "levelComplete" | "gameOver" | "budget" | "stopped";
  done: BotDone | null;
  tick: number;
  actions: number;
  deaths: number;
  lives: number;
  ammo: number;
  score: number;
  target: BotExit | null;
  exits: BotExit[];
  exitBehavior: 1 | 2;
  exitNextToSpawn: boolean;
  noExit2: boolean;
  reachedDoor: BotReachedDoor | null;
  earlyExit: boolean;
  verdict: BotVerdict;
  reason: string;
  warnings: string[];
  lastAction: BotLastAction | null;
}

/** One JSON-safe snapshot of the world plus a compact status. */
export interface BotObservation {
  level: number;
  seed: number;
  tick: number;
  state: BotStatus["state"];
  player: BotPlayer;
  ammo: number;
  lives: number;
  score: number;
  cooldown: number;
  reload: number;
  invuln: number;
  target: BotExit | null;
  exits: BotExit[];
  enemies: BotEnemy[];
  bullets: BotBullet[];
  door: BotDoor | null;
  window: string[];
  minimap: string[];
  minimapScale: number;
  legend: string;
  hint: string;
  warnings: string[];
  actions: readonly BotAction[];
  lastAction: BotLastAction | null;
  done: BotDone | null;
  status: {
    verdict: BotVerdict;
    reason: string;
    exitNextToSpawn: boolean;
    noExit2: boolean;
    reachedDoor: BotReachedDoor | null;
    earlyExit: boolean;
  };
}

export interface BotResetOptions {
  seed?: number;
  render?: boolean;
  maxActions?: number;
  maxTicks?: number;
}

export interface BotReplayOptions {
  render?: boolean;
}

export interface BotRouteAction {
  action: BotAction;
  ticks: number;
}

/** A replayable action log, saved by the agent after a level run. */
export interface BotRouteLog {
  level: number;
  seed: number;
  target: BotExit | null;
  actions: BotRouteAction[];
  status: BotStatus;
}

export interface BotDebugApi {
  reset(level: number, options?: BotResetOptions): BotObservation;
  observe(): BotObservation;
  act(action: BotAction, ticks?: number): BotObservation;
  status(): BotStatus;
  log(): BotRouteLog;
  replay(route: BotRouteLog, options?: BotReplayOptions): BotStatus;
  stop(): void;
}
