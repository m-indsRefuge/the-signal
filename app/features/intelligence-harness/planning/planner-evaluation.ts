import { stableDigest } from "./candidate-digest";
import { fail } from "./failures";

export const PLANNER_EVALUATION_GROUPS = [
  "simple_known_states",
  "ambiguous_states",
  "high_risk_states",
  "resource_scarcity",
  "recovery_states",
  "terminal_proximity",
  "unseen_seeds",
  "version_boundaries",
  "abstention_cases",
  "budget_exhaustion",
] as const;

export type PlannerEvaluationGroup = (typeof PLANNER_EVALUATION_GROUPS)[number];

export const PLANNER_EVALUATION_METRICS = [
  "legal_proposal_rate",
  "schema_compliance",
  "deterministic_reconstruction",
  "signal_retained",
  "defence_retained",
  "coherence",
  "score",
  "wave_completion",
  "damage_avoided",
  "resource_efficiency",
  "abstention_correctness",
  "expansion_count",
  "simulation_call_count",
  "planning_latency_ms",
  "quality_per_simulation_call",
  "rule_baseline_delta",
] as const;

export type PlannerEvaluationMetric = (typeof PLANNER_EVALUATION_METRICS)[number];

export interface PlannerEvaluationObservation {
  readonly group: PlannerEvaluationGroup;
  readonly metric: PlannerEvaluationMetric;
  readonly value: number;
  readonly sourceDigest: string;
  readonly observationDigest: string;
}

export function createPlannerEvaluationObservation(
  group: PlannerEvaluationGroup,
  metric: PlannerEvaluationMetric,
  value: number,
  sourceDigest: string,
): PlannerEvaluationObservation {
  if (!Number.isFinite(value) || !sourceDigest) {
    return fail("invalid_plan", "Planner evaluation observation is malformed.");
  }
  const body = { group, metric, value, sourceDigest };
  return Object.freeze({ ...body, observationDigest: stableDigest(body) });
}

export function compareAgainstRuleBaseline(plannerValue: number, ruleValue: number): number {
  if (!Number.isFinite(plannerValue) || !Number.isFinite(ruleValue)) {
    return fail("non_finite_score", "Baseline values must be finite.");
  }
  return plannerValue - ruleValue;
}
