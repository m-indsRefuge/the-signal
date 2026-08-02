export const TRAINING_FAILURE_CODES = Object.freeze([
  "invalid_training_source",
  "invalid_source_identity",
  "source_not_found",
  "source_not_eligible",
  "source_policy_prohibited",
  "source_lineage_incomplete",
  "source_digest_mismatch",
  "invalid_training_example",
  "invalid_example_identity",
  "invalid_example_digest",
  "example_identity_collision",
  "unsupported_example_kind",
  "invalid_target",
  "target_not_supported",
  "target_schema_incompatible",
  "target_illegal",
  "target_ungrounded",
  "invalid_preference_pair",
  "preference_not_established",
  "invalid_correction",
  "correction_not_supported",
  "invalid_teacher_record",
  "teacher_review_missing",
  "teacher_schema_incompatible",
  "hidden_reasoning_prohibited",
  "invalid_partition_policy",
  "partition_group_missing",
  "partition_collision",
  "partition_leakage",
  "test_contamination",
  "duplicate_example",
  "conflicting_duplicate",
  "structural_duplicate_blocked",
  "invalid_quality_policy",
  "quality_gate_failed",
  "protected_evidence_prohibited",
  "consent_status_unknown",
  "privacy_status_unknown",
  "review_required",
  "invalid_curriculum_plan",
  "invalid_sampling_plan",
  "invalid_distillation_plan",
  "invalid_dataset_manifest",
  "invalid_export_draft",
  "export_budget_exceeded",
  "compiler_cancelled",
  "compiler_disposed",
  "compiler_internal_failure",
] as const);
export type TrainingFailureCode = (typeof TRAINING_FAILURE_CODES)[number];
export type TrainingFailureStage =
  | "source"
  | "example"
  | "partition"
  | "duplicate_audit"
  | "leakage_audit"
  | "quality"
  | "curriculum"
  | "distillation"
  | "manifest"
  | "export"
  | "compiler";

export class TrainingEvidenceError extends Error {
  readonly code: TrainingFailureCode;
  readonly stage: TrainingFailureStage;
  readonly safeContext: Readonly<Record<string, string | number | boolean>>;
  constructor(
    code: TrainingFailureCode,
    stage: TrainingFailureStage,
    message: string,
    safeContext: Readonly<Record<string, string | number | boolean>> = {},
  ) {
    super(message);
    this.name = "TrainingEvidenceError";
    this.code = code;
    this.stage = stage;
    this.safeContext = Object.freeze({ ...safeContext });
    Object.freeze(this);
  }
}
export function failTraining(
  code: TrainingFailureCode,
  stage: TrainingFailureStage,
  message: string,
  safeContext: Readonly<Record<string, string | number | boolean>> = {},
): never {
  throw new TrainingEvidenceError(code, stage, message, safeContext);
}
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export function validateTrainingIdentity(
  value: unknown,
  label: string,
  code: TrainingFailureCode = "invalid_source_identity",
  stage: TrainingFailureStage = "source",
): string {
  if (typeof value !== "string" || !PUBLIC_ID_PATTERN.test(value)) {
    failTraining(code, stage, `${label} is invalid.`);
  }
  return value;
}
export function validateTrainingTimestamp(
  value: unknown,
  code: TrainingFailureCode,
  stage: TrainingFailureStage,
): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    failTraining(code, stage, "Timestamp must use canonical UTC millisecond format.");
  }
  return value;
}
