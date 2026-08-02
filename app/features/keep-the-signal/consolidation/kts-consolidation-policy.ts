import type { EvidenceRecord } from "../../intelligence-harness/memory-fabric/evidence-contract";
import type {
  EpisodicMemoryRecord,
  MemoryEvidenceAttachment,
  MemoryRelationRecord,
} from "../../intelligence-harness/memory-fabric/memory-contract";
import type { ConsolidationValidationClassification } from "../../intelligence-harness/consolidation/consolidation-validator";
import {
  evaluateRetention,
  type RetentionContext,
  type RetentionDecisionReport,
  type RetentionPolicy,
} from "../../intelligence-harness/consolidation/retention-policy";

export const KTS_REFERENCE_RETENTION_POLICY_ID = "kts.reference_retention" as const;
export const KTS_REFERENCE_RETENTION_POLICY_VERSION = "1" as const;

export function createKtsReferenceRetentionPolicy(): Readonly<RetentionPolicy> {
  return Object.freeze({
    policyId: KTS_REFERENCE_RETENTION_POLICY_ID,
    policyVersion: KTS_REFERENCE_RETENTION_POLICY_VERSION,
    minimumSupportCardinality: 2,
    archiveRoutineWithoutTarget: true,
    permitForgettingCandidate: true,
  });
}

function textIncludes(record: Readonly<EvidenceRecord>, token: string): boolean {
  return JSON.stringify(record).toLowerCase().includes(token);
}

export function buildKtsRetentionContext(
  input: Readonly<{
    memory: Readonly<EpisodicMemoryRecord>;
    attachments: readonly Readonly<MemoryEvidenceAttachment>[];
    evidence: readonly Readonly<EvidenceRecord>[];
    relations: readonly Readonly<MemoryRelationRecord>[];
    validationClassification: ConsolidationValidationClassification;
    supportCardinality: number;
    higherLevelTargetAvailable: boolean;
    uniqueFailure?: boolean;
    uniqueCounterexample?: boolean;
    requiredForReproducibility?: boolean;
    soleSupport?: boolean;
    legalStatus?: RetentionContext["legalStatus"];
    consentStatus?: RetentionContext["consentStatus"];
    auditStatus?: RetentionContext["auditStatus"];
  }>,
): Readonly<RetentionContext> {
  const evidenceRoles = input.attachments.map((attachment) => attachment.role);
  const evidenceSourceTypes = input.evidence.map((record) => record.sourceType);
  const contradictionPresent =
    evidenceRoles.includes("contradiction") ||
    input.relations.some((relation) => relation.relationType === "contradicts");
  const correctionPresent =
    evidenceRoles.includes("correction") ||
    evidenceSourceTypes.includes("human_correction") ||
    input.relations.some((relation) => relation.relationType === "corrects");
  const governanceViolation = input.evidence.some(
    (record) => record.sourceType === "governance" && textIncludes(record, "violation"),
  );
  const safetyFailure = input.evidence.some(
    (record) => textIncludes(record, "safety") && textIncludes(record, "failure"),
  );
  const promotionEvidence = input.evidence.some((record) => textIncludes(record, "promotion"));
  const rejectionEvidence = input.evidence.some(
    (record) => record.acceptanceState === "rejected" || textIncludes(record, "rejection"),
  );
  const modelVersionTransition = input.evidence.some(
    (record) => textIncludes(record, "modelversion") || textIncludes(record, "model_version"),
  );
  return Object.freeze({
    memory: input.memory,
    evidenceRoles: Object.freeze(evidenceRoles),
    evidenceSourceTypes: Object.freeze(evidenceSourceTypes),
    validationClassification: input.validationClassification,
    supportCardinality: input.supportCardinality,
    uniqueFailure: input.uniqueFailure ?? false,
    uniqueCounterexample: input.uniqueCounterexample ?? false,
    contradictionPresent,
    correctionPresent,
    governanceViolation,
    safetyFailure,
    promotionEvidence,
    rejectionEvidence,
    modelVersionTransition,
    requiredForReproducibility: input.requiredForReproducibility ?? false,
    soleSupport: input.soleSupport ?? input.supportCardinality <= 1,
    higherLevelTargetAvailable: input.higherLevelTargetAvailable,
    legalStatus: input.legalStatus ?? "unknown",
    consentStatus: input.consentStatus ?? "unknown",
    auditStatus: input.auditStatus ?? "unknown",
  });
}

export function evaluateKtsRetention(
  input: Readonly<{
    policy?: Readonly<RetentionPolicy>;
    context: Readonly<RetentionContext>;
  }>,
): Readonly<RetentionDecisionReport> {
  return evaluateRetention(input.policy ?? createKtsReferenceRetentionPolicy(), input.context);
}
