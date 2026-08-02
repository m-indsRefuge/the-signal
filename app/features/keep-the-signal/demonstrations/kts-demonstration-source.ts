import type {
  LegalActionSet,
  PlannerResult,
  PlanningRequest,
  SimulatedState,
} from "../../intelligence-harness/planning";
import {
  createSourceLineage,
  type DemonstrationSourceLineage,
} from "../../intelligence-harness/demonstrations";

export interface KtsDemonstrationSourceInput {
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly scenarioFamilyId: string;
  readonly partitionFamilyId: string;
  readonly plannerImplementationId: string;
  readonly observation: SimulatedState;
  readonly legalActions: LegalActionSet;
  readonly request: PlanningRequest;
  readonly result: PlannerResult;
  readonly sourceReferences: readonly string[];
}

export function createKtsDemonstrationSource(
  input: KtsDemonstrationSourceInput,
): DemonstrationSourceLineage {
  return createSourceLineage({
    domainId: "keep-the-signal",
    domainVersion: "kts-i4-j",
    engineVersion: input.engineVersion,
    rulesetVersion: input.rulesetVersion,
    observationSchemaId: "kts-planning-observation",
    observationSchemaVersion: input.request.observationSchemaVersion,
    observationLevel: "planning",
    scenarioFamilyId: input.scenarioFamilyId,
    partitionFamilyId: input.partitionFamilyId,
    seedIdentity: input.request.seedIdentity,
    plannerContractId: "kts-i4-i-bounded-planning-strategist",
    plannerContractVersion: "1",
    plannerImplementationId: input.plannerImplementationId,
    simulationContractId: "kts-planning-simulation",
    simulationContractVersion: input.request.simulatorVersion,
    scoringPolicyId: input.request.scoringPolicy.policyId,
    scoringPolicyVersion: input.request.scoringPolicy.policyVersion,
    riskPolicyId: input.request.riskPolicy.policyId,
    riskPolicyVersion: input.request.riskPolicy.policyVersion,
    tieBreakPolicyId: "kts-planning-tie-break",
    tieBreakPolicyVersion: input.request.tieBreakPolicyVersion,
    proposalProjectorId: "kts-planning-proposal-projector",
    proposalProjectorVersion: "1",
    proposalValidatorId: "kts-deterministic-proposal-validator",
    proposalValidatorVersion: "1",
    sourceReferences: input.sourceReferences,
  });
}
