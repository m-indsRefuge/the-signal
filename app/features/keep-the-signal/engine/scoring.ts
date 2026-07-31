import { ENGINE_CONSTANTS } from "./constants";

export interface TickScoreResult {
  readonly amount: number;
  readonly integrityTier: number;
  readonly coherenceMultiplier: number;
}

export function calculateIntegrityTier(signalIntegrity: number): number {
  assertBoundedInteger(
    signalIntegrity,
    0,
    ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY,
    "Signal integrity",
  );

  if (signalIntegrity === 0) {
    return 0;
  }

  return 1 + Math.floor(signalIntegrity / 2_000);
}

export function calculateCoherenceMultiplier(currentCoherenceTicks: number): number {
  if (!Number.isSafeInteger(currentCoherenceTicks) || currentCoherenceTicks < 0) {
    throw new RangeError("Current coherence ticks must be a non-negative safe integer.");
  }

  return 1 + Math.min(4, Math.floor(currentCoherenceTicks / 1_800));
}

export function calculateTickScore(
  signalIntegrity: number,
  currentCoherenceTicks: number,
): TickScoreResult {
  const integrityTier = calculateIntegrityTier(signalIntegrity);
  const coherenceMultiplier = calculateCoherenceMultiplier(currentCoherenceTicks);

  return {
    amount: integrityTier * coherenceMultiplier,
    integrityTier,
    coherenceMultiplier,
  };
}

function assertBoundedInteger(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}
