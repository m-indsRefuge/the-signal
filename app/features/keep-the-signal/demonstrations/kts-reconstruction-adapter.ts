import {
  createReconstructionRequest,
  type DemonstrationEvidenceRecord,
  type ReconstructionRequest,
} from "../../intelligence-harness/demonstrations";

export function createKtsReconstructionRequest(
  requestId: string,
  record: DemonstrationEvidenceRecord,
  unavailable: readonly (keyof ReconstructionRequest["dependencies"])[] = [],
): ReconstructionRequest {
  const dependencies: {
    -readonly [
      K in keyof ReconstructionRequest["dependencies"]
    ]: ReconstructionRequest["dependencies"][K];
  } = {
    sourceLineageDigest: record.sourceLineage.lineageDigest,
    observationDigest: record.observationDigest,
    legalActionSetDigest: record.legalActionSetDigest,
    plannerRequestDigest: record.plannerRequestDigest,
    plannerResultDigest: record.plannerResultDigest,
    selectedPlanDigest: record.selectedPlan?.planDigest ?? null,
    proposalDigest: record.proposal?.proposalDigest ?? null,
    validatorResultDigest: record.validator?.validatorResultDigest ?? null,
    evidenceRecordDigest: record.recordDigest,
  };
  for (const key of unavailable) dependencies[key] = null;
  return createReconstructionRequest({
    requestId,
    policyId: "kts-demonstration-reconstruction",
    policyVersion: "1",
    maximumMismatchReasons: 64,
    dependencies,
  });
}
