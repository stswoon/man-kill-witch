// Pure cost and rolling-week budget math for tools/voice.mjs.
// Prices are ElevenLabs API list prices per 1,000 characters (2026-11-15).
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const WEEKLY_BUDGET_USD = 1;
export const PRICE_PER_1K_USD = Object.freeze({
  eleven_v4: 0.08,
  eleven_v4_turbo: 0.04,
  eleven_v3: 0.08,
  eleven_multilingual_v2: 0.08,
  eleven_flash_v2_5: 0.04,
  eleven_turbo_v2_5: 0.04,
});

export function countCharacters(text) {
  return Array.from(String(text ?? "")).length;
}

export function pricePer1k(model) {
  const price = PRICE_PER_1K_USD[model];
  if (price === undefined) {
    throw new Error(`unknown price for model "${model}": add it to PRICE_PER_1K_USD`);
  }
  return price;
}

export function round6(value) {
  return Math.round((value + Number.EPSILON) * 1e6) / 1e6;
}

export function estimateUsd(model, characters) {
  return round6((characters / 1000) * pricePer1k(model));
}

export function emptyLedger() {
  return { version: 1, entries: [], approvals: [] };
}

export function normalizeLedger(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("spend ledger must be a JSON object");
  }
  return {
    version: 1,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
    approvals: Array.isArray(raw.approvals) ? raw.approvals : [],
  };
}

function inWindow(item, sinceMs) {
  const at = Date.parse(item?.at);
  return Number.isFinite(at) && at >= sinceMs;
}

function sumUsd(items, sinceMs) {
  const total = (items ?? [])
    .filter((item) => inWindow(item, sinceMs))
    .reduce((sum, item) => sum + (Number(item.usd) || 0), 0);
  return round6(total);
}

export function weekStatus(ledger, now = new Date()) {
  const sinceMs = now.getTime() - WEEK_MS;
  const spentUsd = sumUsd(ledger?.entries, sinceMs);
  const approvedUsd = sumUsd(ledger?.approvals, sinceMs);
  const capUsd = round6(WEEKLY_BUDGET_USD + approvedUsd);
  return {
    spentUsd,
    approvedUsd,
    capUsd,
    remainingUsd: round6(capUsd - spentUsd),
    sinceMs,
    since: new Date(sinceMs).toISOString(),
    windowDays: 7,
  };
}

export function computeBudget({ ledger, model, characters, now = new Date() }) {
  const status = weekStatus(ledger, now);
  const ratePer1k = pricePer1k(model);
  const estimateUsd = round6((characters / 1000) * ratePer1k);
  const projectedUsd = round6(status.spentUsd + estimateUsd);
  const overByUsd = round6(Math.max(0, projectedUsd - status.capUsd));
  const blocksNeeded = overByUsd > 0 ? Math.ceil(overByUsd) : 0;
  return {
    ...status,
    model,
    characters,
    ratePer1k,
    estimateUsd,
    projectedUsd,
    overByUsd,
    approvalRequired: blocksNeeded > 0,
    blocksNeeded,
  };
}
