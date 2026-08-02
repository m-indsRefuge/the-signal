import {
  ABSENT_AUTHORITY,
  digestCanonical,
  immutableCopy,
  requireIsoTime,
  sortText,
  type AdmissionOutcome,
} from "./admission-contract";
import type { AdmissionRequest } from "./admission-request";
import type { DuplicateResult } from "./deduplication-policy";
import type { EligibilityResult } from "./evidence-eligibility";
import type { LeakageResult } from "./leakage-contract";
import type { PartitionAssignment } from "./partition-contract";
import type { NormalizedSample } from "./sample-contract";
import type { SampleRole } from "./sample-role";

export type AdmissionDecision = Readonly<{
  decisionId: string;
  requestId: string;
  requestDigest: string;
  evidenceId: string;
  evidenceDigest: string;
  reviewId: string;
  reviewDigest: string;
  eligibility: EligibilityResult;
  role?: SampleRole;
  sampleId?: string;
  sampleDigest?: string;
  duplicate: DuplicateResult;
  partition?: PartitionAssignment;
  leakage: LeakageResult;
  outcome: AdmissionOutcome;
  reasonCodes: readonly string[];
  limitations: readonly string[];
  policyBindings: Readonly<Record<string, string>>;
  decidedAt: string;
  authority: typeof ABSENT_AUTHORITY;
  decisionDigest: string;
}>;

export type AdmissionDecisionInput = Readonly<{
  decisionId: string;
  request: AdmissionRequest;
  eligibility: EligibilityResult;
  role?: SampleRole;
  sample?: NormalizedSample;
  duplicate: DuplicateResult;
  partition?: PartitionAssignment;
  leakage: LeakageResult;
  decidedAt: string;
}>;

export function createAdmissionDecision(input: AdmissionDecisionInput): AdmissionDecision {
  requireIsoTime(input.decidedAt, "decidedAt");
  const reasons = [
    ...input.eligibility.reasonCodes,
    ...input.duplicate.reasonCodes,
    ...input.leakage.findings.map((item) => item.code),
  ];

  let outcome: AdmissionOutcome = "admitted";
  if (input.duplicate.status === "conflicting_duplicate") {
    outcome = "conflict";
  } else if (input.eligibility.state === "deferred") {
    outcome = "deferred";
  } else if (input.eligibility.state === "unknown") {
    outcome = "quarantined";
  } else if (input.eligibility.state === "ineligible") {
    outcome = "rejected";
  } else if (input.leakage.state === "blocked") {
    outcome = "rejected";
  } else if (input.leakage.state === "unknown") {
    outcome = "quarantined";
  } else if (!input.sample || !input.partition || !input.role) {
    outcome = "quarantined";
    reasons.push("sample_projection_incomplete");
  }

  const core = {
    decisionId: input.decisionId,
    requestId: input.request.requestId,
    requestDigest: digestCanonical(input.request),
    evidenceId: input.request.evidence.evidenceId,
    evidenceDigest: input.request.evidence.evidenceDigest,
    reviewId: input.request.review.reviewId,
    reviewDigest: input.request.review.reviewDigest,
    eligibility: input.eligibility,
    role: input.role,
    sampleId: input.sample?.sampleId,
    sampleDigest: input.sample?.sampleDigest,
    duplicate: input.duplicate,
    partition: input.partition,
    leakage: input.leakage,
    outcome,
    reasonCodes: sortText(reasons),
    limitations: sortText([
      ...input.eligibility.limitations,
      ...input.request.evidence.limitations,
      ...input.request.review.limitations,
    ]),
    policyBindings: input.request.policies,
    decidedAt: input.decidedAt,
    authority: ABSENT_AUTHORITY,
  };
  return immutableCopy({
    ...core,
    decisionDigest: digestCanonical(core),
  }) as AdmissionDecision;
}
