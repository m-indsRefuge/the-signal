import { describe, expect, it } from "vitest";

import {
  INVOCATION_FAILURE_CODES,
  ModelInvocationCoordinator,
  ModelProviderRegistry,
  ProviderFault,
  type DeadlineScheduler,
  type InvocationBudget,
  type ModelDescriptor,
  type ModelInvocationRequest,
  type ModelProviderAdapter,
  type NormalizedInvocationRequest,
  type ProviderDescriptor,
  type ProviderInvocationResponse,
  type StructuredOutputContract,
} from "../app/features/intelligence-harness/model-bridge";

interface Answer {
  readonly answer: string;
}

const budget: InvocationBudget = {
  maximumInputTokens: 100,
  maximumOutputTokens: 50,
  maximumTotalTokens: 150,
  maximumInputCharacters: 1_000,
  maximumOutputCharacters: 200,
  deadlineMilliseconds: 500,
  maximumAttempts: 1,
};

const output: StructuredOutputContract<Answer> = {
  schemaId: "answer",
  schemaVersion: "1",
  purpose: "Return answer.",
  schema: { type: "object", required: ["answer"] },
  strictness: "strict",
  decode(raw) {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  },
  validate(value): value is Answer {
    return (
      typeof value === "object" &&
      value !== null &&
      "answer" in value &&
      typeof value.answer === "string"
    );
  },
};

const provider: ProviderDescriptor = {
  providerId: "provider-a",
  providerVersion: "adapter-1",
  executionKind: "test",
  supportedInputModalities: ["text"],
  supportedOutputModalities: ["text", "json"],
  capabilities: {
    textInput: true,
    textOutput: true,
    structuredOutput: true,
    streaming: false,
    cancellation: true,
    usageReporting: true,
    deterministicSeed: true,
    temperatureControl: true,
    localExecution: false,
    remoteExecution: false,
  },
};

const model: ModelDescriptor = {
  modelId: "model-a",
  providerId: "provider-a",
  providerModelName: "provider-a/model-a",
  modelRevision: "revision-1",
  family: "fixture",
  contextWindowTokens: 1_000,
  maximumOutputTokens: 200,
  supportedInputModalities: ["text"],
  supportedOutputModalities: ["text", "json"],
  structuredOutput: true,
  deterministicSeed: true,
  temperatureControl: true,
  executionKind: "test",
};

function request(
  invocationId = "failure-case",
  overrides: Partial<ModelInvocationRequest<Answer>> = {},
): ModelInvocationRequest<Answer> {
  return {
    invocationId,
    providerId: provider.providerId,
    modelId: model.modelId,
    messages: [{ role: "user", content: "Return an answer." }],
    budget,
    output,
    ...overrides,
  };
}

function successResponse(
  overrides: Partial<ProviderInvocationResponse> = {},
): ProviderInvocationResponse {
  return {
    providerId: provider.providerId,
    modelId: model.modelId,
    providerModelName: model.providerModelName,
    modelRevision: model.modelRevision,
    output: { answer: "ok" },
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    ...overrides,
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class ManualScheduler implements DeadlineScheduler {
  callback: (() => void) | undefined;
  cancelled = 0;

  schedule(_delayMilliseconds: number, callback: () => void): () => void {
    this.callback = callback;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.cancelled += 1;
    };
  }

  fire(): void {
    this.callback?.();
  }
}

class ScriptedAdapter implements ModelProviderAdapter {
  invokeCount = 0;
  disposeCount = 0;

  constructor(
    readonly script: (
      request: NormalizedInvocationRequest,
      signal: AbortSignal,
    ) => Promise<ProviderInvocationResponse>,
  ) {}

  descriptor(): ProviderDescriptor {
    return provider;
  }

  listModels(): readonly ModelDescriptor[] {
    return [model];
  }

  invoke(
    normalized: NormalizedInvocationRequest,
    signal: AbortSignal,
  ): Promise<ProviderInvocationResponse> {
    this.invokeCount += 1;
    return this.script(normalized, signal);
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

function setup(
  script: (
    request: NormalizedInvocationRequest,
    signal: AbortSignal,
  ) => Promise<ProviderInvocationResponse>,
  scheduler = new ManualScheduler(),
): {
  readonly coordinator: ModelInvocationCoordinator;
  readonly adapter: ScriptedAdapter;
  readonly scheduler: ManualScheduler;
} {
  const registry = new ModelProviderRegistry();
  const adapter = new ScriptedAdapter(script);
  registry.registerProvider(adapter);
  const coordinator = new ModelInvocationCoordinator(registry, {
    deadlineScheduler: scheduler,
  });
  return { coordinator, adapter, scheduler };
}

describe("KTS-I4-B invocation failures", () => {
  it("exports the complete closed failure-code taxonomy", () => {
    expect(INVOCATION_FAILURE_CODES).toHaveLength(19);
    expect(new Set(INVOCATION_FAILURE_CODES).size).toBe(19);
  });

  it("returns bridge_internal_failure when registry resolution breaks unexpectedly", async () => {
    const brokenRegistry = {
      getProvider() {
        throw new Error("internal registry break");
      },
      getProviderDescriptor() {
        return undefined;
      },
      getModel() {
        return undefined;
      },
      getModelOwner() {
        return undefined;
      },
      async dispose() {},
    } as unknown as ModelProviderRegistry;
    const coordinator = new ModelInvocationCoordinator(brokenRegistry, {
      deadlineScheduler: new ManualScheduler(),
    });

    await expect(coordinator.invoke(request("bridge-internal"))).resolves.toMatchObject({
      ok: false,
      code: "bridge_internal_failure",
    });
  });

  it("returns invalid_request for missing invocation identity", async () => {
    const { coordinator } = setup(async () => successResponse());
    const result = await coordinator.invoke(request("", { invocationId: "" }));
    expect(result).toMatchObject({ ok: false, code: "invalid_request" });
  });

  it("cancels before provider invocation", async () => {
    const controller = new AbortController();
    controller.abort();
    const { coordinator, adapter } = setup(async () => successResponse());
    const result = await coordinator.invoke(request(), controller.signal);

    expect(result).toMatchObject({ ok: false, code: "cancelled" });
    expect(adapter.invokeCount).toBe(0);
  });

  it("cancels during provider invocation", async () => {
    const pending = deferred<ProviderInvocationResponse>();
    const controller = new AbortController();
    const { coordinator } = setup(async () => pending.promise);
    const invocation = coordinator.invoke(request(), controller.signal);
    controller.abort();

    await expect(invocation).resolves.toMatchObject({ ok: false, code: "cancelled" });
  });

  it("returns deadline_exceeded when the injected scheduler fires", async () => {
    const pending = deferred<ProviderInvocationResponse>();
    const scheduler = new ManualScheduler();
    const { coordinator } = setup(async () => pending.promise, scheduler);
    const invocation = coordinator.invoke(request(), undefined);
    scheduler.fire();

    await expect(invocation).resolves.toMatchObject({
      ok: false,
      code: "deadline_exceeded",
      retryable: true,
    });
  });

  it("suppresses a late provider completion after cancellation", async () => {
    const pending = deferred<ProviderInvocationResponse>();
    const controller = new AbortController();
    const { coordinator } = setup(async () => pending.promise);
    const invocation = coordinator.invoke(request(), controller.signal);
    controller.abort();
    pending.resolve(successResponse());

    await expect(invocation).resolves.toMatchObject({ ok: false, code: "cancelled" });
  });

  it("returns bridge_disposed for active work terminated by disposal", async () => {
    const pending = deferred<ProviderInvocationResponse>();
    const { coordinator } = setup(async () => pending.promise);
    const invocation = coordinator.invoke(request());
    await coordinator.dispose();

    await expect(invocation).resolves.toMatchObject({
      ok: false,
      code: "bridge_disposed",
    });
  });

  it("maps provider unavailable faults", async () => {
    const { coordinator } = setup(async () => {
      throw new ProviderFault({
        kind: "unavailable",
        retryable: true,
        safeMessage: "Provider temporarily unavailable.",
      });
    });
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_unavailable",
      retryable: true,
    });
  });

  it("maps provider rejection faults", async () => {
    const { coordinator } = setup(async () => {
      throw new ProviderFault({
        kind: "rejected",
        retryable: false,
        safeMessage: "Provider rejected the request.",
      });
    });
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_rejected",
    });
  });

  it("maps provider transport faults", async () => {
    const { coordinator } = setup(async () => {
      throw new ProviderFault({
        kind: "transport",
        retryable: true,
        safeMessage: "Transport failed.",
      });
    });
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_transport_failure",
    });
  });

  it("maps provider internal faults", async () => {
    const { coordinator } = setup(async () => {
      throw new ProviderFault({
        kind: "internal",
        retryable: false,
        safeMessage: "Provider failed internally.",
      });
    });
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_internal_failure",
    });
  });

  it("sanitizes unclassified provider exceptions", async () => {
    const { coordinator } = setup(async () => {
      throw new Error("secret-token=CANNOT-LEAK");
    });
    const result = await coordinator.invoke(request());

    expect(result).toMatchObject({ ok: false, code: "provider_internal_failure" });
    expect(result.ok ? "" : result.message).not.toContain("CANNOT-LEAK");
  });

  it("rejects null provider output", async () => {
    const { coordinator } = setup(async () => successResponse({ output: null }));
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "empty_output",
    });
  });

  it("rejects blank provider output", async () => {
    const { coordinator } = setup(async () => successResponse({ output: "   " }));
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "empty_output",
    });
  });

  it("rejects malformed structured output", async () => {
    const { coordinator } = setup(async () => successResponse({ output: "{bad" }));
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "malformed_output",
    });
  });

  it("rejects decoded output that violates the schema", async () => {
    const { coordinator } = setup(async () => successResponse({ output: { wrong: true } }));
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "schema_rejected",
    });
  });

  it("rejects decoded non-JSON class instances", async () => {
    const customOutput: StructuredOutputContract<Answer> = {
      ...output,
      decode: () => new Date(),
      validate: (value): value is Answer => value !== undefined,
    };
    const { coordinator } = setup(async () => successResponse());
    const result = await coordinator.invoke(request("class-output", { output: customOutput }));

    expect(result).toMatchObject({ ok: false, code: "schema_rejected" });
  });

  it("omits raw failed output by default", async () => {
    const { coordinator } = setup(async () => successResponse({ output: "{bad" }));
    const result = await coordinator.invoke(request());

    expect(result.ok ? undefined : result.rawOutput).toBeUndefined();
  });

  it("includes raw failed output only when explicitly requested", async () => {
    const { coordinator } = setup(async () => successResponse({ output: { wrong: true } }));
    const result = await coordinator.invoke(request("raw", { exposeRawFailureOutput: true }));

    expect(result.ok ? undefined : result.rawOutput).toEqual({ wrong: true });
    expect(result.ok ? false : Object.isFrozen(result.rawOutput)).toBe(true);
  });

  it("rejects provider output above the character budget", async () => {
    const { coordinator } = setup(async () =>
      successResponse({ output: { answer: "x".repeat(300) } }),
    );
    const result = await coordinator.invoke(request());
    expect(result).toMatchObject({ ok: false, code: "output_too_large" });
  });

  it("rejects invalid provider token-usage metadata", async () => {
    const { coordinator } = setup(async () =>
      successResponse({ usage: { inputTokens: -1, outputTokens: 1, totalTokens: 0 } }),
    );
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_internal_failure",
    });
  });

  it("rejects provider-reported input token overflow", async () => {
    const { coordinator } = setup(async () =>
      successResponse({ usage: { inputTokens: 101, outputTokens: 1, totalTokens: 102 } }),
    );
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "budget_exceeded",
    });
  });

  it("rejects provider-reported output token overflow", async () => {
    const { coordinator } = setup(async () =>
      successResponse({ usage: { inputTokens: 1, outputTokens: 51, totalTokens: 52 } }),
    );
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "budget_exceeded",
    });
  });

  it("rejects provider-reported total token overflow", async () => {
    const { coordinator } = setup(async () =>
      successResponse({ usage: { inputTokens: 100, outputTokens: 50, totalTokens: 151 } }),
    );
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "budget_exceeded",
    });
  });

  it("rejects actual provider identity substitution", async () => {
    const { coordinator } = setup(async () => successResponse({ providerId: "provider-b" }));
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_model_mismatch",
    });
  });

  it("rejects actual model identity substitution", async () => {
    const { coordinator } = setup(async () => successResponse({ modelId: "model-b" }));
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_model_mismatch",
    });
  });

  it("rejects provider model-name substitution", async () => {
    const { coordinator } = setup(async () =>
      successResponse({ providerModelName: "alias/latest" }),
    );
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_model_mismatch",
    });
  });

  it("rejects provider model-revision substitution", async () => {
    const { coordinator } = setup(async () => successResponse({ modelRevision: "revision-2" }));
    await expect(coordinator.invoke(request())).resolves.toMatchObject({
      ok: false,
      code: "provider_model_mismatch",
    });
  });

  it("cleans the external abort listener after success", async () => {
    let listeners = 0;
    const real = new AbortController();
    const signal = {
      get aborted() {
        return real.signal.aborted;
      },
      addEventListener() {
        listeners += 1;
      },
      removeEventListener() {
        listeners -= 1;
      },
    } as unknown as AbortSignal;
    const { coordinator } = setup(async () => successResponse());

    await coordinator.invoke(request(), signal);
    expect(listeners).toBe(0);
  });

  it("cancels the scheduled deadline after success", async () => {
    const scheduler = new ManualScheduler();
    const { coordinator } = setup(async () => successResponse(), scheduler);
    await coordinator.invoke(request());
    expect(scheduler.cancelled).toBe(1);
  });
});
