import { failDemonstration } from "./failures";

export const DEMONSTRATION_OUTCOMES = [
  "proposal_accepted",
  "proposal_rejected",
  "planner_abstained",
  "planner_budget_exhausted",
  "planner_cancelled",
  "planner_rejected",
  "planner_failed",
] as const;
export type DemonstrationOutcome = (typeof DEMONSTRATION_OUTCOMES)[number];

export const QUALITY_LABELS = [
  "schema_complete",
  "lineage_complete",
  "legal_action_set_bound",
  "planner_result_bound",
  "proposal_projection_bound",
  "validator_result_bound",
  "deterministically_reconstructable",
  "bounded_without_truncation",
  "bounded_with_declared_truncation",
  "human_review_missing",
  "outcome_evidence_missing",
  "quality_unknown",
] as const;
export type QualityLabel = (typeof QUALITY_LABELS)[number];

export const EVIDENCE_RISK_LABELS = [
  "none_observed",
  "validator_rejected",
  "blocking_planner_risk",
  "lineage_mismatch",
  "digest_mismatch",
  "version_mismatch",
  "unreconstructable",
  "budget_truncated",
  "duplicate",
  "conflicting_duplicate",
  "review_required",
  "risk_unknown",
] as const;
export type EvidenceRiskLabel = (typeof EVIDENCE_RISK_LABELS)[number];

export const QUARANTINE_STATES = ["quarantined"] as const;
export type QuarantineState = (typeof QUARANTINE_STATES)[number];

export const TRAINING_ADMISSION_STATES = ["not_evaluated"] as const;
export type TrainingAdmissionState = (typeof TRAINING_ADMISSION_STATES)[number];

export const DATASET_ADMISSION_STATES = ["not_performed"] as const;
export type DatasetAdmissionState = (typeof DATASET_ADMISSION_STATES)[number];

export const EXPORT_AUTHORIZATION_STATES = ["absent"] as const;
export type ExportAuthorizationState = (typeof EXPORT_AUTHORIZATION_STATES)[number];

export const DEMONSTRATION_MAXIMA = Object.freeze({
  evidenceRecordsPerBatch: 10_000,
  quarantineRecords: 10_000,
  reviewRecords: 10_000,
  returnedRecords: 10_000,
  sourceLineageReferences: 64,
  selectedPlanActions: 8,
  alternativePlans: 16,
  scoreComponents: 64,
  riskFlags: 64,
  explanationReferences: 64,
  validatorReasons: 64,
  unsupportedReferences: 64,
  qualityLabels: 64,
  evidenceRiskLabels: 64,
  limitations: 64,
  reviewReasonCodes: 64,
  reviewRationaleReferences: 64,
  duplicateFamilyMembers: 10_000,
  reconstructionMismatchReasons: 64,
  evidenceRecordCharacters: 262_144,
  reviewRecordCharacters: 65_536,
  batchCharacters: 16_777_216,
  quarantineSnapshotCharacters: 16_777_216,
});

const IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function requireIdentity(value: string, field: string): string {
  const normalized = value.trim();
  if (!IDENTITY_PATTERN.test(normalized)) {
    return failDemonstration("invalid_identity", `${field} is not a canonical identity.`);
  }
  return normalized;
}

export function requireDigest(value: string, field: string): string {
  if (!/^[0-9a-f]{32}$/.test(value)) {
    return failDemonstration("invalid_schema", `${field} is not a canonical digest.`);
  }
  return value;
}

export function requireTimestamp(value: string): string {
  if (!ISO_UTC_PATTERN.test(value)) {
    return failDemonstration(
      "invalid_timestamp",
      "Timestamp must be caller-supplied ISO-8601 UTC.",
    );
  }
  return value;
}

export function requireBoundedStrings(
  values: readonly string[],
  maximum: number,
  field: string,
): readonly string[] {
  if (!Array.isArray(values) || values.length > maximum) {
    return failDemonstration("record_budget_exceeded", `${field} exceeds its count budget.`);
  }
  const canonical = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  if (canonical.length !== values.length) {
    return failDemonstration(
      "invalid_schema",
      `${field} must be non-empty, unique, and canonical.`,
    );
  }
  return Object.freeze(canonical);
}

export function requireBoundedStringSequence(
  values: readonly string[],
  maximum: number,
  field: string,
): readonly string[] {
  if (!Array.isArray(values) || values.length > maximum) {
    return failDemonstration("record_budget_exceeded", `${field} exceeds its count budget.`);
  }
  const canonical = values.map((value) => value.trim());
  if (canonical.some((value) => value.length === 0)) {
    return failDemonstration("invalid_schema", `${field} contains an empty value.`);
  }
  return Object.freeze(canonical);
}

export function requirePositiveSafeInteger(value: number, maximum: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    return failDemonstration("record_budget_exceeded", `${field} is outside the accepted range.`);
  }
  return value;
}
