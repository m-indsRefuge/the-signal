import type {
  ModelDescriptor,
  NormalizedInvocationRequest,
  ProviderDescriptor,
  ProviderRawOutput,
} from "./model-contract";
import type { JsonObject } from "./json-types";

export interface ProviderTokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface ProviderInvocationResponse {
  readonly providerId: string;
  readonly modelId: string;
  readonly providerModelName: string;
  readonly modelRevision: string;
  readonly output: ProviderRawOutput;
  readonly finishReason: string;
  readonly usage?: ProviderTokenUsage;
  readonly providerResponseId?: string;
  readonly diagnostics?: JsonObject;
}

export type ProviderFaultKind = "unavailable" | "rejected" | "transport" | "internal";

export class ProviderFault extends Error {
  readonly kind: ProviderFaultKind;
  readonly retryable: boolean;
  readonly safeMessage: string;

  constructor(options: {
    readonly kind: ProviderFaultKind;
    readonly retryable: boolean;
    readonly safeMessage: string;
  }) {
    super(options.safeMessage);
    this.name = "ProviderFault";
    this.kind = options.kind;
    this.retryable = options.retryable;
    this.safeMessage = options.safeMessage;
  }
}

export interface ModelProviderAdapter {
  descriptor(): ProviderDescriptor;
  listModels(): readonly ModelDescriptor[];
  invoke(
    request: NormalizedInvocationRequest,
    signal: AbortSignal,
  ): Promise<ProviderInvocationResponse>;
  dispose(): void | Promise<void>;
}
