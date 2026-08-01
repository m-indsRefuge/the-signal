export const MEMORY_FABRIC_FAILURE_CODES = Object.freeze([
  "invalid_memory_request",
  "invalid_identity",
  "invalid_timestamp",
  "invalid_json",
  "canonicalization_failed",
  "invalid_digest",
  "digest_mismatch",
  "invalid_evidence",
  "invalid_evidence_relation",
  "invalid_memory",
  "invalid_memory_relation",
  "unsupported_memory_kind",
  "missing_evidence",
  "identity_collision",
  "lineage_cycle",
  "invalid_budget",
  "required_working_memory_omitted",
  "retrieval_not_authorized",
  "retrieval_budget_exceeded",
  "repository_disposed",
  "repository_failure",
  "d1_contract_failure",
  "memory_internal_failure",
] as const);

export type MemoryFabricFailureCode = (typeof MEMORY_FABRIC_FAILURE_CODES)[number];

export type MemoryFabricStage =
  | "canonicalization"
  | "digest"
  | "validation"
  | "working_memory"
  | "episode"
  | "repository"
  | "retrieval"
  | "d1"
  | "kts_adapter";

export interface MemoryFabricFailureDetails {
  readonly code: MemoryFabricFailureCode;
  readonly stage: MemoryFabricStage;
  readonly message: string;
  readonly requestId?: string;
  readonly operationId?: string;
  readonly diagnostics?: Readonly<Record<string, string | number | boolean | null>>;
}

export class MemoryFabricError extends Error {
  readonly details: MemoryFabricFailureDetails;

  constructor(details: MemoryFabricFailureDetails) {
    super(details.message);
    this.name = "MemoryFabricError";
    this.details = Object.freeze({
      ...details,
      diagnostics:
        details.diagnostics === undefined ? undefined : Object.freeze({ ...details.diagnostics }),
    });
  }
}

export function failMemory(
  code: MemoryFabricFailureCode,
  stage: MemoryFabricStage,
  message: string,
  context: Omit<MemoryFabricFailureDetails, "code" | "stage" | "message"> = {},
): never {
  throw new MemoryFabricError({ code, stage, message, ...context });
}

export function sanitizeRepositoryError(
  stage: "repository" | "d1",
  operationId?: string,
): MemoryFabricError {
  return new MemoryFabricError({
    code: stage === "d1" ? "d1_contract_failure" : "repository_failure",
    stage,
    message: "The memory repository operation failed.",
    operationId,
  });
}
