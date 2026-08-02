import { deepFreezeJson, type JsonObject } from "../memory-fabric/canonical-json";
import type { EvidenceSourceType } from "../memory-fabric/evidence-contract";
import type { EpisodicMemoryRecord, MemoryEvidenceRole } from "../memory-fabric/memory-contract";
import type { ConsolidationValidationClassification } from "./consolidation-validator";
import { failConsolidation, validateConsolidationIdentity } from "./failures";

export const RETENTION_DECISIONS = Object.freeze([
  "retain",
  "protected",
  "archive_candidate",
  "forgetting_candidate",
  "consolidation_rejected",
] as const);
export type RetentionDecision = (typeof RETENTION_DECISIONS)[number];

export const PROTECTED_REASON_CODES = Object.freeze([
  "governance_violation",
  "safety_failure",
  "unique_failure",
  "unique_counterexample",
  "human_correction",
  "contradiction",
  "benchmark",
  "training_lineage",
  "promotion_evidence",
  "rejection_evidence",
  "model_version_transition",
  "reproducibility_required",
  "sole_support",
  "protected_retention",
  "unknown_legal_status",
  "unknown_consent_status",
  "unknown_audit_status",
] as const);
export type ProtectedReasonCode = (typeof PROTECTED_REASON_CODES)[number];

export interface RetentionPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly minimumSupportCardinality: number;
  readonly archiveRoutineWithoutTarget: boolean;
  readonly permitForgettingCandidate: boolean;
}

export interface RetentionContext {
  readonly memory: Readonly<EpisodicMemoryRecord>;
  readonly evidenceRoles: readonly MemoryEvidenceRole[];
  readonly evidenceSourceTypes: readonly EvidenceSourceType[];
  readonly validationClassification: ConsolidationValidationClassification;
  readonly supportCardinality: number;
  readonly uniqueFailure: boolean;
  readonly uniqueCounterexample: boolean;
  readonly contradictionPresent: boolean;
  readonly correctionPresent: boolean;
  readonly governanceViolation: boolean;
  readonly safetyFailure: boolean;
  readonly promotionEvidence: boolean;
  readonly rejectionEvidence: boolean;
  readonly modelVersionTransition: boolean;
  readonly requiredForReproducibility: boolean;
  readonly soleSupport: boolean;
  readonly higherLevelTargetAvailable: boolean;
  readonly legalStatus: "known_permitted" | "known_restricted" | "unknown";
  readonly consentStatus: "known_permitted" | "known_restricted" | "unknown";
  readonly auditStatus: "complete" | "incomplete" | "unknown";
}

export interface RetentionDecisionReport {
  readonly memoryId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly decision: RetentionDecision;
  readonly protectedReasons: readonly ProtectedReasonCode[];
  readonly passedConditions: readonly string[];
  readonly failedConditions: readonly string[];
}

export function validateRetentionPolicy(policy: Readonly<RetentionPolicy>): void {
  validateConsolidationIdentity(
    policy.policyId,
    "policyId",
    "invalid_retention_policy",
    "retention",
  );
  validateConsolidationIdentity(
    policy.policyVersion,
    "policyVersion",
    "invalid_retention_policy",
    "retention",
  );
  if (
    !Number.isSafeInteger(policy.minimumSupportCardinality) ||
    policy.minimumSupportCardinality < 2
  ) {
    failConsolidation(
      "invalid_retention_policy",
      "retention",
      "Retention policy support threshold is invalid.",
    );
  }
}

export function evaluateRetention(
  policy: Readonly<RetentionPolicy>,
  context: Readonly<RetentionContext>,
): Readonly<RetentionDecisionReport> {
  validateRetentionPolicy(policy);
  const reasons: ProtectedReasonCode[] = [];
  if (context.governanceViolation) reasons.push("governance_violation");
  if (context.safetyFailure) reasons.push("safety_failure");
  if (context.uniqueFailure) reasons.push("unique_failure");
  if (context.uniqueCounterexample) reasons.push("unique_counterexample");
  if (context.correctionPresent || context.evidenceSourceTypes.includes("human_correction"))
    reasons.push("human_correction");
  if (context.contradictionPresent || context.evidenceRoles.includes("contradiction"))
    reasons.push("contradiction");
  if (context.memory.significance === "benchmark" || context.memory.retentionClass === "benchmark")
    reasons.push("benchmark");
  if (context.memory.retentionClass === "training_lineage") reasons.push("training_lineage");
  if (context.promotionEvidence) reasons.push("promotion_evidence");
  if (context.rejectionEvidence) reasons.push("rejection_evidence");
  if (context.modelVersionTransition) reasons.push("model_version_transition");
  if (context.requiredForReproducibility) reasons.push("reproducibility_required");
  if (context.soleSupport) reasons.push("sole_support");
  if (context.memory.retentionClass === "protected") reasons.push("protected_retention");
  if (context.legalStatus === "unknown") reasons.push("unknown_legal_status");
  if (context.consentStatus === "unknown") reasons.push("unknown_consent_status");
  if (context.auditStatus !== "complete") reasons.push("unknown_audit_status");

  const protectedReasons = [...new Set(reasons)].sort();
  const passed: string[] = [];
  const failed: string[] = [];
  let decision: RetentionDecision;
  if (protectedReasons.length > 0) {
    decision = "protected";
    failed.push("protected_class");
  } else if (context.validationClassification === "candidate_rejected") {
    decision = "consolidation_rejected";
    failed.push("candidate_rejected");
  } else if (
    policy.permitForgettingCandidate &&
    context.higherLevelTargetAvailable &&
    context.supportCardinality >= policy.minimumSupportCardinality &&
    context.memory.significance === "routine"
  ) {
    decision = "forgetting_candidate";
    passed.push("redundant_support", "preservation_target_available");
  } else if (policy.archiveRoutineWithoutTarget && context.memory.significance === "routine") {
    decision = "archive_candidate";
    passed.push("routine_archive_candidate");
  } else {
    decision = "retain";
    passed.push("retention_required");
  }

  return deepFreezeJson({
    memoryId: context.memory.memoryId,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    decision,
    protectedReasons,
    passedConditions: passed,
    failedConditions: failed,
  } as unknown as JsonObject) as unknown as Readonly<RetentionDecisionReport>;
}
