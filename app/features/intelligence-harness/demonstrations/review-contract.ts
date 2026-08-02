import {
  DATASET_ADMISSION_STATES,
  DEMONSTRATION_MAXIMA,
  requireBoundedStringSequence,
  requireBoundedStrings,
  requireDigest,
  requireIdentity,
  requireTimestamp,
} from "./demonstration-contract";
import { freezeDeep } from "./evidence-digest";
import { failDemonstration } from "./failures";

export const REVIEW_DECISIONS = [
  "accepted_for_further_evaluation",
  "rejected",
  "deferred",
  "needs_more_evidence",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface ReviewRecordInput {
  readonly reviewId: string;
  readonly evidenceRecordId: string;
  readonly evidenceRecordDigest: string;
  readonly reviewerId: string;
  readonly decision: ReviewDecision;
  readonly reasonCodes: readonly string[];
  readonly rationaleReferences: readonly string[];
  readonly reviewedAt: string;
  readonly reviewPolicyId: string;
  readonly reviewPolicyVersion: string;
  readonly limitations: readonly string[];
}

export function validateReviewInput(input: ReviewRecordInput): ReviewRecordInput {
  if (!REVIEW_DECISIONS.includes(input.decision)) {
    return failDemonstration("invalid_schema", "Review decision is unsupported.");
  }
  if (!DATASET_ADMISSION_STATES.includes("not_performed")) {
    return failDemonstration("invalid_schema", "Dataset-admission boundary invariant failed.");
  }
  return freezeDeep({
    ...input,
    reviewId: requireIdentity(input.reviewId, "reviewId"),
    evidenceRecordId: requireIdentity(input.evidenceRecordId, "evidenceRecordId"),
    evidenceRecordDigest: requireDigest(input.evidenceRecordDigest, "evidenceRecordDigest"),
    reviewerId: requireIdentity(input.reviewerId, "reviewerId"),
    reasonCodes: requireBoundedStringSequence(
      input.reasonCodes,
      DEMONSTRATION_MAXIMA.reviewReasonCodes,
      "reviewReasonCodes",
    ),
    rationaleReferences: requireBoundedStringSequence(
      input.rationaleReferences,
      DEMONSTRATION_MAXIMA.reviewRationaleReferences,
      "reviewRationaleReferences",
    ),
    reviewedAt: requireTimestamp(input.reviewedAt),
    reviewPolicyId: requireIdentity(input.reviewPolicyId, "reviewPolicyId"),
    reviewPolicyVersion: requireIdentity(input.reviewPolicyVersion, "reviewPolicyVersion"),
    limitations: requireBoundedStrings(
      input.limitations,
      DEMONSTRATION_MAXIMA.limitations,
      "reviewLimitations",
    ),
  });
}
