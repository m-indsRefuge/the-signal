import type { ProviderRawOutput } from "./model-contract";
import { cloneAndFreezeJson, type JsonObject } from "./json-types";

export const INVOCATION_FAILURE_CODES = [
  "invalid_request",
  "unknown_provider",
  "unknown_model",
  "provider_model_mismatch",
  "unsupported_capability",
  "budget_exceeded",
  "input_too_large",
  "output_too_large",
  "cancelled",
  "deadline_exceeded",
  "provider_unavailable",
  "provider_rejected",
  "provider_transport_failure",
  "provider_internal_failure",
  "empty_output",
  "malformed_output",
  "schema_rejected",
  "bridge_disposed",
  "bridge_internal_failure",
] as const;

export type InvocationFailureCode = (typeof INVOCATION_FAILURE_CODES)[number];

export type InvocationStage =
  | "request_validation"
  | "registry_resolution"
  | "capability_validation"
  | "budget_validation"
  | "provider_invocation"
  | "identity_validation"
  | "output_validation"
  | "bridge_lifecycle";

export interface InvocationIdentity {
  readonly invocationId: string;
  readonly requestedProviderId: string;
  readonly requestedModelId: string;
}

export interface ModelProvenance extends InvocationIdentity {
  readonly actualProviderId: string;
  readonly actualModelId: string;
  readonly providerModelName: string;
  readonly modelRevision: string;
  readonly providerAdapterVersion: string;
  readonly requestSchemaVersion: string;
  readonly outputSchemaId: string;
  readonly outputSchemaVersion: string;
  readonly bridgeVersion: string;
  readonly providerResponseId?: string;
}

export interface TokenUsage {
  readonly source: "provider" | "unknown";
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
}

export interface InvocationDiagnostics {
  readonly elapsedMilliseconds?: number;
  readonly provider?: JsonObject;
}

export interface InvocationSuccess<T> {
  readonly ok: true;
  readonly provenance: ModelProvenance;
  readonly output: T;
  readonly finishReason: string;
  readonly usage: TokenUsage;
  readonly diagnostics: InvocationDiagnostics;
}

export interface InvocationFailure {
  readonly ok: false;
  readonly code: InvocationFailureCode;
  readonly invocationId?: string;
  readonly retryable: boolean;
  readonly message: string;
  readonly requestedProviderId?: string;
  readonly requestedModelId?: string;
  readonly stage: InvocationStage;
  readonly diagnostics?: JsonObject;
  readonly rawOutput?: ProviderRawOutput;
}

export type InvocationResult<T> = InvocationSuccess<T> | InvocationFailure;

export function freezeFailure(failure: InvocationFailure): InvocationFailure {
  return Object.freeze(failure);
}

export function createFailure(options: InvocationFailure): InvocationFailure {
  const diagnostics =
    options.diagnostics === undefined ? undefined : cloneAndFreezeJson(options.diagnostics);
  const rawOutput =
    options.rawOutput === undefined ||
    options.rawOutput === null ||
    typeof options.rawOutput === "string"
      ? options.rawOutput
      : cloneAndFreezeJson(options.rawOutput);

  return freezeFailure({
    ...options,
    ...(diagnostics === undefined ? {} : { diagnostics }),
    ...(rawOutput === undefined ? {} : { rawOutput }),
  });
}

export function freezeSuccess<T>(success: InvocationSuccess<T>): InvocationSuccess<T> {
  Object.freeze(success.provenance);
  Object.freeze(success.usage);
  Object.freeze(success.diagnostics);
  return Object.freeze(success);
}
