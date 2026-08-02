import { fail } from "./failures";

export const PLANNER_RESULT_STATUSES = [
  "planned",
  "abstained",
  "cancelled",
  "budget_exhausted",
  "rejected",
  "failed",
] as const;

export type PlannerResultStatus = (typeof PLANNER_RESULT_STATUSES)[number];

export interface PlannerIdentity {
  readonly plannerId: string;
  readonly plannerVersion: string;
  readonly algorithm: "deterministic_bounded_beam_search";
}

export const PLANNER_MAXIMA = Object.freeze({
  maximumPlanningDepth: 8,
  maximumBeamWidth: 64,
  maximumCandidateExpansions: 10_000,
  maximumSimulationCalls: 10_000,
  maximumRetainedCandidates: 10_000,
  maximumReturnedPlans: 16,
  maximumExplanationEntries: 256,
  maximumCandidateActions: 256,
  maximumScoreComponents: 32,
  maximumOutputBytes: 1_000_000,
});

export function createPlannerIdentity(plannerId: string, plannerVersion: string): PlannerIdentity {
  if (!plannerId.trim() || !plannerVersion.trim()) {
    return fail("invalid_planner_identity", "Planner identity is incomplete.");
  }

  return Object.freeze({
    plannerId: plannerId.trim(),
    plannerVersion: plannerVersion.trim(),
    algorithm: "deterministic_bounded_beam_search" as const,
  });
}
