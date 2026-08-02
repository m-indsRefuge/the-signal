import {
  ABSENT_AUTHORITY,
  immutableCopy,
  requireIdentity,
  serializedLength,
  sortText,
} from "./admission-contract";
import { fail } from "./failures";
import { computeSampleDigest } from "./sample-digest";
import type { NormalizedSample, SampleProjectionInput } from "./sample-contract";

export const MAX_SAMPLE_SERIALIZED_CHARACTERS = 262_144;

export function projectNormalizedSample(input: SampleProjectionInput): NormalizedSample {
  requireIdentity(input.sampleId, "sampleId");

  const base = {
    sampleId: input.sampleId,
    sampleSchemaId: input.policyBindings.sampleSchemaId,
    sampleSchemaVersion: input.policyBindings.sampleSchemaVersion,
    datasetPurposeId: input.datasetPurposeId,
    evidenceId: input.evidence.evidenceId,
    evidenceDigest: input.evidence.evidenceDigest,
    reviewId: input.review.reviewId,
    reviewDigest: input.review.reviewDigest,
    role: input.role,
    domainId: input.evidence.domainId,
    domainVersion: input.evidence.domainVersion,
    families: input.families,
    seedIdentity: input.evidence.seedIdentity,
    observationId: input.evidence.observationId,
    observationDigest: input.evidence.observationDigest,
    observationProjection: input.evidence.observationProjection,
    legalActionSetDigest: input.evidence.legalActionSetDigest,
    legalActionProjection: [...input.evidence.legalActionProjection],
    plannerRequestId: input.evidence.plannerRequestId,
    plannerRequestDigest: input.evidence.plannerRequestDigest,
    plannerResultId: input.evidence.plannerResultId,
    plannerResultDigest: input.evidence.plannerResultDigest,
    selectedPlan: input.evidence.selectedPlan,
    proposal: input.evidence.proposal,
    proposalDigest: input.evidence.proposalDigest,
    validatorDecision: input.evidence.validatorDecision,
    validatorReasons: sortText(input.evidence.validatorReasons),
    validatorResultDigest: input.evidence.validatorResultDigest,
    qualityLabels: sortText(input.evidence.qualityLabels),
    riskLabels: sortText(input.evidence.riskLabels),
    limitations: sortText(input.evidence.limitations),
    reconstructionStatus: input.evidence.reconstructionStatus,
    policyBindings: input.policyBindings,
    authority: ABSENT_AUTHORITY,
  } as const;

  const sample = {
    ...base,
    sampleDigest: computeSampleDigest(base),
  };

  if (serializedLength(sample) > MAX_SAMPLE_SERIALIZED_CHARACTERS) {
    fail("serialized_size_exceeded", "sample serialized-size budget exceeded");
  }
  return immutableCopy(sample) as NormalizedSample;
}
