import { immutableCopy, requireIdentity, requireIsoTime, sortText } from "./admission-contract";

export type EvidenceOutcome =
  | "proposal_accepted"
  | "proposal_rejected"
  | "planner_abstained"
  | "planner_budget_exhausted"
  | "planner_cancelled"
  | "planner_rejected"
  | "planner_failed";

export type EvidenceReconstructionStatus = "pass" | "fail" | "unknown";

export type ReviewDecision =
  "accepted_for_further_evaluation" | "rejected" | "deferred" | "needs_more_evidence";

export type AdmissionEvidence = Readonly<{
  schemaId: string;
  schemaVersion: string;
  evidenceId: string;
  evidenceDigest: string;
  outcome: EvidenceOutcome;
  domainId: string;
  domainVersion: string;
  scenarioFamilyId: string;
  episodeFamilyId?: string;
  duplicateFamilyId: string;
  partitionFamilyId: string;
  provenanceFamilyId: string;
  seedIdentity: string;
  observationId: string;
  observationDigest: string;
  observationProjection: unknown;
  legalActionSetDigest: string;
  legalActionProjection: readonly unknown[];
  plannerRequestId: string;
  plannerRequestDigest: string;
  plannerResultId: string;
  plannerResultDigest: string;
  selectedPlan?: unknown;
  proposal?: unknown;
  proposalDigest?: string;
  validatorDecision?: "accepted" | "rejected";
  validatorReasons: readonly string[];
  validatorResultDigest?: string;
  qualityLabels: readonly string[];
  riskLabels: readonly string[];
  limitations: readonly string[];
  reconstructionStatus: EvidenceReconstructionStatus;
  declaredTruncation: boolean;
}>;

export type AdmissionReview = Readonly<{
  reviewId: string;
  reviewDigest: string;
  evidenceId: string;
  evidenceDigest: string;
  reviewerId: string;
  decision: ReviewDecision;
  policyId: string;
  policyVersion: string;
  reviewedAt: string;
  reasonCodes: readonly string[];
  limitations: readonly string[];
}>;

export type AdmissionPolicyBindings = Readonly<{
  eligibilityPolicyId: string;
  eligibilityPolicyVersion: string;
  sampleRolePolicyId: string;
  sampleRolePolicyVersion: string;
  sampleSchemaId: string;
  sampleSchemaVersion: string;
  duplicatePolicyId: string;
  duplicatePolicyVersion: string;
  familyPolicyId: string;
  familyPolicyVersion: string;
  partitionPolicyId: string;
  partitionPolicyVersion: string;
  leakagePolicyId: string;
  leakagePolicyVersion: string;
  manifestPolicyId: string;
  manifestPolicyVersion: string;
}>;

export type AdmissionRequest = Readonly<{
  requestId: string;
  requestedAt: string;
  datasetPurposeId: string;
  evidence: AdmissionEvidence;
  review: AdmissionReview;
  policies: AdmissionPolicyBindings;
}>;

export function createAdmissionRequest(request: AdmissionRequest): AdmissionRequest {
  requireIdentity(request.requestId, "requestId");
  requireIsoTime(request.requestedAt, "requestedAt");
  requireIdentity(request.datasetPurposeId, "datasetPurposeId");

  const evidence = request.evidence;
  for (const [label, value] of [
    ["evidence.schemaId", evidence.schemaId],
    ["evidence.schemaVersion", evidence.schemaVersion],
    ["evidence.evidenceId", evidence.evidenceId],
    ["evidence.evidenceDigest", evidence.evidenceDigest],
    ["evidence.domainId", evidence.domainId],
    ["evidence.domainVersion", evidence.domainVersion],
    ["evidence.scenarioFamilyId", evidence.scenarioFamilyId],
    ["evidence.duplicateFamilyId", evidence.duplicateFamilyId],
    ["evidence.partitionFamilyId", evidence.partitionFamilyId],
    ["evidence.provenanceFamilyId", evidence.provenanceFamilyId],
    ["evidence.seedIdentity", evidence.seedIdentity],
    ["evidence.observationId", evidence.observationId],
    ["evidence.observationDigest", evidence.observationDigest],
    ["evidence.legalActionSetDigest", evidence.legalActionSetDigest],
    ["evidence.plannerRequestId", evidence.plannerRequestId],
    ["evidence.plannerRequestDigest", evidence.plannerRequestDigest],
    ["evidence.plannerResultId", evidence.plannerResultId],
    ["evidence.plannerResultDigest", evidence.plannerResultDigest],
  ] as const) {
    requireIdentity(value, label);
  }

  const review = request.review;
  for (const [label, value] of [
    ["review.reviewId", review.reviewId],
    ["review.reviewDigest", review.reviewDigest],
    ["review.evidenceId", review.evidenceId],
    ["review.evidenceDigest", review.evidenceDigest],
    ["review.reviewerId", review.reviewerId],
    ["review.policyId", review.policyId],
    ["review.policyVersion", review.policyVersion],
  ] as const) {
    requireIdentity(value, label);
  }
  requireIsoTime(review.reviewedAt, "review.reviewedAt");

  for (const [label, value] of Object.entries(request.policies)) {
    requireIdentity(value, `policies.${label}`);
  }

  return immutableCopy({
    ...request,
    evidence: {
      ...evidence,
      qualityLabels: sortText(evidence.qualityLabels),
      riskLabels: sortText(evidence.riskLabels),
      limitations: sortText(evidence.limitations),
      validatorReasons: sortText(evidence.validatorReasons),
      legalActionProjection: [...evidence.legalActionProjection],
    },
    review: {
      ...review,
      reasonCodes: sortText(review.reasonCodes),
      limitations: sortText(review.limitations),
    },
  }) as AdmissionRequest;
}
