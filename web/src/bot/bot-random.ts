/**
 * Runs `make` while `Math.random` is replaced by a deterministic mulberry32
 * stream. The rules use randomness only for flyer phases, so a seeded reset is
 * enough to make an action log replayable. The original function is restored
 * even if the constructor throws.
 */
export function withSeededRandom<T>(seed: number | undefined, make: () => T): T {
  if (seed === undefined) return make();
  const original = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return make();
  } finally {
    Math.random = original;
  }
}
