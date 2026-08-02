import type {
  LegalActionSet,
  PlannerResult,
  PlanningRequest,
  SimulatedState,
} from "../../intelligence-harness/planning";
import {
  DemonstrationEvidenceController,
  createEvidenceInput,
  type DemonstrationEvidenceRecord,
  type DemonstrationOutcome,
  type ProposalEvidence,
  type ValidatorEvidence,
} from "../../intelligence-harness/demonstrations";
import type { KtsPlanningProposalCandidate } from "../planning";
import { createKtsDemonstrationSource } from "./kts-demonstration-source";
import { projectKtsSelectedPlanEvidence } from "./kts-plan-evidence-projector";
import { classifyKtsEvidence } from "./kts-quality-policy";
import {
  createKtsProposalEvidence,
  createKtsValidatorEvidence,
  type KtsProposalValidationReport,
} from "./kts-validator-evidence";

export interface KtsDemonstrationRequest {
  readonly recordId: string;
  readonly recordedAt: string;
  readonly recorderId: string;
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly scenarioFamilyId: string;
  readonly partitionFamilyId: string;
  readonly plannerImplementationId: string;
  readonly observation: SimulatedState;
  readonly legalActions: LegalActionSet;
  readonly plannerRequest: PlanningRequest;
  readonly plannerResult: PlannerResult;
  readonly proposal: KtsPlanningProposalCandidate | null;
  readonly validationReport: KtsProposalValidationReport | null;
  readonly sourceReferences: readonly string[];
  readonly limitations: readonly string[];
  readonly cancelled: boolean;
}

export class KtsDemonstrationController {
  readonly #controller = new DemonstrationEvidenceController();

  get disposed(): boolean {
    return this.#controller.disposed;
  }

  generate(request: KtsDemonstrationRequest): DemonstrationEvidenceRecord {
    const sourceLineage = createKtsDemonstrationSource({
      engineVersion: request.engineVersion,
      rulesetVersion: request.rulesetVersion,
      scenarioFamilyId: request.scenarioFamilyId,
      partitionFamilyId: request.partitionFamilyId,
      plannerImplementationId: request.plannerImplementationId,
      observation: request.observation,
      legalActions: request.legalActions,
      request: request.plannerRequest,
      result: request.plannerResult,
      sourceReferences: request.sourceReferences,
    });
    const selectedPlan = projectKtsSelectedPlanEvidence(request.plannerResult);
    const proposalEvidence: ProposalEvidence | null =
      request.proposal === null ? null : createKtsProposalEvidence(request.proposal);
    const validatorEvidence: ValidatorEvidence | null =
      request.proposal === null || request.validationReport === null
        ? null
        : createKtsValidatorEvidence(request.proposal, request.validationReport);
    const outcome = determineOutcome(request.plannerResult, validatorEvidence);
    const policy = classifyKtsEvidence({
      hasProposal: proposalEvidence !== null,
      hasValidator: validatorEvidence !== null,
      validatorRejected: validatorEvidence?.decision === "rejected",
      blockingPlannerRisk: selectedPlan?.blocked ?? false,
      reconstructable: true,
      truncated: false,
      duplicate: false,
      conflictingDuplicate: false,
    });
    const input = createEvidenceInput({
      recordId: request.recordId,
      schemaId: "kts-planner-demonstration-evidence",
      schemaVersion: "1",
      recordedAt: request.recordedAt,
      recorderId: request.recorderId,
      outcome,
      sourceLineage,
      observationId: request.observation.stateId,
      observationDigest: request.observation.stateDigest,
      legalActionSetId: `${request.observation.stateId}-legal-actions`,
      legalActionSetDigest: request.legalActions.digest,
      plannerRequestId: request.plannerRequest.requestId,
      plannerRequestDigest: request.plannerRequest.requestDigest,
      plannerResultId: `${request.plannerRequest.requestId}-result`,
      plannerResultDigest: request.plannerResult.resultDigest,
      plannerStatus: request.plannerResult.status,
      plannerBudget: request.plannerResult.budget,
      candidateExpansions: request.plannerResult.budgetConsumption.candidateExpansions,
      simulationCalls: request.plannerResult.budgetConsumption.simulationCalls,
      retainedCandidates: request.plannerResult.budgetConsumption.retainedCandidates,
      selectedPlan,
      alternativePlanDigests: request.plannerResult.rankedPlans.map((plan) => plan.planDigest),
      proposal: proposalEvidence,
      validator: validatorEvidence,
      reconstructionPolicyId: "kts-demonstration-reconstruction",
      reconstructionPolicyVersion: "1",
      limitations: request.limitations,
      duplicateFamilyId: request.scenarioFamilyId,
      partitionFamilyId: request.partitionFamilyId,
      truncated: false,
      cancelled: request.cancelled,
    });
    return this.#controller.generate({
      input,
      qualityFacts: {
        schemaComplete: policy.qualityLabels.includes("schema_complete"),
        lineageComplete: policy.qualityLabels.includes("lineage_complete"),
        legalActionSetBound: true,
        plannerResultBound: true,
        proposalProjectionBound: proposalEvidence !== null,
        validatorResultBound: validatorEvidence !== null,
        reconstructable: true,
        truncated: false,
        humanReviewPresent: false,
        outcomeEvidencePresent: false,
      },
      riskFacts: {
        validatorRejected: validatorEvidence?.decision === "rejected",
        blockingPlannerRisk: selectedPlan?.blocked ?? false,
        lineageMismatch: false,
        digestMismatch: false,
        versionMismatch: false,
        reconstructable: true,
        truncated: false,
        duplicate: false,
        conflictingDuplicate: false,
        reviewRequired: true,
      },
    });
  }

  dispose(): void {
    this.#controller.dispose();
  }
}

function determineOutcome(
  result: PlannerResult,
  validator: ValidatorEvidence | null,
): DemonstrationOutcome {
  switch (result.status) {
    case "planned":
      return validator?.decision === "accepted" ? "proposal_accepted" : "proposal_rejected";
    case "abstained":
      return "planner_abstained";
    case "budget_exhausted":
      return "planner_budget_exhausted";
    case "cancelled":
      return "planner_cancelled";
    case "rejected":
      return "planner_rejected";
    case "failed":
      return "planner_failed";
  }
}
