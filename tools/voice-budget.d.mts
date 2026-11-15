export const WEEK_MS: number;
export const WEEKLY_BUDGET_USD: number;
export const PRICE_PER_1K_USD: Readonly<Record<string, number>>;

export interface LedgerEntry {
  at: string;
  usd: number;
  model?: string;
  characters?: number;
  voice_id?: string;
  file?: string;
  note?: string;
}

export interface ApprovalEntry {
  at: string;
  usd: number;
  blocks?: number;
  note?: string;
}

export interface Ledger {
  version?: number;
  entries: LedgerEntry[];
  approvals: ApprovalEntry[];
}

export interface WeekStatus {
  spentUsd: number;
  approvedUsd: number;
  capUsd: number;
  remainingUsd: number;
  sinceMs: number;
  since: string;
  windowDays: number;
}

export interface Budget extends WeekStatus {
  model: string;
  characters: number;
  ratePer1k: number;
  estimateUsd: number;
  projectedUsd: number;
  overByUsd: number;
  approvalRequired: boolean;
  blocksNeeded: number;
}

export function countCharacters(text: string): number;
export function pricePer1k(model: string): number;
export function round6(value: number): number;
export function estimateUsd(model: string, characters: number): number;
export function emptyLedger(): Ledger;
export function normalizeLedger(raw: unknown): Ledger;
export function weekStatus(ledger: Ledger | null | undefined, now?: Date): WeekStatus;
export function computeBudget(input: {
  ledger: Ledger | null | undefined;
  model: string;
  characters: number;
  now?: Date;
}): Budget;
