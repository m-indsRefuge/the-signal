import { stableDigest } from "./candidate-digest";
import { fail } from "./failures";
import {
  SCORE_METRICS,
  createScoreBreakdown,
  normalizeUnit,
  type ScoreBreakdown,
  type ScoreContribution,
  type ScoreMetric,
} from "./score-contract";
import type { SimulatedState } from "./simulation-port";

export interface ScorePolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly weights: Readonly<Record<ScoreMetric, number>>;
  readonly digest: string;
}

export function createScorePolicy(
  policyId: string,
  policyVersion: string,
  weights: Readonly<Record<ScoreMetric, number>>,
): ScorePolicy {
  if (!policyId.trim() || !policyVersion.trim()) {
    return fail("invalid_scoring_policy", "Scoring-policy identity is incomplete.");
  }
  for (const metric of SCORE_METRICS) {
    const weight = weights[metric];
    if (!Number.isFinite(weight) || weight < -100 || weight > 100) {
      return fail("invalid_scoring_weight", `Invalid scoring weight for ${metric}.`);
    }
  }
  const frozenWeights = Object.freeze({ ...weights });
  return Object.freeze({
    policyId: policyId.trim(),
    policyVersion: policyVersion.trim(),
    weights: frozenWeights,
    digest: stableDigest({ policyId, policyVersion, weights: frozenWeights }),
  });
}

function metricValue(metric: ScoreMetric, state: SimulatedState): number {
  switch (metric) {
    case "signal_retention":
      return state.metrics.signal;
    case "defence_retention":
      return state.metrics.defence;
    case "coherence":
      return state.metrics.coherence;
    case "damage_avoidance":
      return -state.metrics.damage;
    case "threat_reduction":
      return -state.metrics.threat;
    case "resource_efficiency":
      return state.metrics.resource;
    case "recovery_potential":
      return state.metrics.recoveryPotential;
    case "wave_progress":
      return state.metrics.waveProgress;
    case "terminal_survival":
      return state.metrics.terminalSurvival;
    case "future_option_value":
      return state.metrics.futureOptions;
  }
}

export function evaluateScore(
  policy: ScorePolicy,
  state: SimulatedState,
  riskPenalty: number,
): ScoreBreakdown {
  const components: ScoreContribution[] = SCORE_METRICS.map((metric) => {
    const rawValue = metricValue(metric, state);
    const normalizedValue = normalizeUnit(rawValue);
    const weight = policy.weights[metric];
    return Object.freeze({
      metric,
      rawValue,
      normalizedValue,
      weight,
      contribution: normalizedValue * weight,
    });
  });
  return createScoreBreakdown(components, riskPenalty);
}
