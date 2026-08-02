export const DEMONSTRATION_FAILURE_CODES = [
  "invalid_request",
  "invalid_schema",
  "missing_identity",
  "invalid_identity",
  "invalid_timestamp",
  "observation_digest_mismatch",
  "legal_action_digest_mismatch",
  "planner_request_mismatch",
  "planner_result_mismatch",
  "selected_plan_lineage_mismatch",
  "proposal_projection_mismatch",
  "validator_result_mismatch",
  "evidence_digest_mismatch",
  "duplicate_identity_conflict",
  "unsupported_review_transition",
  "reconstruction_unavailable",
  "reconstruction_mismatch",
  "record_budget_exceeded",
  "serialized_size_exceeded",
  "generation_cancelled",
  "controller_disposed",
  "admission_not_authorized",
  "export_not_authorized",
] as const;

export type DemonstrationFailureCode = (typeof DEMONSTRATION_FAILURE_CODES)[number];

export class DemonstrationFailure extends Error {
  readonly code: DemonstrationFailureCode;
  readonly details: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: DemonstrationFailureCode,
    message: string,
    details: Readonly<Record<string, string | number | boolean>> = {},
  ) {
    super(message);
    this.name = "DemonstrationFailure";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function failDemonstration(
  code: DemonstrationFailureCode,
  message: string,
  details: Readonly<Record<string, string | number | boolean>> = {},
): never {
  throw new DemonstrationFailure(code, message, details);
}
