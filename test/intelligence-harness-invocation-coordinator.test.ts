import { describe, expect, it } from "vitest";

import {
  ModelInvocationCoordinator,
  ModelProviderRegistry,
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
  maximumInputTokens: 512,
  maximumOutputTokens: 128,
  maximumTotalTokens: 640,
  maximumInputCharacters: 2_000,
  maximumOutputCharacters: 1_000,
  deadlineMilliseconds: 1_000,
  maximumAttempts: 1,
};

const output: StructuredOutputContract<Answer> = {
  schemaId: "answer",
  schemaVersion: "1",
  purpose: "Return an answer.",
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

function providerDescriptor(
  providerId = "provider-a",
  overrides: Partial<ProviderDescriptor> = {},
): ProviderDescriptor {
  return {
    providerId,
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
    maximumConcurrentInvocations: 4,
    ...overrides,
  };
}

function modelDescriptor(
  providerId = "provider-a",
  modelId = "model-a",
  overrides: Partial<ModelDescriptor> = {},
): ModelDescriptor {
  return {
    modelId,
    providerId,
    providerModelName: `${providerId}/${modelId}`,
    modelRevision: "revision-1",
    family: "fixture",
    contextWindowTokens: 2_048,
    maximumOutputTokens: 512,
    supportedInputModalities: ["text"],
    supportedOutputModalities: ["text", "json"],
    structuredOutput: true,
    deterministicSeed: true,
    temperatureControl: true,
    executionKind: "test",
    ...overrides,
  };
}

function response(
  model = modelDescriptor(),
  overrides: Partial<ProviderInvocationResponse> = {},
): ProviderInvocationResponse {
  return {
    providerId: model.providerId,
    modelId: model.modelId,
    providerModelName: model.providerModelName,
    modelRevision: model.modelRevision,
    output: { answer: "hold the signal" },
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    providerResponseId: "response-1",
    diagnostics: { queue: "none" },
    ...overrides,
  };
}

function request(
  invocationId = "invocation-1",
  overrides: Partial<ModelInvocationRequest<Answer>> = {},
): ModelInvocationRequest<Answer> {
  return {
    invocationId,
    providerId: "provider-a",
    modelId: "model-a",
    messages: [
      { role: "system", content: "Return JSON.", trust: "trusted" },
      { role: "context", content: "Evidence.", trust: "untrusted" },
      { role: "user", content: "Advise." },
    ],
    budget,
    output,
    parameters: { temperature: 0, seed: 7 },
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
  callbacks: (() => void)[] = [];
  cancelled = 0;

  schedule(_delayMilliseconds: number, callback: () => void): () => void {
    this.callbacks.push(callback);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.cancelled += 1;
    };
  }

  fire(index = 0): void {
    this.callbacks[index]?.();
  }
}

class ScriptedAdapter implements ModelProviderAdapter {
  invokeCount = 0;
  disposeCount = 0;
  seen: NormalizedInvocationRequest[] = [];

  constructor(
    readonly provider: ProviderDescriptor,
    readonly models: readonly ModelDescriptor[],
    readonly script: (
      request: NormalizedInvocationRequest,
      signal: AbortSignal,
    ) => Promise<ProviderInvocationResponse>,
  ) {}

  descriptor(): ProviderDescriptor {
    return this.provider;
  }

  listModels(): readonly ModelDescriptor[] {
    return this.models;
  }

  invoke(
    normalized: NormalizedInvocationRequest,
    signal: AbortSignal,
  ): Promise<ProviderInvocationResponse> {
    this.invokeCount += 1;
    this.seen.push(normalized);
    return this.script(normalized, signal);
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

function setup(
  adapter = new ScriptedAdapter(providerDescriptor(), [modelDescriptor()], async () => response()),
  scheduler = new ManualScheduler(),
): {
  readonly registry: ModelProviderRegistry;
  readonly coordinator: ModelInvocationCoordinator;
  readonly adapter: ScriptedAdapter;
  readonly scheduler: ManualScheduler;
} {
  const registry = new ModelProviderRegistry();
  registry.registerProvider(adapter);
  const coordinator = new ModelInvocationCoordinator(registry, {
    deadlineScheduler: scheduler,
  });
  return { registry, coordinator, adapter, scheduler };
}

describe("KTS-I4-B invocation coordinator", () => {
  it("returns a validated structured success", async () => {
    const { coordinator } = setup();
    const result = await coordinator.invoke(request());

    expect(result).toMatchObject({ ok: true, output: { answer: "hold the signal" } });
  });

  it("preserves exact requested and actual model provenance", async () => {
    const { coordinator } = setup();
    const result = await coordinator.invoke(request());

    expect(result.ok && result.provenance).toMatchObject({
      invocationId: "invocation-1",
      requestedProviderId: "provider-a",
      requestedModelId: "model-a",
      actualProviderId: "provider-a",
      actualModelId: "model-a",
      providerModelName: "provider-a/model-a",
      modelRevision: "revision-1",
      providerAdapterVersion: "adapter-1",
      outputSchemaId: "answer",
      outputSchemaVersion: "1",
      providerResponseId: "response-1",
    });
  });

  it("passes one exact normalized request to the selected provider", async () => {
    const { coordinator, adapter } = setup();
    await coordinator.invoke(request());

    expect(adapter.invokeCount).toBe(1);
    expect(adapter.seen[0]).toMatchObject({
      providerId: "provider-a",
      modelId: "model-a",
      providerModelName: "provider-a/model-a",
      modelRevision: "revision-1",
    });
  });

  it("freezes the provider request and nested records", async () => {
    const { coordinator, adapter } = setup();
    await coordinator.invoke(request());
    const seen = adapter.seen[0];

    expect(Object.isFrozen(seen)).toBe(true);
    expect(Object.isFrozen(seen?.messages)).toBe(true);
    expect(Object.isFrozen(seen?.messages[0])).toBe(true);
    expect(Object.isFrozen(seen?.budget)).toBe(true);
    expect(Object.isFrozen(seen?.outputSchema.schema)).toBe(true);
  });

  it("prevents provider mutation from altering caller records", async () => {
    const messages = [{ role: "user" as const, content: "original" }];
    let mutationRejected = false;
    const adapter = new ScriptedAdapter(
      providerDescriptor(),
      [modelDescriptor()],
      async (normalized) => {
        try {
          (normalized.messages as unknown as Array<{ content: string }>)[0]!.content =
            "provider mutation";
        } catch {
          mutationRejected = true;
        }
        return response();
      },
    );
    const { coordinator } = setup(adapter);
    const result = await coordinator.invoke(request("provider-mutation", { messages }));

    expect(result.ok).toBe(true);
    expect(mutationRejected).toBe(true);
    expect(messages[0]?.content).toBe("original");
  });

  it("isolates the provider request from caller mutation", async () => {
    const messages = [{ role: "user" as const, content: "original" }];
    const pending = deferred<ProviderInvocationResponse>();
    const adapter = new ScriptedAdapter(
      providerDescriptor(),
      [modelDescriptor()],
      async () => pending.promise,
    );
    const { coordinator } = setup(adapter);
    const invocation = coordinator.invoke(request("mutation", { messages }));

    messages[0] = { role: "user", content: "changed" };
    pending.resolve(response());
    await invocation;

    expect(adapter.seen[0]?.messages[0]?.content).toBe("original");
  });

  it("returns unknown usage explicitly when provider usage is absent", async () => {
    const adapter = new ScriptedAdapter(providerDescriptor(), [modelDescriptor()], async () =>
      response(modelDescriptor(), { usage: undefined }),
    );
    const { coordinator } = setup(adapter);
    const result = await coordinator.invoke(request());

    expect(result.ok && result.usage).toEqual({
      source: "unknown",
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    });
  });

  it("preserves provider-reported usage without estimating it", async () => {
    const { coordinator } = setup();
    const result = await coordinator.invoke(request());

    expect(result.ok && result.usage).toEqual({
      source: "provider",
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it("returns unknown_provider before adapter invocation", async () => {
    const { coordinator, adapter } = setup();
    const result = await coordinator.invoke(request("unknown-provider", { providerId: "missing" }));

    expect(result).toMatchObject({ ok: false, code: "unknown_provider" });
    expect(adapter.invokeCount).toBe(0);
  });

  it("returns unknown_model before adapter invocation", async () => {
    const { coordinator, adapter } = setup();
    const result = await coordinator.invoke(request("unknown-model", { modelId: "missing" }));

    expect(result).toMatchObject({ ok: false, code: "unknown_model" });
    expect(adapter.invokeCount).toBe(0);
  });

  it("distinguishes a model registered to another provider", async () => {
    const registry = new ModelProviderRegistry();
    const adapterA = new ScriptedAdapter(
      providerDescriptor("provider-a"),
      [modelDescriptor("provider-a", "model-a")],
      async () => response(),
    );
    const adapterB = new ScriptedAdapter(
      providerDescriptor("provider-b"),
      [modelDescriptor("provider-b", "model-b")],
      async () => response(modelDescriptor("provider-b", "model-b")),
    );
    registry.registerProvider(adapterA);
    registry.registerProvider(adapterB);
    const coordinator = new ModelInvocationCoordinator(registry, {
      deadlineScheduler: new ManualScheduler(),
    });

    const result = await coordinator.invoke(request("mismatch", { modelId: "model-b" }));
    expect(result).toMatchObject({ ok: false, code: "provider_model_mismatch" });
  });

  it("rejects unsupported structured output before invocation", async () => {
    const descriptor = providerDescriptor("provider-a", {
      capabilities: {
        ...providerDescriptor().capabilities,
        structuredOutput: false,
      },
    });
    const adapter = new ScriptedAdapter(descriptor, [modelDescriptor()], async () => response());
    const { coordinator } = setup(adapter);
    const result = await coordinator.invoke(request());

    expect(result).toMatchObject({ ok: false, code: "unsupported_capability" });
    expect(adapter.invokeCount).toBe(0);
  });

  it("rejects unsupported deterministic seed requests", async () => {
    const descriptor = providerDescriptor("provider-a", {
      capabilities: {
        ...providerDescriptor().capabilities,
        deterministicSeed: false,
      },
    });
    const adapter = new ScriptedAdapter(
      descriptor,
      [modelDescriptor("provider-a", "model-a", { deterministicSeed: false })],
      async () => response(),
    );
    const { coordinator } = setup(adapter);
    const result = await coordinator.invoke(request());

    expect(result).toMatchObject({ ok: false, code: "unsupported_capability" });
  });

  it("rejects unsupported temperature control", async () => {
    const descriptor = providerDescriptor("provider-a", {
      capabilities: {
        ...providerDescriptor().capabilities,
        temperatureControl: false,
      },
    });
    const adapter = new ScriptedAdapter(
      descriptor,
      [modelDescriptor("provider-a", "model-a", { temperatureControl: false })],
      async () => response(),
    );
    const { coordinator } = setup(adapter);
    const result = await coordinator.invoke(request());

    expect(result).toMatchObject({ ok: false, code: "unsupported_capability" });
  });

  it("rejects an output-token budget above the model limit", async () => {
    const { coordinator, adapter } = setup();
    const result = await coordinator.invoke(
      request("model-output-budget", {
        budget: { ...budget, maximumOutputTokens: 513, maximumTotalTokens: 1_024 },
      }),
    );

    expect(result).toMatchObject({ ok: false, code: "budget_exceeded" });
    expect(adapter.invokeCount).toBe(0);
  });

  it("rejects a total-token budget above the context window", async () => {
    const { coordinator } = setup();
    const result = await coordinator.invoke(
      request("context-budget", {
        budget: {
          ...budget,
          maximumInputTokens: 1_800,
          maximumOutputTokens: 400,
          maximumTotalTokens: 2_200,
        },
      }),
    );

    expect(result).toMatchObject({ ok: false, code: "budget_exceeded" });
  });

  it("rejects input above its character budget", async () => {
    const { coordinator, adapter } = setup();
    const result = await coordinator.invoke(
      request("input-large", {
        messages: [{ role: "user", content: "12345" }],
        budget: { ...budget, maximumInputCharacters: 4 },
      }),
    );

    expect(result).toMatchObject({ ok: false, code: "input_too_large" });
    expect(adapter.invokeCount).toBe(0);
  });

  it("supports independent concurrent invocations", async () => {
    const pendingA = deferred<ProviderInvocationResponse>();
    const pendingB = deferred<ProviderInvocationResponse>();
    const adapter = new ScriptedAdapter(
      providerDescriptor(),
      [modelDescriptor()],
      async (normalized) => (normalized.invocationId === "a" ? pendingA.promise : pendingB.promise),
    );
    const { coordinator } = setup(adapter);
    const invocationA = coordinator.invoke(request("a"));
    const invocationB = coordinator.invoke(request("b"));

    expect(coordinator.activeInvocationCount).toBe(2);
    pendingB.resolve(response());
    pendingA.resolve(response());
    const [a, b] = await Promise.all([invocationA, invocationB]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(coordinator.activeInvocationCount).toBe(0);
  });

  it("rejects a duplicate active invocation ID", async () => {
    const pending = deferred<ProviderInvocationResponse>();
    const adapter = new ScriptedAdapter(
      providerDescriptor(),
      [modelDescriptor()],
      async () => pending.promise,
    );
    const { coordinator } = setup(adapter);
    const first = coordinator.invoke(request("duplicate"));
    const second = await coordinator.invoke(request("duplicate"));

    expect(second).toMatchObject({ ok: false, code: "invalid_request" });
    pending.resolve(response());
    await first;
  });

  it("enforces a provider concurrency limit without queueing", async () => {
    const pending = deferred<ProviderInvocationResponse>();
    const adapter = new ScriptedAdapter(
      providerDescriptor("provider-a", { maximumConcurrentInvocations: 1 }),
      [modelDescriptor()],
      async () => pending.promise,
    );
    const { coordinator } = setup(adapter);
    const first = coordinator.invoke(request("first"));
    const second = await coordinator.invoke(request("second"));

    expect(second).toMatchObject({ ok: false, code: "provider_unavailable", retryable: true });
    pending.resolve(response());
    await first;
  });

  it("records elapsed diagnostics only through an injected clock", async () => {
    let now = 100;
    const registry = new ModelProviderRegistry();
    const adapter = new ScriptedAdapter(providerDescriptor(), [modelDescriptor()], async () => {
      now = 125;
      return response();
    });
    registry.registerProvider(adapter);
    const coordinator = new ModelInvocationCoordinator(registry, {
      deadlineScheduler: new ManualScheduler(),
      clock: { now: () => now },
    });
    const result = await coordinator.invoke(request());

    expect(result.ok && result.diagnostics.elapsedMilliseconds).toBe(25);
  });

  it("returns an immutable success record and validated output", async () => {
    const { coordinator } = setup();
    const result = await coordinator.invoke(request());

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.ok && Object.isFrozen(result.output)).toBe(true);
    expect(result.ok && Object.isFrozen(result.provenance)).toBe(true);
  });

  it("rejects new invocations after coordinator disposal", async () => {
    const { coordinator } = setup();
    await coordinator.dispose();
    const result = await coordinator.invoke(request("after-dispose"));

    expect(result).toMatchObject({ ok: false, code: "bridge_disposed" });
  });

  it("disposes the registered provider exactly once", async () => {
    const { coordinator, adapter } = setup();
    await coordinator.dispose();
    await coordinator.dispose();
    expect(adapter.disposeCount).toBe(1);
  });
});
