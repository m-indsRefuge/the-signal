import type { AdmissionRequest } from "./admission-request";
import { createEligibilityResult, type EligibilityResult } from "./evidence-eligibility";

export type EligibilityPolicy = Readonly<{
  policyId: string;
  policyVersion: string;
  supportedEvidenceSchemas: readonly string[];
  supportedReviewPolicies: readonly string[];
  requiredQualityLabels: readonly string[];
  blockingRiskLabels: readonly string[];
  allowDeclaredTruncation: boolean;
}>;

export const DEFAULT_ELIGIBILITY_POLICY: EligibilityPolicy = Object.freeze({
  policyId: "kts-i4-k.eligibility",
  policyVersion: "1.0.0",
  supportedEvidenceSchemas: Object.freeze(["kts-i4-j.demonstration-evidence@1.0.0"]),
  supportedReviewPolicies: Object.freeze(["kts-i4-j.review@1.0.0"]),
  requiredQualityLabels: Object.freeze([
    "schema_complete",
    "lineage_complete",
    "legal_action_set_bound",
    "planner_result_bound",
    "deterministically_reconstructable",
  ]),
  blockingRiskLabels: Object.freeze([
    "validator_rejected",
    "blocking_planner_risk",
    "lineage_mismatch",
    "digest_mismatch",
    "version_mismatch",
    "unreconstructable",
    "conflicting_duplicate",
    "risk_unknown",
  ]),
  allowDeclaredTruncation: false,
});

export function evaluateEligibility(
  request: AdmissionRequest,
  policy: EligibilityPolicy,
): EligibilityResult {
  const reasons: string[] = [];
  const limitations: string[] = [];

  const evidenceSchema = `${request.evidence.schemaId}@${request.evidence.schemaVersion}`;
  if (!policy.supportedEvidenceSchemas.includes(evidenceSchema)) {
    reasons.push("unsupported_evidence_schema");
  }

  const reviewPolicy = `${request.review.policyId}@${request.review.policyVersion}`;
  if (!policy.supportedReviewPolicies.includes(reviewPolicy)) {
    reasons.push("unsupported_review_policy");
  }

  if (request.review.evidenceId !== request.evidence.evidenceId) {
    reasons.push("review_evidence_identity_mismatch");
  }
  if (request.review.evidenceDigest !== request.evidence.evidenceDigest) {
    reasons.push("review_evidence_digest_mismatch");
  }

  if (request.review.decision !== "accepted_for_further_evaluation") {
    reasons.push(`review_${request.review.decision}`);
  }

  for (const label of policy.requiredQualityLabels) {
    if (!request.evidence.qualityLabels.includes(label)) {
      reasons.push(`missing_quality:${label}`);
    }
  }

  for (const label of policy.blockingRiskLabels) {
    if (request.evidence.riskLabels.includes(label)) {
      reasons.push(`blocking_risk:${label}`);
    }
  }

  if (request.evidence.reconstructionStatus === "fail") {
    reasons.push("reconstruction_failed");
  } else if (request.evidence.reconstructionStatus === "unknown") {
    reasons.push("reconstruction_unknown");
  }

  if (request.evidence.declaredTruncation) {
    limitations.push("declared_truncation");
    if (!policy.allowDeclaredTruncation) {
      reasons.push("truncation_not_allowed");
    }
  }

  let state: EligibilityResult["state"] = "eligible";
  if (
    reasons.some(
      (reason) =>
        reason.startsWith("review_deferred") || reason.startsWith("review_needs_more_evidence"),
    )
  ) {
    state = "deferred";
  } else if (reasons.includes("reconstruction_unknown")) {
    state = "unknown";
  } else if (reasons.length > 0) {
    state = "ineligible";
  }

  return createEligibilityResult({
    state,
    reasonCodes: reasons,
    limitations,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
  });
}
