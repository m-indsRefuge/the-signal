import {
  createFailure,
  freezeSuccess,
  type InvocationFailure,
  type InvocationFailureCode,
  type InvocationResult,
  type InvocationStage,
  type TokenUsage,
} from "./failures";
import {
  MODEL_BRIDGE_VERSION,
  normalizeInvocationRequest,
  validateInvocationRequest,
  type ModelDescriptor,
  type ModelInvocationRequest,
  type ProviderDescriptor,
  type NormalizedInvocationRequest,
  type ProviderRawOutput,
} from "./model-contract";
import {
  ProviderFault,
  type ModelProviderAdapter,
  type ProviderInvocationResponse,
  type ProviderTokenUsage,
} from "./provider-contract";
import { ModelProviderRegistry, RegistryError } from "./registry";
import {
  cloneAndFreezeJson,
  isJsonValue,
  jsonCharacterLength,
  type JsonObject,
} from "./json-types";

export interface MonotonicClock {
  now(): number;
}

export interface DeadlineScheduler {
  schedule(delayMilliseconds: number, callback: () => void): () => void;
}

const defaultDeadlineScheduler: DeadlineScheduler = Object.freeze({
  schedule(delayMilliseconds: number, callback: () => void) {
    const handle = setTimeout(callback, delayMilliseconds);
    return () => clearTimeout(handle);
  },
});

interface ActiveInvocation {
  readonly providerId: string;
  readonly controller: AbortController;
  termination: "none" | "cancelled" | "deadline" | "disposed";
  terminate?: (reason: "cancelled" | "deadline" | "disposed") => void;
}

class InvocationTermination extends Error {
  readonly reason: ActiveInvocation["termination"];

  constructor(reason: ActiveInvocation["termination"]) {
    super(reason);
    this.name = "InvocationTermination";
    this.reason = reason;
  }
}

export interface InvocationCoordinatorOptions {
  readonly clock?: MonotonicClock;
  readonly deadlineScheduler?: DeadlineScheduler;
}

interface CapturedOutputEvaluator<T> {
  readonly decode: ModelInvocationRequest<T>["output"]["decode"];
  readonly validate: ModelInvocationRequest<T>["output"]["validate"];
  readonly exposeRawFailureOutput: boolean;
}

function failure(
  request: Partial<
    Pick<ModelInvocationRequest<unknown>, "invocationId" | "providerId" | "modelId">
  >,
  code: InvocationFailureCode,
  stage: InvocationStage,
  message: string,
  retryable = false,
  options?: { readonly diagnostics?: JsonObject; readonly rawOutput?: ProviderRawOutput },
): InvocationFailure {
  return createFailure({
    ok: false,
    code,
    retryable,
    message,
    stage,
    ...(request.invocationId === undefined ? {} : { invocationId: request.invocationId }),
    ...(request.providerId === undefined ? {} : { requestedProviderId: request.providerId }),
    ...(request.modelId === undefined ? {} : { requestedModelId: request.modelId }),
    ...(options?.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
    ...(options?.rawOutput === undefined ? {} : { rawOutput: options.rawOutput }),
  });
}

function inputCharacterLength(request: NormalizedInvocationRequest): number {
  return request.messages.reduce((total, message) => total + message.content.length, 0);
}

function outputCharacterLength(output: ProviderRawOutput): number {
  if (output === null) return 0;
  return typeof output === "string" ? output.length : jsonCharacterLength(output);
}

function normalizeUsage(usage: ProviderTokenUsage | undefined): TokenUsage {
  if (usage === undefined) {
    return Object.freeze({
      source: "unknown",
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    });
  }

  return Object.freeze({
    source: "provider",
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
  });
}

function validateUsage(
  usage: ProviderTokenUsage | undefined,
  request: NormalizedInvocationRequest,
): { readonly code: InvocationFailureCode; readonly message: string } | undefined {
  if (usage === undefined) return undefined;

  const values = [usage.inputTokens, usage.outputTokens, usage.totalTokens];
  if (values.some((value) => value !== undefined && (!Number.isInteger(value) || value < 0))) {
    return {
      code: "provider_internal_failure",
      message: "The provider returned invalid token-usage metadata.",
    };
  }

  if (usage.inputTokens !== undefined && usage.inputTokens > request.budget.maximumInputTokens) {
    return {
      code: "budget_exceeded",
      message: "The provider-reported input usage exceeds the invocation budget.",
    };
  }
  if (usage.outputTokens !== undefined && usage.outputTokens > request.budget.maximumOutputTokens) {
    return {
      code: "budget_exceeded",
      message: "The provider-reported output usage exceeds the invocation budget.",
    };
  }
  if (usage.totalTokens !== undefined && usage.totalTokens > request.budget.maximumTotalTokens) {
    return {
      code: "budget_exceeded",
      message: "The provider-reported total usage exceeds the invocation budget.",
    };
  }

  return undefined;
}

function mapProviderFault(fault: ProviderFault): {
  readonly code: InvocationFailureCode;
  readonly retryable: boolean;
  readonly message: string;
} {
  switch (fault.kind) {
    case "unavailable":
      return {
        code: "provider_unavailable",
        retryable: fault.retryable,
        message: fault.safeMessage,
      };
    case "rejected":
      return {
        code: "provider_rejected",
        retryable: fault.retryable,
        message: fault.safeMessage,
      };
    case "transport":
      return {
        code: "provider_transport_failure",
        retryable: fault.retryable,
        message: fault.safeMessage,
      };
    case "internal":
      return {
        code: "provider_internal_failure",
        retryable: fault.retryable,
        message: fault.safeMessage,
      };
  }
}

export class ModelInvocationCoordinator {
  readonly #registry: ModelProviderRegistry;
  readonly #clock: MonotonicClock | undefined;
  readonly #scheduler: DeadlineScheduler;
  readonly #active = new Map<string, ActiveInvocation>();
  readonly #providerActiveCounts = new Map<string, number>();
  #disposed = false;

  constructor(registry: ModelProviderRegistry, options: InvocationCoordinatorOptions = {}) {
    this.#registry = registry;
    this.#clock = options.clock;
    this.#scheduler = options.deadlineScheduler ?? defaultDeadlineScheduler;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get activeInvocationCount(): number {
    return this.#active.size;
  }

  activeInvocationCountForProvider(providerId: string): number {
    return this.#providerActiveCounts.get(providerId) ?? 0;
  }

  async invoke<T>(
    request: ModelInvocationRequest<T>,
    signal?: AbortSignal,
  ): Promise<InvocationResult<T>> {
    const identity = Object.freeze({
      invocationId: request.invocationId,
      providerId: request.providerId,
      modelId: request.modelId,
    });
    const outputEvaluator: CapturedOutputEvaluator<T> = Object.freeze({
      decode: request.output.decode,
      validate: request.output.validate,
      exposeRawFailureOutput: request.exposeRawFailureOutput === true,
    });

    if (this.#disposed) {
      return failure(
        identity,
        "bridge_disposed",
        "bridge_lifecycle",
        "The model invocation bridge is disposed.",
      );
    }

    const requestErrors = validateInvocationRequest(request);
    if (requestErrors.length > 0) {
      return failure(identity, "invalid_request", "request_validation", requestErrors.join("; "));
    }

    if (this.#active.has(request.invocationId)) {
      return failure(
        identity,
        "invalid_request",
        "request_validation",
        "The invocation ID is already active.",
      );
    }

    let adapter: ModelProviderAdapter | undefined;
    let providerDescriptor: ProviderDescriptor | undefined;
    let model: ModelDescriptor | undefined;

    try {
      adapter = this.#registry.getProvider(request.providerId);
      providerDescriptor = this.#registry.getProviderDescriptor(request.providerId);
      if (adapter === undefined || providerDescriptor === undefined) {
        return failure(
          identity,
          "unknown_provider",
          "registry_resolution",
          "The requested provider is not registered.",
        );
      }

      model = this.#registry.getModel(request.providerId, request.modelId);
      if (model === undefined) {
        const owner = this.#registry.getModelOwner(request.modelId);
        if (owner !== undefined && owner !== request.providerId) {
          return failure(
            identity,
            "provider_model_mismatch",
            "registry_resolution",
            "The requested model belongs to a different provider.",
          );
        }
        return failure(
          identity,
          "unknown_model",
          "registry_resolution",
          "The requested model is not registered.",
        );
      }
    } catch (error) {
      if (error instanceof RegistryError && error.code === "registry_disposed") {
        return failure(
          identity,
          "bridge_disposed",
          "bridge_lifecycle",
          "The model invocation bridge is disposed.",
        );
      }
      return failure(
        identity,
        "bridge_internal_failure",
        "registry_resolution",
        "The model registry could not resolve the invocation.",
      );
    }

    const capabilityFailure = this.#validateCapabilities(
      request,
      identity,
      providerDescriptor,
      model,
    );
    if (capabilityFailure !== undefined) return capabilityFailure;

    const budgetFailure = this.#validateModelBudget(request, identity, model);
    if (budgetFailure !== undefined) return budgetFailure;

    const providerActive = this.activeInvocationCountForProvider(request.providerId);
    if (
      providerDescriptor.maximumConcurrentInvocations !== undefined &&
      providerActive >= providerDescriptor.maximumConcurrentInvocations
    ) {
      return failure(
        identity,
        "provider_unavailable",
        "provider_invocation",
        "The provider concurrency limit has been reached.",
        true,
      );
    }

    const normalized = normalizeInvocationRequest(request, model);
    if (inputCharacterLength(normalized) > normalized.budget.maximumInputCharacters) {
      return failure(
        identity,
        "input_too_large",
        "budget_validation",
        "The invocation input exceeds its character budget.",
      );
    }

    if (signal?.aborted) {
      return failure(
        identity,
        "cancelled",
        "provider_invocation",
        "The invocation was cancelled before provider execution.",
      );
    }

    const active: ActiveInvocation = {
      providerId: request.providerId,
      controller: new AbortController(),
      termination: "none",
    };
    this.#active.set(request.invocationId, active);
    this.#providerActiveCounts.set(request.providerId, providerActive + 1);

    const startedAt = this.#clock?.now();
    let cancelDeadline: () => void = () => {};
    let removeExternalAbort: () => void = () => {};

    try {
      const terminationPromise = new Promise<never>((_, reject) => {
        const terminate = (reason: "cancelled" | "deadline" | "disposed"): void => {
          if (active.termination !== "none") return;
          active.termination = reason;
          active.controller.abort(reason);
          reject(new InvocationTermination(reason));
        };

        active.terminate = terminate;

        if (signal !== undefined) {
          const onAbort = (): void => terminate("cancelled");
          signal.addEventListener("abort", onAbort, { once: true });
          removeExternalAbort = () => signal.removeEventListener("abort", onAbort);
        }

        cancelDeadline = this.#scheduler.schedule(normalized.budget.deadlineMilliseconds, () =>
          terminate("deadline"),
        );
      });

      const providerPromise = Promise.resolve(adapter.invoke(normalized, active.controller.signal));
      const response = await Promise.race([providerPromise, terminationPromise]);

      if (active.termination !== "none") {
        throw new InvocationTermination(active.termination);
      }

      return this.#validateResponse(
        identity,
        normalized,
        model,
        providerDescriptor.providerVersion,
        response,
        startedAt,
        outputEvaluator,
      );
    } catch (error) {
      if (error instanceof InvocationTermination) {
        switch (error.reason) {
          case "cancelled":
            return failure(
              identity,
              "cancelled",
              "provider_invocation",
              "The invocation was cancelled.",
            );
          case "deadline":
            return failure(
              identity,
              "deadline_exceeded",
              "provider_invocation",
              "The invocation deadline was exceeded.",
              true,
            );
          case "disposed":
            return failure(
              identity,
              "bridge_disposed",
              "bridge_lifecycle",
              "The model invocation bridge was disposed during invocation.",
            );
          case "none":
            break;
        }
      }

      if (error instanceof ProviderFault) {
        const mapped = mapProviderFault(error);
        return failure(
          identity,
          mapped.code,
          "provider_invocation",
          mapped.message,
          mapped.retryable,
        );
      }

      return failure(
        identity,
        "provider_internal_failure",
        "provider_invocation",
        "The provider failed without a safe classified error.",
      );
    } finally {
      cancelDeadline();
      removeExternalAbort();
      this.#active.delete(request.invocationId);
      const currentProviderCount = this.#providerActiveCounts.get(request.providerId) ?? 1;
      if (currentProviderCount <= 1) {
        this.#providerActiveCounts.delete(request.providerId);
      } else {
        this.#providerActiveCounts.set(request.providerId, currentProviderCount - 1);
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;

    for (const active of this.#active.values()) {
      active.terminate?.("disposed");
    }

    await this.#registry.dispose();
  }

  #validateCapabilities<T>(
    request: ModelInvocationRequest<T>,
    identity: {
      readonly invocationId: string;
      readonly providerId: string;
      readonly modelId: string;
    },
    provider: ProviderDescriptor,
    model: ModelDescriptor,
  ): InvocationFailure | undefined {
    if (!provider.capabilities.textInput || !model.supportedInputModalities.includes("text")) {
      return failure(
        identity,
        "unsupported_capability",
        "capability_validation",
        "The selected provider and model do not support text input.",
      );
    }
    if (
      !provider.capabilities.structuredOutput ||
      !model.structuredOutput ||
      !model.supportedOutputModalities.includes("json")
    ) {
      return failure(
        identity,
        "unsupported_capability",
        "capability_validation",
        "The selected provider and model do not support structured output.",
      );
    }
    if (
      request.parameters?.seed !== undefined &&
      (!provider.capabilities.deterministicSeed || !model.deterministicSeed)
    ) {
      return failure(
        identity,
        "unsupported_capability",
        "capability_validation",
        "The selected provider and model do not support deterministic seeds.",
      );
    }
    if (
      request.parameters?.temperature !== undefined &&
      (!provider.capabilities.temperatureControl || !model.temperatureControl)
    ) {
      return failure(
        identity,
        "unsupported_capability",
        "capability_validation",
        "The selected provider and model do not support temperature control.",
      );
    }

    return undefined;
  }

  #validateModelBudget<T>(
    request: ModelInvocationRequest<T>,
    identity: {
      readonly invocationId: string;
      readonly providerId: string;
      readonly modelId: string;
    },
    model: ModelDescriptor,
  ): InvocationFailure | undefined {
    if (request.budget.maximumOutputTokens > model.maximumOutputTokens) {
      return failure(
        identity,
        "budget_exceeded",
        "budget_validation",
        "The output-token budget exceeds the selected model limit.",
      );
    }
    if (request.budget.maximumTotalTokens > model.contextWindowTokens) {
      return failure(
        identity,
        "budget_exceeded",
        "budget_validation",
        "The total-token budget exceeds the selected model context window.",
      );
    }

    return undefined;
  }

  #validateResponse<T>(
    identity: {
      readonly invocationId: string;
      readonly providerId: string;
      readonly modelId: string;
    },
    normalized: NormalizedInvocationRequest,
    model: ModelDescriptor,
    providerAdapterVersion: string,
    response: ProviderInvocationResponse,
    startedAt: number | undefined,
    outputEvaluator: CapturedOutputEvaluator<T>,
  ): InvocationResult<T> {
    if (
      response.providerId !== normalized.providerId ||
      response.modelId !== normalized.modelId ||
      response.providerModelName !== model.providerModelName ||
      response.modelRevision !== model.modelRevision
    ) {
      return failure(
        identity,
        "provider_model_mismatch",
        "identity_validation",
        "The provider returned output from an unexpected model identity.",
      );
    }

    if (
      response.output === null ||
      (typeof response.output === "string" && response.output.trim().length === 0)
    ) {
      return failure(
        identity,
        "empty_output",
        "output_validation",
        "The provider returned no usable output.",
      );
    }

    if (outputCharacterLength(response.output) > normalized.budget.maximumOutputCharacters) {
      return failure(
        identity,
        "output_too_large",
        "output_validation",
        "The provider output exceeds the invocation character budget.",
      );
    }

    const usageFailure = validateUsage(response.usage, normalized);
    if (usageFailure !== undefined) {
      return failure(
        identity,
        usageFailure.code,
        usageFailure.code === "budget_exceeded" ? "budget_validation" : "output_validation",
        usageFailure.message,
      );
    }

    let decoded: unknown;
    try {
      decoded = outputEvaluator.decode(response.output);
    } catch {
      return failure(
        identity,
        "malformed_output",
        "output_validation",
        "The provider output could not be decoded.",
        false,
        outputEvaluator.exposeRawFailureOutput
          ? { rawOutput: this.#safeRawOutput(response.output) }
          : undefined,
      );
    }

    if (!isJsonValue(decoded) || !outputEvaluator.validate(decoded)) {
      return failure(
        identity,
        "schema_rejected",
        "output_validation",
        "The decoded provider output did not satisfy the requested JSON schema.",
        false,
        outputEvaluator.exposeRawFailureOutput
          ? { rawOutput: this.#safeRawOutput(response.output) }
          : undefined,
      );
    }

    const validatedOutput = cloneAndFreezeJson(decoded) as T;
    const endedAt = this.#clock?.now();
    const elapsedMilliseconds =
      startedAt === undefined || endedAt === undefined
        ? undefined
        : Math.max(0, endedAt - startedAt);
    const providerDiagnostics =
      response.diagnostics === undefined ? undefined : cloneAndFreezeJson(response.diagnostics);

    const provenance = Object.freeze({
      invocationId: normalized.invocationId,
      requestedProviderId: normalized.providerId,
      requestedModelId: normalized.modelId,
      actualProviderId: response.providerId,
      actualModelId: response.modelId,
      providerModelName: response.providerModelName,
      modelRevision: response.modelRevision,
      providerAdapterVersion,
      requestSchemaVersion: "kts-i4-b-request/1",
      outputSchemaId: normalized.outputSchema.schemaId,
      outputSchemaVersion: normalized.outputSchema.schemaVersion,
      bridgeVersion: MODEL_BRIDGE_VERSION,
      ...(response.providerResponseId === undefined
        ? {}
        : { providerResponseId: response.providerResponseId }),
    });

    const diagnostics = Object.freeze({
      ...(elapsedMilliseconds === undefined ? {} : { elapsedMilliseconds }),
      ...(providerDiagnostics === undefined ? {} : { provider: providerDiagnostics }),
    });

    return freezeSuccess({
      ok: true,
      provenance,
      output: validatedOutput,
      finishReason: response.finishReason,
      usage: normalizeUsage(response.usage),
      diagnostics,
    });
  }

  #safeRawOutput(output: ProviderRawOutput): ProviderRawOutput {
    if (output === null || typeof output === "string") return output;
    return isJsonValue(output) ? cloneAndFreezeJson(output) : null;
  }
}
