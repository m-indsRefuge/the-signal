import type { PlannerResultStatus, SearchBudget } from "../planning";
import {
  DEMONSTRATION_MAXIMA,
  DEMONSTRATION_OUTCOMES,
  requireBoundedStrings,
  requireDigest,
  requireIdentity,
  requireTimestamp,
  type DemonstrationOutcome,
} from "./demonstration-contract";
import { freezeDeep } from "./evidence-digest";
import type { DemonstrationSourceLineage } from "./source-lineage";
import type { ProposalEvidence, SelectedPlanEvidence, ValidatorEvidence } from "./evidence-target";
import { failDemonstration } from "./failures";

export interface DemonstrationEvidenceInput {
  readonly recordId: string;
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly recordedAt: string;
  readonly recorderId: string;
  readonly outcome: DemonstrationOutcome;
  readonly sourceLineage: DemonstrationSourceLineage;
  readonly observationId: string;
  readonly observationDigest: string;
  readonly legalActionSetId: string;
  readonly legalActionSetDigest: string;
  readonly plannerRequestId: string;
  readonly plannerRequestDigest: string;
  readonly plannerResultId: string;
  readonly plannerResultDigest: string;
  readonly plannerStatus: PlannerResultStatus;
  readonly plannerBudget: SearchBudget;
  readonly candidateExpansions: number;
  readonly simulationCalls: number;
  readonly retainedCandidates: number;
  readonly selectedPlan: SelectedPlanEvidence | null;
  readonly alternativePlanDigests: readonly string[];
  readonly proposal: ProposalEvidence | null;
  readonly validator: ValidatorEvidence | null;
  readonly reconstructionPolicyId: string;
  readonly reconstructionPolicyVersion: string;
  readonly limitations: readonly string[];
  readonly duplicateFamilyId: string;
  readonly partitionFamilyId: string;
  readonly truncated: boolean;
  readonly cancelled: boolean;
}

export function createEvidenceInput(input: DemonstrationEvidenceInput): DemonstrationEvidenceInput {
  if (!DEMONSTRATION_OUTCOMES.includes(input.outcome)) {
    return failDemonstration("invalid_schema", "Evidence outcome is unsupported.");
  }
  const counts = [input.candidateExpansions, input.simulationCalls, input.retainedCandidates];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return failDemonstration(
      "invalid_schema",
      "Planner budget usage must be non-negative integers.",
    );
  }
  if (input.cancelled && input.outcome !== "planner_cancelled") {
    return failDemonstration(
      "generation_cancelled",
      "Cancelled evidence must use planner_cancelled.",
    );
  }
  if (input.alternativePlanDigests.length > DEMONSTRATION_MAXIMA.alternativePlans) {
    return failDemonstration(
      "record_budget_exceeded",
      "Alternative plans exceed the accepted limit.",
    );
  }
  if (
    input.candidateExpansions > input.plannerBudget.maximumCandidateExpansions ||
    input.simulationCalls > input.plannerBudget.maximumSimulationCalls ||
    input.retainedCandidates > input.plannerBudget.maximumRetainedCandidates
  ) {
    return failDemonstration(
      "record_budget_exceeded",
      "Planner usage exceeds its supplied budget.",
    );
  }
  if (input.sourceLineage.partitionFamilyId !== input.partitionFamilyId) {
    return failDemonstration(
      "selected_plan_lineage_mismatch",
      "Partition-family identity does not match source lineage.",
    );
  }
  if (
    input.proposal !== null &&
    input.proposal.sourcePlannerResultDigest !== input.plannerResultDigest
  ) {
    return failDemonstration(
      "planner_result_mismatch",
      "Proposal does not bind the supplied planner result.",
    );
  }
  if (
    input.selectedPlan !== null &&
    !input.alternativePlanDigests.includes(input.selectedPlan.planDigest)
  ) {
    return failDemonstration(
      "selected_plan_lineage_mismatch",
      "Selected plan is absent from the bounded returned-plan set.",
    );
  }
  const proposalOutcome =
    input.outcome === "proposal_accepted" || input.outcome === "proposal_rejected";
  if (proposalOutcome !== (input.plannerStatus === "planned")) {
    return failDemonstration(
      "planner_result_mismatch",
      "Evidence outcome does not match planner status.",
    );
  }
  if ((input.plannerStatus === "planned") !== (input.selectedPlan !== null)) {
    return failDemonstration(
      "selected_plan_lineage_mismatch",
      "Planner status and selected-plan presence do not match.",
    );
  }
  return freezeDeep({
    ...input,
    recordId: requireIdentity(input.recordId, "recordId"),
    schemaId: requireIdentity(input.schemaId, "schemaId"),
    schemaVersion: requireIdentity(input.schemaVersion, "schemaVersion"),
    recordedAt: requireTimestamp(input.recordedAt),
    recorderId: requireIdentity(input.recorderId, "recorderId"),
    observationId: requireIdentity(input.observationId, "observationId"),
    observationDigest: requireDigest(input.observationDigest, "observationDigest"),
    legalActionSetId: requireIdentity(input.legalActionSetId, "legalActionSetId"),
    legalActionSetDigest: requireDigest(input.legalActionSetDigest, "legalActionSetDigest"),
    plannerRequestId: requireIdentity(input.plannerRequestId, "plannerRequestId"),
    plannerRequestDigest: requireDigest(input.plannerRequestDigest, "plannerRequestDigest"),
    plannerResultId: requireIdentity(input.plannerResultId, "plannerResultId"),
    plannerResultDigest: requireDigest(input.plannerResultDigest, "plannerResultDigest"),
    reconstructionPolicyId: requireIdentity(input.reconstructionPolicyId, "reconstructionPolicyId"),
    reconstructionPolicyVersion: requireIdentity(
      input.reconstructionPolicyVersion,
      "reconstructionPolicyVersion",
    ),
    limitations: requireBoundedStrings(
      input.limitations,
      DEMONSTRATION_MAXIMA.limitations,
      "limitations",
    ),
    duplicateFamilyId: requireIdentity(input.duplicateFamilyId, "duplicateFamilyId"),
    partitionFamilyId: requireIdentity(input.partitionFamilyId, "partitionFamilyId"),
    alternativePlanDigests: Object.freeze(
      input.alternativePlanDigests.map((digest) => requireDigest(digest, "alternativePlanDigest")),
    ),
  });
}
