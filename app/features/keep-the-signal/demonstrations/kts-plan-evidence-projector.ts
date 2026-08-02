import type { PlannerResult, RankedPlan } from "../../intelligence-harness/planning";
import {
  createSelectedPlanEvidence,
  type SelectedPlanEvidence,
} from "../../intelligence-harness/demonstrations";

export function projectKtsSelectedPlanEvidence(result: PlannerResult): SelectedPlanEvidence | null {
  if (result.status !== "planned" || result.selectedPlan === null) return null;
  return projectPlan(result.selectedPlan);
}

function projectPlan(plan: RankedPlan): SelectedPlanEvidence {
  const futureOption = plan.scoreComponents.find(
    (component) => component.metric === "future_option_value",
  );
  return createSelectedPlanEvidence({
    planId: plan.candidateId,
    planDigest: plan.planDigest,
    rank: plan.rank,
    totalScore: plan.totalUtility,
    riskPenalty: plan.riskPenalty,
    blocked: plan.blocked,
    orderedActionIds: plan.actionIds,
    lineageCandidateIds: plan.lineageCandidateIds,
    sourceStateDigest: plan.sourceStateDigest,
    resultStateDigest: plan.resultStateDigest,
    simulationResultDigests: [plan.resultStateDigest],
    scoreComponents: plan.scoreComponents,
    riskFlags: plan.riskFlags,
    explanationReferences: plan.lineageCandidateIds,
    terminalClassification: plan.blocked ? "blocked" : "non_terminal_or_surviving",
    futureOptionValue: futureOption?.normalizedValue ?? null,
    tieBreakValues: [plan.totalUtility, -plan.riskPenalty, plan.rank],
    truncated: false,
  });
}
