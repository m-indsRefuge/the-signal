export const ZERO_SEED_FALLBACK = 0x6d2b79f5;

const MAX_UINT32 = 0xffffffff;

export interface RandomResult {
  readonly value: number;
  readonly nextState: number;
}

function assertUnsignedInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UINT32) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer.`);
  }
}

export function normalizeSeed(seed: number): number {
  assertUnsignedInteger(seed, "Seed");

  const normalized = seed >>> 0;

  return normalized === 0 ? ZERO_SEED_FALLBACK : normalized;
}

export function nextUint32(state: number): RandomResult {
  let value = normalizeSeed(state);

  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;

  const nextState = value >>> 0;

  return {
    value: nextState,
    nextState,
  };
}

export function nextInt(state: number, maxExclusive: number): RandomResult {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive safe integer.");
  }

  const generated = nextUint32(state);

  return {
    value: generated.value % maxExclusive,
    nextState: generated.nextState,
  };
}
