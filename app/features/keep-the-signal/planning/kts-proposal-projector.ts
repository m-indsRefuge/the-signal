import { stableDigest, type PlannerResult } from "../../intelligence-harness/planning";

export interface KtsPlanningProposalCandidate {
  readonly kind: "kts_planning_proposal_candidate";
  readonly sourceResultDigest: string;
  readonly primaryActionId: string;
  readonly actionSequence: readonly string[];
  readonly utility: number;
  readonly confidence: number;
  readonly requiresProposalValidation: true;
  readonly noExecution: true;
  readonly proposalDigest: string;
}

export function projectKtsPlanningProposal(
  result: PlannerResult,
): KtsPlanningProposalCandidate | null {
  if (result.status !== "planned" || !result.selectedPlan) return null;
  const plan = result.selectedPlan;
  const confidence = Math.max(0, Math.min(1, 0.5 + plan.totalUtility / 200));
  const body = {
    kind: "kts_planning_proposal_candidate" as const,
    sourceResultDigest: result.resultDigest,
    primaryActionId: plan.actionIds[0] ?? "abstain",
    actionSequence: Object.freeze([...plan.actionIds]),
    utility: plan.totalUtility,
    confidence,
    requiresProposalValidation: true as const,
    noExecution: true as const,
  };
  return Object.freeze({ ...body, proposalDigest: stableDigest(body) });
}
