export type AdmissionFailureCode =
  | "invalid_request"
  | "unsupported_schema"
  | "missing_identity"
  | "invalid_timestamp"
  | "evidence_digest_mismatch"
  | "review_digest_mismatch"
  | "evidence_review_binding_mismatch"
  | "unsupported_review_decision"
  | "unsupported_policy_version"
  | "indeterminate_sample_role"
  | "sample_projection_mismatch"
  | "sample_digest_mismatch"
  | "duplicate_identity_conflict"
  | "ambiguous_family_identity"
  | "partition_policy_mismatch"
  | "invalid_partition_weights"
  | "cross_partition_leakage"
  | "unknown_leakage"
  | "decision_digest_mismatch"
  | "manifest_digest_mismatch"
  | "record_budget_exceeded"
  | "serialized_size_exceeded"
  | "cancelled"
  | "controller_disposed"
  | "prohibited_export"
  | "prohibited_persistence"
  | "prohibited_training";

export class AdmissionFailure extends Error {
  readonly code: AdmissionFailureCode;

  constructor(code: AdmissionFailureCode, message: string) {
    super(message);
    this.name = "AdmissionFailure";
    this.code = code;
    Object.setPrototypeOf(this, AdmissionFailure.prototype);
  }
}

export function fail(code: AdmissionFailureCode, message: string): never {
  throw new AdmissionFailure(code, message);
}
