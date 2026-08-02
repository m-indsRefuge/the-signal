export const FINE_TUNING_FAILURE_CODES = Object.freeze([
  "invalid_experiment",
  "invalid_experiment_identity",
  "invalid_base_model",
  "base_model_digest_mismatch",
  "base_model_licence_unapproved",
  "base_model_revision_unpinned",
  "tokenizer_mismatch",
  "invalid_dataset_approval",
  "dataset_manifest_mismatch",
  "dataset_digest_mismatch",
  "dataset_not_approved",
  "dataset_partition_invalid",
  "test_partition_contaminated",
  "protected_evidence_prohibited",
  "invalid_training_method",
  "invalid_hyperparameters",
  "invalid_environment",
  "environment_mismatch",
  "invalid_resource_budget",
  "resource_budget_exceeded",
  "invalid_training_plan",
  "training_plan_digest_mismatch",
  "training_not_authorized",
  "network_not_authorized",
  "external_upload_not_authorized",
  "paid_compute_not_authorized",
  "preflight_failed",
  "run_cancelled",
  "run_failed",
  "checkpoint_invalid",
  "checkpoint_digest_mismatch",
  "adapter_invalid",
  "adapter_lineage_incomplete",
  "evaluation_invalid",
  "evaluation_partition_invalid",
  "baseline_missing",
  "regression_gate_failed",
  "reproducibility_failed",
  "licence_evidence_missing",
  "hidden_reasoning_prohibited",
  "promotion_not_authorized",
  "controller_disposed",
  "controller_internal_failure",
] as const);
export type FineTuningFailureCode = (typeof FINE_TUNING_FAILURE_CODES)[number];
export class FineTuningFailure extends Error {
  readonly code: FineTuningFailureCode;
  readonly stage: string;
  readonly context: Readonly<Record<string, string | number | boolean | null>>;
  constructor(
    code: FineTuningFailureCode,
    stage: string,
    message: string,
    context: Record<string, string | number | boolean | null> = {},
  ) {
    super(message);
    this.name = "FineTuningFailure";
    this.code = code;
    this.stage = stage;
    this.context = Object.freeze({ ...context });
  }
}
export function failFineTuning(
  code: FineTuningFailureCode,
  stage: string,
  message: string,
  context: Record<string, string | number | boolean | null> = {},
): never {
  throw new FineTuningFailure(code, stage, message, context);
}
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/;
export function validateFineTuningIdentity(
  value: string,
  label: string,
  code: FineTuningFailureCode = "invalid_experiment_identity",
): void {
  if (typeof value !== "string" || !ID_PATTERN.test(value))
    failFineTuning(code, "identity", `${label} is invalid.`);
}
export function validateCanonicalTimestamp(value: string, label: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    failFineTuning(
      "invalid_experiment",
      "timestamp",
      `${label} must be a canonical UTC timestamp.`,
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    failFineTuning(
      "invalid_experiment",
      "timestamp",
      `${label} must be a valid canonical UTC timestamp.`,
    );
  }
}
export function assertPositiveSafeInteger(
  value: number,
  label: string,
  code: FineTuningFailureCode,
): void {
  if (!Number.isSafeInteger(value) || value < 1)
    failFineTuning(code, "validation", `${label} must be a positive safe integer.`);
}
export function assertFiniteNonNegative(
  value: number,
  label: string,
  code: FineTuningFailureCode,
): void {
  if (!Number.isFinite(value) || value < 0)
    failFineTuning(code, "validation", `${label} must be finite and non-negative.`);
}
