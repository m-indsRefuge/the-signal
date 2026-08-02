import { stableDigest } from "./candidate-digest";
import { fail } from "./failures";
import type { PlanningCandidate } from "./candidate-contract";

export interface RankedPlan {
  readonly rank: number;
  readonly candidateId: string;
  readonly candidateDigest: string;
  readonly actionIds: readonly string[];
  readonly lineageCandidateIds: readonly string[];
  readonly sourceStateDigest: string;
  readonly resultStateDigest: string;
  readonly scoreComponents: readonly Readonly<{
    metric: string;
    normalizedValue: number;
    weight: number;
    contribution: number;
  }>[];
  readonly riskFlags: readonly string[];
  readonly totalUtility: number;
  readonly riskPenalty: number;
  readonly blocked: boolean;
  readonly planDigest: string;
}

export function createRankedPlan(candidate: PlanningCandidate, rank: number): RankedPlan {
  if (!Number.isSafeInteger(rank) || rank <= 0) {
    return fail("invalid_plan", "Plan rank must be a positive safe integer.");
  }
  const body = {
    rank,
    candidateId: candidate.candidateId,
    candidateDigest: candidate.candidateDigest,
    actionIds: Object.freeze(candidate.actionSequence.map((action) => action.actionId)),
    lineageCandidateIds: Object.freeze([...candidate.lineageCandidateIds, candidate.candidateId]),
    sourceStateDigest: candidate.sourceStateDigest,
    resultStateDigest: candidate.resultState.stateDigest,
    scoreComponents: Object.freeze(
      candidate.score.components.map((component) =>
        Object.freeze({
          metric: component.metric,
          normalizedValue: component.normalizedValue,
          weight: component.weight,
          contribution: component.contribution,
        }),
      ),
    ),
    riskFlags: Object.freeze([...candidate.risk.flags]),
    totalUtility: candidate.score.totalUtility,
    riskPenalty: candidate.risk.penalty,
    blocked: candidate.risk.blocked,
  };
  return Object.freeze({ ...body, planDigest: stableDigest(body) });
}
