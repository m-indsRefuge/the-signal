import {
  deriveEvidenceRiskLabels,
  deriveQualityLabels,
  type EvidenceRiskLabel,
  type QualityLabel,
} from "../../intelligence-harness/demonstrations";

export interface KtsEvidencePolicyInput {
  readonly hasProposal: boolean;
  readonly hasValidator: boolean;
  readonly validatorRejected: boolean;
  readonly blockingPlannerRisk: boolean;
  readonly reconstructable: boolean | null;
  readonly truncated: boolean;
  readonly duplicate: boolean;
  readonly conflictingDuplicate: boolean;
}

export function classifyKtsEvidence(input: KtsEvidencePolicyInput): Readonly<{
  qualityLabels: readonly QualityLabel[];
  riskLabels: readonly EvidenceRiskLabel[];
}> {
  return Object.freeze({
    qualityLabels: deriveQualityLabels({
      schemaComplete: true,
      lineageComplete: true,
      legalActionSetBound: true,
      plannerResultBound: true,
      proposalProjectionBound: input.hasProposal,
      validatorResultBound: input.hasValidator,
      reconstructable: input.reconstructable,
      truncated: input.truncated,
      humanReviewPresent: false,
      outcomeEvidencePresent: false,
    }),
    riskLabels: deriveEvidenceRiskLabels({
      validatorRejected: input.validatorRejected,
      blockingPlannerRisk: input.blockingPlannerRisk,
      lineageMismatch: false,
      digestMismatch: false,
      versionMismatch: false,
      reconstructable: input.reconstructable,
      truncated: input.truncated,
      duplicate: input.duplicate,
      conflictingDuplicate: input.conflictingDuplicate,
      reviewRequired: true,
    }),
  });
}
