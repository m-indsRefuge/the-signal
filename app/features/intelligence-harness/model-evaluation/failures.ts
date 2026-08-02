export type EvaluationFailureCode =
  | "invalid_hardware_snapshot"
  | "missing_hardware_evidence"
  | "unsupported_hardware_field"
  | "invalid_candidate_profile"
  | "mutable_revision"
  | "license_not_approved"
  | "artifact_digest_mismatch"
  | "unsupported_artifact_format"
  | "incompatible_tokenizer"
  | "incompatible_chat_template"
  | "unsupported_runtime"
  | "runtime_capability_unknown"
  | "invalid_generation_parameters"
  | "prompt_rendering_mismatch"
  | "prompt_budget_exceeded"
  | "invalid_response_envelope"
  | "raw_response_budget_exceeded"
  | "ambiguous_response_object"
  | "schema_rejection"
  | "validator_rejection"
  | "repeatability_mismatch"
  | "unsupported_comparison"
  | "record_budget_exceeded"
  | "serialized_size_exceeded"
  | "cancelled"
  | "controller_disposed"
  | "prohibited_host_inspection"
  | "prohibited_artifact_acquisition"
  | "prohibited_runtime_installation"
  | "prohibited_model_invocation"
  | "prohibited_model_selection"
  | "prohibited_persistence"
  | "prohibited_dataset_export"
  | "prohibited_training";

export class EvaluationFailure extends Error {
  readonly code: EvaluationFailureCode;

  constructor(code: EvaluationFailureCode, message: string) {
    super(message);
    this.name = "EvaluationFailure";
    this.code = code;
    Object.setPrototypeOf(this, EvaluationFailure.prototype);
  }
}

export function fail(code: EvaluationFailureCode, message: string): never {
  throw new EvaluationFailure(code, message);
}
