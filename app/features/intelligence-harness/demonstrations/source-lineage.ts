import {
  DEMONSTRATION_MAXIMA,
  requireBoundedStrings,
  requireDigest,
  requireIdentity,
} from "./demonstration-contract";
import { evidenceDigest, freezeDeep } from "./evidence-digest";

export interface DemonstrationSourceLineageInput {
  readonly domainId: string;
  readonly domainVersion: string;
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly observationSchemaId: string;
  readonly observationSchemaVersion: string;
  readonly observationLevel: string;
  readonly scenarioFamilyId: string;
  readonly partitionFamilyId: string;
  readonly seedIdentity: string;
  readonly plannerContractId: string;
  readonly plannerContractVersion: string;
  readonly plannerImplementationId: string;
  readonly simulationContractId: string;
  readonly simulationContractVersion: string;
  readonly scoringPolicyId: string;
  readonly scoringPolicyVersion: string;
  readonly riskPolicyId: string;
  readonly riskPolicyVersion: string;
  readonly tieBreakPolicyId: string;
  readonly tieBreakPolicyVersion: string;
  readonly proposalProjectorId: string;
  readonly proposalProjectorVersion: string;
  readonly proposalValidatorId: string;
  readonly proposalValidatorVersion: string;
  readonly sourceReferences: readonly string[];
}

export interface DemonstrationSourceLineage extends DemonstrationSourceLineageInput {
  readonly lineageDigest: string;
}

export function createSourceLineage(
  input: DemonstrationSourceLineageInput,
): DemonstrationSourceLineage {
  const body = {
    domainId: requireIdentity(input.domainId, "domainId"),
    domainVersion: requireIdentity(input.domainVersion, "domainVersion"),
    engineVersion: requireIdentity(input.engineVersion, "engineVersion"),
    rulesetVersion: requireIdentity(input.rulesetVersion, "rulesetVersion"),
    observationSchemaId: requireIdentity(input.observationSchemaId, "observationSchemaId"),
    observationSchemaVersion: requireIdentity(
      input.observationSchemaVersion,
      "observationSchemaVersion",
    ),
    observationLevel: requireIdentity(input.observationLevel, "observationLevel"),
    scenarioFamilyId: requireIdentity(input.scenarioFamilyId, "scenarioFamilyId"),
    partitionFamilyId: requireIdentity(input.partitionFamilyId, "partitionFamilyId"),
    seedIdentity: requireIdentity(input.seedIdentity, "seedIdentity"),
    plannerContractId: requireIdentity(input.plannerContractId, "plannerContractId"),
    plannerContractVersion: requireIdentity(input.plannerContractVersion, "plannerContractVersion"),
    plannerImplementationId: requireIdentity(
      input.plannerImplementationId,
      "plannerImplementationId",
    ),
    simulationContractId: requireIdentity(input.simulationContractId, "simulationContractId"),
    simulationContractVersion: requireIdentity(
      input.simulationContractVersion,
      "simulationContractVersion",
    ),
    scoringPolicyId: requireIdentity(input.scoringPolicyId, "scoringPolicyId"),
    scoringPolicyVersion: requireIdentity(input.scoringPolicyVersion, "scoringPolicyVersion"),
    riskPolicyId: requireIdentity(input.riskPolicyId, "riskPolicyId"),
    riskPolicyVersion: requireIdentity(input.riskPolicyVersion, "riskPolicyVersion"),
    tieBreakPolicyId: requireIdentity(input.tieBreakPolicyId, "tieBreakPolicyId"),
    tieBreakPolicyVersion: requireIdentity(input.tieBreakPolicyVersion, "tieBreakPolicyVersion"),
    proposalProjectorId: requireIdentity(input.proposalProjectorId, "proposalProjectorId"),
    proposalProjectorVersion: requireIdentity(
      input.proposalProjectorVersion,
      "proposalProjectorVersion",
    ),
    proposalValidatorId: requireIdentity(input.proposalValidatorId, "proposalValidatorId"),
    proposalValidatorVersion: requireIdentity(
      input.proposalValidatorVersion,
      "proposalValidatorVersion",
    ),
    sourceReferences: requireBoundedStrings(
      input.sourceReferences,
      DEMONSTRATION_MAXIMA.sourceLineageReferences,
      "sourceReferences",
    ),
  };
  const frozen = freezeDeep(body);
  return freezeDeep({ ...frozen, lineageDigest: evidenceDigest(frozen) });
}

export function verifySourceLineageDigest(lineage: DemonstrationSourceLineage): boolean {
  const { lineageDigest, ...body } = lineage;
  requireDigest(lineageDigest, "lineageDigest");
  return evidenceDigest(body) === lineageDigest;
}
