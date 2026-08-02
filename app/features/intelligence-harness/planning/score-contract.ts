import { fail } from "./failures";

export const SCORE_METRICS = [
  "signal_retention",
  "defence_retention",
  "coherence",
  "damage_avoidance",
  "threat_reduction",
  "resource_efficiency",
  "recovery_potential",
  "wave_progress",
  "terminal_survival",
  "future_option_value",
] as const;

export type ScoreMetric = (typeof SCORE_METRICS)[number];

export interface ScoreContribution {
  readonly metric: ScoreMetric;
  readonly rawValue: number;
  readonly normalizedValue: number;
  readonly weight: number;
  readonly contribution: number;
}

export interface ScoreBreakdown {
  readonly components: readonly ScoreContribution[];
  readonly utilityBeforeRisk: number;
  readonly riskPenalty: number;
  readonly totalUtility: number;
}

export function normalizeUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return fail("non_finite_score", "Score input must be finite.");
  }
  return Math.max(-1, Math.min(1, value));
}

export function createScoreBreakdown(
  components: readonly ScoreContribution[],
  riskPenalty: number,
): ScoreBreakdown {
  if (!Number.isFinite(riskPenalty) || riskPenalty < 0) {
    return fail("invalid_scoring_policy", "Risk penalty must be finite and non-negative.");
  }
  const utilityBeforeRisk = components.reduce(
    (total, component) => total + component.contribution,
    0,
  );
  if (!Number.isFinite(utilityBeforeRisk)) {
    return fail("non_finite_score", "Utility must be finite.");
  }
  return Object.freeze({
    components: Object.freeze(components.map((component) => Object.freeze({ ...component }))),
    utilityBeforeRisk,
    riskPenalty,
    totalUtility: utilityBeforeRisk - riskPenalty,
  });
}
