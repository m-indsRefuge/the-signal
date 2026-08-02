import { canonicalizeJson, type JsonObject } from "../memory-fabric/canonical-json";

export const TACTICAL_ADVISER_FAILURE_CODES = Object.freeze([
  "invalid_adviser_request",
  "invalid_adviser_role",
  "invalid_proposal",
  "invalid_proposal_identity",
  "invalid_strategy",
  "invalid_strategy_identity",
  "invalid_strategy_digest",
  "strategy_identity_collision",
  "unknown_strategy",
  "strategy_not_applicable",
  "strategy_budget_exceeded",
  "invalid_context_budget",
  "required_context_omitted",
  "context_budget_exceeded",
  "retrieval_failed",
  "retrieval_not_authorized",
  "context_build_failed",
  "invalid_prompt_contract",
  "bridge_failed",
  "proposal_empty",
  "proposal_malformed",
  "proposal_schema_rejected",
  "proposal_not_grounded",
  "unsupported_evidence_reference",
  "unsupported_strategy_reference",
  "invalid_target_reference",
  "unready_recommendation",
  "evaluation_invalid",
  "evaluation_pair_mismatch",
  "adviser_disposed",
  "adviser_internal_failure",
] as const);

export type TacticalAdviserFailureCode = (typeof TACTICAL_ADVISER_FAILURE_CODES)[number];

export type TacticalAdviserStage =
  | "request_validation"
  | "role_validation"
  | "strategy_validation"
  | "strategy_portfolio"
  | "retrieval"
  | "context"
  | "bridge"
  | "proposal_validation"
  | "evidence"
  | "evaluation"
  | "lifecycle";

export interface TacticalAdviserFailure {
  readonly code: TacticalAdviserFailureCode;
  readonly stage: TacticalAdviserStage;
  readonly message: string;
  readonly adviserRequestId?: string;
  readonly invocationId?: string;
  readonly observationId?: string;
  readonly diagnostics?: JsonObject;
  readonly underlyingCode?: string;
}

export class TacticalAdviserError extends Error {
  readonly failure: Readonly<TacticalAdviserFailure>;

  constructor(failure: TacticalAdviserFailure) {
    super(failure.message);
    this.name = "TacticalAdviserError";
    this.failure = freezeAdviserFailure(failure);
  }
}

export function freezeAdviserFailure(
  failure: TacticalAdviserFailure,
): Readonly<TacticalAdviserFailure> {
  const diagnostics =
    failure.diagnostics === undefined
      ? undefined
      : (canonicalizeJson(failure.diagnostics) as JsonObject);

  return Object.freeze({
    code: failure.code,
    stage: failure.stage,
    message: failure.message,
    ...(failure.adviserRequestId === undefined
      ? {}
      : { adviserRequestId: failure.adviserRequestId }),
    ...(failure.invocationId === undefined ? {} : { invocationId: failure.invocationId }),
    ...(failure.observationId === undefined ? {} : { observationId: failure.observationId }),
    ...(diagnostics === undefined ? {} : { diagnostics }),
    ...(failure.underlyingCode === undefined ? {} : { underlyingCode: failure.underlyingCode }),
  });
}

export function failAdviser(
  code: TacticalAdviserFailureCode,
  stage: TacticalAdviserStage,
  message: string,
  context: Omit<TacticalAdviserFailure, "code" | "stage" | "message"> = {},
): never {
  throw new TacticalAdviserError({ code, stage, message, ...context });
}

export function toSafeAdviserFailure(
  error: unknown,
  fallback: TacticalAdviserFailure,
): Readonly<TacticalAdviserFailure> {
  if (error instanceof TacticalAdviserError) return error.failure;
  return freezeAdviserFailure(fallback);
}
