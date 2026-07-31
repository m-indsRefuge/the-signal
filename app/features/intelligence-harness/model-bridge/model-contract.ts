import { cloneAndFreezeJson, type JsonObject, type JsonValue } from "./json-types";

export const MODEL_BRIDGE_VERSION = "kts-i4-b/1";

export type ProviderExecutionKind = "local" | "remote" | "embedded" | "test";
export type ModelModality = "text" | "json";
export type MessageRole = "system" | "developer" | "user" | "assistant" | "context";
export type TrustClassification = "trusted" | "untrusted" | "mixed" | "unknown";
export type StructuredOutputStrictness = "strict" | "compatible";

export interface ProviderCapabilities {
  readonly textInput: boolean;
  readonly textOutput: boolean;
  readonly structuredOutput: boolean;
  readonly streaming: boolean;
  readonly cancellation: boolean;
  readonly usageReporting: boolean;
  readonly deterministicSeed: boolean;
  readonly temperatureControl: boolean;
  readonly localExecution: boolean;
  readonly remoteExecution: boolean;
}

export interface ProviderDescriptor {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly executionKind: ProviderExecutionKind;
  readonly supportedInputModalities: readonly ModelModality[];
  readonly supportedOutputModalities: readonly ModelModality[];
  readonly capabilities: ProviderCapabilities;
  readonly maximumConcurrentInvocations?: number;
}

export interface ModelDescriptor {
  readonly modelId: string;
  readonly providerId: string;
  readonly providerModelName: string;
  readonly modelRevision: string;
  readonly family: string;
  readonly parameterClass?: string;
  readonly contextWindowTokens: number;
  readonly maximumOutputTokens: number;
  readonly supportedInputModalities: readonly ModelModality[];
  readonly supportedOutputModalities: readonly ModelModality[];
  readonly structuredOutput: boolean;
  readonly deterministicSeed: boolean;
  readonly temperatureControl: boolean;
  readonly executionKind: Exclude<ProviderExecutionKind, "test"> | "test";
  readonly adaptationId?: string;
}

export interface EvidenceReference {
  readonly evidenceId: string;
  readonly evidenceType?: string;
  readonly digest?: string;
}

export interface ModelMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly sourceLabel?: string;
  readonly evidenceReferences?: readonly EvidenceReference[];
  readonly trust?: TrustClassification;
}

export interface InvocationBudget {
  readonly maximumInputTokens: number;
  readonly maximumOutputTokens: number;
  readonly maximumTotalTokens: number;
  readonly maximumInputCharacters: number;
  readonly maximumOutputCharacters: number;
  readonly deadlineMilliseconds: number;
  readonly maximumAttempts: 1;
}

export interface ModelParameters {
  readonly temperature?: number;
  readonly seed?: number;
}

export type ProviderRawOutput = string | JsonValue | null;

export interface StructuredOutputContract<T> {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly purpose: string;
  readonly schema: JsonObject;
  readonly strictness: StructuredOutputStrictness;
  readonly decode: (raw: ProviderRawOutput) => unknown;
  readonly validate: (value: unknown) => value is T;
}

export interface ModelInvocationRequest<T> {
  readonly invocationId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly messages: readonly ModelMessage[];
  readonly budget: InvocationBudget;
  readonly output: StructuredOutputContract<T>;
  readonly parameters?: ModelParameters;
  readonly exposeRawFailureOutput?: boolean;
}

export interface SerializableOutputSchema {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly purpose: string;
  readonly schema: JsonObject;
  readonly strictness: StructuredOutputStrictness;
}

export interface NormalizedModelMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly sourceLabel?: string;
  readonly evidenceReferences?: readonly EvidenceReference[];
  readonly trust?: TrustClassification;
}

export interface NormalizedInvocationRequest {
  readonly invocationId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly providerModelName: string;
  readonly modelRevision: string;
  readonly messages: readonly NormalizedModelMessage[];
  readonly budget: InvocationBudget;
  readonly outputSchema: SerializableOutputSchema;
  readonly parameters?: ModelParameters;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function validateProviderDescriptor(descriptor: ProviderDescriptor): readonly string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(descriptor.providerId)) errors.push("providerId must be non-empty");
  if (!isNonEmptyString(descriptor.providerVersion)) {
    errors.push("providerVersion must be non-empty");
  }
  if (descriptor.supportedInputModalities.length === 0) {
    errors.push("provider must declare an input modality");
  }
  if (descriptor.supportedOutputModalities.length === 0) {
    errors.push("provider must declare an output modality");
  }
  if (hasDuplicates(descriptor.supportedInputModalities)) {
    errors.push("provider input modalities must be unique");
  }
  if (hasDuplicates(descriptor.supportedOutputModalities)) {
    errors.push("provider output modalities must be unique");
  }
  if (
    descriptor.maximumConcurrentInvocations !== undefined &&
    !isPositiveInteger(descriptor.maximumConcurrentInvocations)
  ) {
    errors.push("maximumConcurrentInvocations must be a positive integer");
  }
  if (descriptor.executionKind === "local" && !descriptor.capabilities.localExecution) {
    errors.push("local provider must declare localExecution");
  }
  if (descriptor.executionKind === "remote" && !descriptor.capabilities.remoteExecution) {
    errors.push("remote provider must declare remoteExecution");
  }

  return Object.freeze(errors);
}

export function validateModelDescriptor(descriptor: ModelDescriptor): readonly string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(descriptor.modelId)) errors.push("modelId must be non-empty");
  if (!isNonEmptyString(descriptor.providerId)) errors.push("providerId must be non-empty");
  if (!isNonEmptyString(descriptor.providerModelName)) {
    errors.push("providerModelName must be non-empty");
  }
  if (!isNonEmptyString(descriptor.modelRevision)) {
    errors.push("modelRevision must be non-empty");
  }
  if (!isNonEmptyString(descriptor.family)) errors.push("family must be non-empty");
  if (!isPositiveInteger(descriptor.contextWindowTokens)) {
    errors.push("contextWindowTokens must be a positive integer");
  }
  if (!isPositiveInteger(descriptor.maximumOutputTokens)) {
    errors.push("maximumOutputTokens must be a positive integer");
  }
  if (descriptor.maximumOutputTokens > descriptor.contextWindowTokens) {
    errors.push("maximumOutputTokens cannot exceed contextWindowTokens");
  }
  if (descriptor.supportedInputModalities.length === 0) {
    errors.push("model must declare an input modality");
  }
  if (descriptor.supportedOutputModalities.length === 0) {
    errors.push("model must declare an output modality");
  }
  if (hasDuplicates(descriptor.supportedInputModalities)) {
    errors.push("model input modalities must be unique");
  }
  if (hasDuplicates(descriptor.supportedOutputModalities)) {
    errors.push("model output modalities must be unique");
  }
  if (descriptor.structuredOutput && !descriptor.supportedOutputModalities.includes("json")) {
    errors.push("structured-output model must support json output");
  }

  return Object.freeze(errors);
}

export function validateInvocationBudget(budget: InvocationBudget): readonly string[] {
  const errors: string[] = [];

  if (!isPositiveInteger(budget.maximumInputTokens)) {
    errors.push("maximumInputTokens must be a positive integer");
  }
  if (!isPositiveInteger(budget.maximumOutputTokens)) {
    errors.push("maximumOutputTokens must be a positive integer");
  }
  if (!isPositiveInteger(budget.maximumTotalTokens)) {
    errors.push("maximumTotalTokens must be a positive integer");
  }
  if (!isPositiveInteger(budget.maximumInputCharacters)) {
    errors.push("maximumInputCharacters must be a positive integer");
  }
  if (!isPositiveInteger(budget.maximumOutputCharacters)) {
    errors.push("maximumOutputCharacters must be a positive integer");
  }
  if (!isPositiveInteger(budget.deadlineMilliseconds)) {
    errors.push("deadlineMilliseconds must be a positive integer");
  }
  if (budget.maximumAttempts !== 1) {
    errors.push("maximumAttempts must equal 1");
  }
  if (
    isPositiveInteger(budget.maximumTotalTokens) &&
    isPositiveInteger(budget.maximumInputTokens) &&
    budget.maximumTotalTokens < budget.maximumInputTokens
  ) {
    errors.push("maximumTotalTokens cannot be lower than maximumInputTokens");
  }
  if (
    isPositiveInteger(budget.maximumTotalTokens) &&
    isPositiveInteger(budget.maximumOutputTokens) &&
    budget.maximumTotalTokens < budget.maximumOutputTokens
  ) {
    errors.push("maximumTotalTokens cannot be lower than maximumOutputTokens");
  }

  return Object.freeze(errors);
}

export function validateStructuredOutputContract<T>(
  output: StructuredOutputContract<T>,
): readonly string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(output.schemaId)) errors.push("schemaId must be non-empty");
  if (!isNonEmptyString(output.schemaVersion)) {
    errors.push("schemaVersion must be non-empty");
  }
  if (!isNonEmptyString(output.purpose)) errors.push("purpose must be non-empty");
  if (typeof output.decode !== "function") errors.push("decode must be a function");
  if (typeof output.validate !== "function") errors.push("validate must be a function");

  return Object.freeze(errors);
}

export function validateInvocationRequest<T>(
  request: ModelInvocationRequest<T>,
): readonly string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(request.invocationId)) errors.push("invocationId must be non-empty");
  if (!isNonEmptyString(request.providerId)) errors.push("providerId must be non-empty");
  if (!isNonEmptyString(request.modelId)) errors.push("modelId must be non-empty");
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    errors.push("messages must contain at least one message");
  } else {
    request.messages.forEach((message, index) => {
      if (!isNonEmptyString(message.content)) {
        errors.push(`messages[${index}].content must be non-empty`);
      }
      if (
        message.evidenceReferences?.some(
          (reference: EvidenceReference) => !isNonEmptyString(reference.evidenceId),
        )
      ) {
        errors.push(`messages[${index}] contains an invalid evidence reference`);
      }
    });
  }

  errors.push(...validateInvocationBudget(request.budget));
  errors.push(...validateStructuredOutputContract(request.output));

  if (
    request.parameters?.temperature !== undefined &&
    (!Number.isFinite(request.parameters.temperature) || request.parameters.temperature < 0)
  ) {
    errors.push("temperature must be a finite non-negative number");
  }
  if (
    request.parameters?.seed !== undefined &&
    (!Number.isInteger(request.parameters.seed) || request.parameters.seed < 0)
  ) {
    errors.push("seed must be a non-negative integer");
  }

  return Object.freeze(errors);
}

function normalizeEvidenceReferences(
  references: readonly EvidenceReference[] | undefined,
): readonly EvidenceReference[] | undefined {
  if (references === undefined) return undefined;

  return Object.freeze(
    references.map((reference: EvidenceReference) =>
      Object.freeze({
        evidenceId: reference.evidenceId,
        ...(reference.evidenceType === undefined ? {} : { evidenceType: reference.evidenceType }),
        ...(reference.digest === undefined ? {} : { digest: reference.digest }),
      }),
    ),
  );
}

export function normalizeInvocationRequest<T>(
  request: ModelInvocationRequest<T>,
  model: ModelDescriptor,
): NormalizedInvocationRequest {
  const messages = Object.freeze(
    request.messages.map((message) =>
      Object.freeze({
        role: message.role,
        content: message.content,
        ...(message.sourceLabel === undefined ? {} : { sourceLabel: message.sourceLabel }),
        ...(message.evidenceReferences === undefined
          ? {}
          : { evidenceReferences: normalizeEvidenceReferences(message.evidenceReferences) }),
        ...(message.trust === undefined ? {} : { trust: message.trust }),
      }),
    ),
  );

  const budget = Object.freeze({ ...request.budget });
  const outputSchema = Object.freeze({
    schemaId: request.output.schemaId,
    schemaVersion: request.output.schemaVersion,
    purpose: request.output.purpose,
    schema: cloneAndFreezeJson(request.output.schema),
    strictness: request.output.strictness,
  });
  const parameters =
    request.parameters === undefined ? undefined : Object.freeze({ ...request.parameters });

  return Object.freeze({
    invocationId: request.invocationId,
    providerId: request.providerId,
    modelId: request.modelId,
    providerModelName: model.providerModelName,
    modelRevision: model.modelRevision,
    messages,
    budget,
    outputSchema,
    ...(parameters === undefined ? {} : { parameters }),
  });
}
