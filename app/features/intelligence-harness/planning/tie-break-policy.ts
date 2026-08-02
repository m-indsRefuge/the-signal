import type { PlanningCandidate } from "./candidate-contract";

export const TIE_BREAK_POLICY_VERSION = "kts-i4-i-tie-break-v1";

function sequenceKey(candidate: PlanningCandidate): string {
  return candidate.actionSequence.map((action) => action.actionId).join("\u001f");
}

export function compareCandidates(left: PlanningCandidate, right: PlanningCandidate): number {
  if (left.score.totalUtility !== right.score.totalUtility) {
    return right.score.totalUtility - left.score.totalUtility;
  }
  if (left.risk.penalty !== right.risk.penalty) {
    return left.risk.penalty - right.risk.penalty;
  }
  const leftCost = left.actionSequence.reduce((total, action) => total + action.resourceCost, 0);
  const rightCost = right.actionSequence.reduce((total, action) => total + action.resourceCost, 0);
  if (leftCost !== rightCost) return leftCost - rightCost;
  if (left.actionSequence.length !== right.actionSequence.length) {
    return left.actionSequence.length - right.actionSequence.length;
  }
  const leftSequence = sequenceKey(left);
  const rightSequence = sequenceKey(right);
  if (leftSequence !== rightSequence) return leftSequence < rightSequence ? -1 : 1;
  if (left.candidateDigest === right.candidateDigest) return 0;
  return left.candidateDigest < right.candidateDigest ? -1 : 1;
}
