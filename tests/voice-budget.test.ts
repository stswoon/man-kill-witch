import { describe, expect, it } from "vitest";
import {
  WEEK_MS,
  WEEKLY_BUDGET_USD,
  computeBudget,
  countCharacters,
  emptyLedger,
  estimateUsd,
  normalizeLedger,
  weekStatus,
} from "../tools/voice-budget.mjs";
import type { Ledger } from "../tools/voice-budget.mjs";

const NOW = new Date("2026-11-15T12:00:00.000Z");

function ledger(entries: Ledger["entries"] = [], approvals: Ledger["approvals"] = []): Ledger {
  return { version: 1, entries, approvals };
}

function spend(usd: number, at = NOW.toISOString()): Ledger["entries"][number] {
  return { at, usd };
}

describe("voice budget", () => {
  it("counts characters by code points", () => {
    expect(countCharacters("Привет")).toBe(6);
    expect(countCharacters("🙂")).toBe(1);
    expect(countCharacters("a🙂b")).toBe(3);
  });

  it("prices eleven_v4 at $0.08 per 1K characters", () => {
    expect(estimateUsd("eleven_v4", 1000)).toBe(0.08);
    expect(estimateUsd("eleven_v4", 17)).toBe(0.00136);
    expect(estimateUsd("eleven_v4_turbo", 1000)).toBe(0.04);
    expect(estimateUsd("eleven_multilingual_v2", 1000)).toBe(0.08);
    expect(estimateUsd("eleven_flash_v2_5", 1000)).toBe(0.04);
  });

  it("rejects an unknown model instead of guessing a price", () => {
    expect(() => estimateUsd("eleven_unknown", 10)).toThrow(/unknown price/);
  });

  it("does not ask for approval under the $1 weekly cap", () => {
    const budget = computeBudget({ ledger: emptyLedger(), model: "eleven_v4", characters: 100, now: NOW });
    expect(budget.spentUsd).toBe(0);
    expect(budget.capUsd).toBe(1);
    expect(budget.estimateUsd).toBe(0.008);
    expect(budget.projectedUsd).toBe(0.008);
    expect(budget.approvalRequired).toBe(false);
    expect(budget.blocksNeeded).toBe(0);
  });

  it("does not ask when the projected total is exactly $1", () => {
    const budget = computeBudget({
      ledger: ledger([spend(0.992)]),
      model: "eleven_v4",
      characters: 100,
      now: NOW,
    });
    expect(budget.projectedUsd).toBe(1);
    expect(budget.approvalRequired).toBe(false);
  });

  it("asks for the next $1 block when the projected total exceeds the cap", () => {
    const budget = computeBudget({
      ledger: ledger([spend(0.999)]),
      model: "eleven_v4",
      characters: 100,
      now: NOW,
    });
    expect(budget.projectedUsd).toBe(1.007);
    expect(budget.overByUsd).toBe(0.007);
    expect(budget.approvalRequired).toBe(true);
    expect(budget.blocksNeeded).toBe(1);
  });

  it("counts each approval as one more $1 block", () => {
    const budget = computeBudget({
      ledger: ledger([spend(1.5)], [{ at: NOW.toISOString(), blocks: 1, usd: 1 }]),
      model: "eleven_v4",
      characters: 1000,
      now: NOW,
    });
    expect(budget.approvedUsd).toBe(1);
    expect(budget.capUsd).toBe(2);
    expect(budget.projectedUsd).toBe(1.58);
    expect(budget.approvalRequired).toBe(false);
  });

  it("asks for as many $1 blocks as needed", () => {
    const budget = computeBudget({
      ledger: ledger([spend(1.5)], [{ at: NOW.toISOString(), blocks: 1, usd: 1 }]),
      model: "eleven_v4",
      characters: 10_000,
      now: NOW,
    });
    expect(budget.projectedUsd).toBe(2.3);
    expect(budget.projectedUsd - budget.capUsd).toBeCloseTo(0.3, 6);
    expect(budget.blocksNeeded).toBe(1);
  });

  it("asks for two blocks when one is not enough", () => {
    const budget = computeBudget({
      ledger: ledger([spend(1.5)], [{ at: NOW.toISOString(), blocks: 1, usd: 1 }]),
      model: "eleven_v4",
      characters: 20_000,
      now: NOW,
    });
    expect(budget.projectedUsd).toBe(3.1);
    expect(budget.capUsd).toBe(2);
    expect(budget.blocksNeeded).toBe(2);
  });

  it("ignores spend and approvals older than seven days", () => {
    const old = new Date(NOW.getTime() - WEEK_MS - 1).toISOString();
    const budget = computeBudget({
      ledger: ledger([spend(5, old)], [{ at: old, blocks: 5, usd: 5 }]),
      model: "eleven_v4",
      characters: 10,
      now: NOW,
    });
    expect(budget.spentUsd).toBe(0);
    expect(budget.capUsd).toBe(1);
    expect(budget.approvalRequired).toBe(false);
  });

  it("reports the remaining weekly budget", () => {
    const status = weekStatus(ledger([spend(0.25)]), NOW);
    expect(status.spentUsd).toBe(0.25);
    expect(status.capUsd).toBe(1);
    expect(status.remainingUsd).toBe(0.75);
    expect(status.windowDays).toBe(7);
    expect(WEEKLY_BUDGET_USD).toBe(1);
  });

  it("normalizes a broken ledger shape to empty arrays", () => {
    expect(normalizeLedger({})).toEqual({ version: 1, entries: [], approvals: [] });
    expect(normalizeLedger({ entries: null, approvals: "x" })).toEqual({
      version: 1,
      entries: [],
      approvals: [],
    });
    expect(() => normalizeLedger([])).toThrow(/JSON object/);
  });
});
