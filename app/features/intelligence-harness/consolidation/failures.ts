import { isCanonicalUtcTimestamp, isPublicIdentity } from "../memory-fabric/evidence-contract";

export const CONSOLIDATION_FAILURE_CODES = Object.freeze([
  "invalid_consolidation_request",
  "invalid_source",
  "source_not_authorized",
  "source_query_failed",
  "selection_budget_exceeded",
  "invalid_snapshot",
  "snapshot_digest_mismatch",
  "invalid_feature_record",
  "invalid_cluster_policy",
  "cluster_budget_exceeded",
  "invalid_cluster",
  "invalid_abstraction",
  "abstraction_digest_mismatch",
  "invalid_evidence_matrix",
  "missing_required_evidence",
  "unresolved_contradiction",
  "unsupported_confidence",
  "invalid_preservation_target",
  "invalid_preservation_map",
  "information_not_preserved",
  "invalid_retention_policy",
  "protected_record",
  "invalid_forgetting_request",
  "invalid_virtual_view",
  "reconstruction_failed",
  "retrieval_quality_failed",
  "lineage_verification_failed",
  "reproducibility_failed",
  "forgetting_ineligible",
  "invalid_tombstone_draft",
  "consolidation_cancelled",
  "consolidation_disposed",
  "consolidation_internal_failure",
] as const);

export type ConsolidationFailureCode = (typeof CONSOLIDATION_FAILURE_CODES)[number];

export const CONSOLIDATION_FAILURE_STAGES = Object.freeze([
  "request_validation",
  "source",
  "selection",
  "snapshot",
  "feature_projection",
  "clustering",
  "abstraction",
  "evidence_matrix",
  "candidate_validation",
  "retention",
  "preservation",
  "virtual_view",
  "reconstruction",
  "retrieval_quality",
  "lineage",
  "reproducibility",
  "forgetting",
  "tombstone",
  "coordination",
] as const);

export type ConsolidationFailureStage = (typeof CONSOLIDATION_FAILURE_STAGES)[number];

export interface ConsolidationFailureDetails {
  readonly requestId?: string;
  readonly snapshotId?: string;
  readonly candidateId?: string;
  readonly memoryId?: string;
  readonly evaluationId?: string;
  readonly diagnostics?: Readonly<Record<string, string | number | boolean>>;
}

export class ConsolidationFailure extends Error {
  readonly name = "ConsolidationFailure";
  readonly code: ConsolidationFailureCode;
  readonly stage: ConsolidationFailureStage;
  readonly details: ConsolidationFailureDetails;

  constructor(
    code: ConsolidationFailureCode,
    stage: ConsolidationFailureStage,
    safeMessage: string,
    details: ConsolidationFailureDetails = {},
  ) {
    super(safeMessage);
    this.code = code;
    this.stage = stage;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

export function failConsolidation(
  code: ConsolidationFailureCode,
  stage: ConsolidationFailureStage,
  safeMessage: string,
  details: ConsolidationFailureDetails = {},
): never {
  throw new ConsolidationFailure(code, stage, safeMessage, details);
}

export function mapUnknownConsolidationFailure(
  error: unknown,
  stage: ConsolidationFailureStage,
  details: ConsolidationFailureDetails = {},
): ConsolidationFailure {
  if (error instanceof ConsolidationFailure) return error;
  return new ConsolidationFailure(
    "consolidation_internal_failure",
    stage,
    "Consolidation processing failed.",
    details,
  );
}

export function validateConsolidationIdentity(
  value: unknown,
  label: string,
  code: ConsolidationFailureCode,
  stage: ConsolidationFailureStage,
  details: ConsolidationFailureDetails = {},
): asserts value is string {
  if (!isPublicIdentity(value)) {
    failConsolidation(code, stage, `${label} is invalid.`, details);
  }
}

export function validateConsolidationTimestamp(
  value: unknown,
  code: ConsolidationFailureCode,
  stage: ConsolidationFailureStage,
  details: ConsolidationFailureDetails = {},
): asserts value is string {
  if (!isCanonicalUtcTimestamp(value)) {
    failConsolidation(code, stage, "Timestamp must use canonical UTC milliseconds.", details);
  }
}
