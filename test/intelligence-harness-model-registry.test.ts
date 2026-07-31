import { describe, expect, it } from "vitest";

import {
  ModelProviderRegistry,
  RegistryError,
  type ModelDescriptor,
  type ModelProviderAdapter,
  type ProviderDescriptor,
  type ProviderInvocationResponse,
} from "../app/features/intelligence-harness/model-bridge";

function providerDescriptor(
  providerId = "provider-a",
  overrides: Partial<ProviderDescriptor> = {},
): ProviderDescriptor {
  return {
    providerId,
    providerVersion: "1.0.0",
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
    maximumConcurrentInvocations: 2,
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
    contextWindowTokens: 4_096,
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

class FixtureAdapter implements ModelProviderAdapter {
  disposeCount = 0;

  constructor(
    readonly provider: ProviderDescriptor,
    readonly models: readonly ModelDescriptor[],
  ) {}

  descriptor(): ProviderDescriptor {
    return this.provider;
  }

  listModels(): readonly ModelDescriptor[] {
    return this.models;
  }

  async invoke(): Promise<ProviderInvocationResponse> {
    throw new Error("not used");
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

describe("KTS-I4-B model provider registry", () => {
  it("registers and resolves one exact provider and model", () => {
    const registry = new ModelProviderRegistry();
    const adapter = new FixtureAdapter(providerDescriptor(), [modelDescriptor()]);
    registry.registerProvider(adapter);

    expect(registry.getProvider("provider-a")).toBe(adapter);
    expect(registry.getModel("provider-a", "model-a")?.modelRevision).toBe("revision-1");
  });

  it("returns undefined for an unknown provider", () => {
    const registry = new ModelProviderRegistry();
    expect(registry.getProvider("missing")).toBeUndefined();
  });

  it("returns undefined for an unknown model", () => {
    const registry = new ModelProviderRegistry();
    registry.registerProvider(new FixtureAdapter(providerDescriptor(), [modelDescriptor()]));
    expect(registry.getModel("provider-a", "missing")).toBeUndefined();
  });

  it("indexes the exact owner of a registered model", () => {
    const registry = new ModelProviderRegistry();
    registry.registerProvider(new FixtureAdapter(providerDescriptor(), [modelDescriptor()]));
    expect(registry.getModelOwner("model-a")).toBe("provider-a");
  });

  it("rejects duplicate provider identities", () => {
    const registry = new ModelProviderRegistry();
    registry.registerProvider(new FixtureAdapter(providerDescriptor(), [modelDescriptor()]));
    expect(() =>
      registry.registerProvider(
        new FixtureAdapter(providerDescriptor(), [modelDescriptor("provider-a", "model-b")]),
      ),
    ).toThrowError(RegistryError);
  });

  it("rejects duplicate models within one provider", () => {
    const registry = new ModelProviderRegistry();
    expect(() =>
      registry.registerProvider(
        new FixtureAdapter(providerDescriptor(), [modelDescriptor(), modelDescriptor()]),
      ),
    ).toThrow(/already registered/);
  });

  it("rejects duplicate model identities across providers", () => {
    const registry = new ModelProviderRegistry();
    registry.registerProvider(
      new FixtureAdapter(providerDescriptor("provider-a"), [
        modelDescriptor("provider-a", "shared-model"),
      ]),
    );
    expect(() =>
      registry.registerProvider(
        new FixtureAdapter(providerDescriptor("provider-b"), [
          modelDescriptor("provider-b", "shared-model"),
        ]),
      ),
    ).toThrow(/already registered/);
  });

  it("rejects a model assigned to another provider", () => {
    const registry = new ModelProviderRegistry();
    expect(() =>
      registry.registerProvider(
        new FixtureAdapter(providerDescriptor("provider-a"), [
          modelDescriptor("provider-b", "model-a"),
        ]),
      ),
    ).toThrow(/does not belong/);
  });

  it("rejects a model execution kind that differs from its provider", () => {
    const registry = new ModelProviderRegistry();
    expect(() =>
      registry.registerProvider(
        new FixtureAdapter(providerDescriptor(), [
          modelDescriptor("provider-a", "model-a", { executionKind: "local" }),
        ]),
      ),
    ).toThrow(/execution kind/);
  });

  it("rejects an invalid provider descriptor", () => {
    const registry = new ModelProviderRegistry();
    expect(() =>
      registry.registerProvider(
        new FixtureAdapter(providerDescriptor(""), [modelDescriptor("", "model-a")]),
      ),
    ).toThrow(/providerId/);
  });

  it("rejects an invalid model descriptor", () => {
    const registry = new ModelProviderRegistry();
    expect(() =>
      registry.registerProvider(
        new FixtureAdapter(providerDescriptor(), [
          modelDescriptor("provider-a", "", { contextWindowTokens: 0 }),
        ]),
      ),
    ).toThrow(/modelId/);
  });

  it("returns an immutable registry snapshot", () => {
    const registry = new ModelProviderRegistry();
    registry.registerProvider(new FixtureAdapter(providerDescriptor(), [modelDescriptor()]));
    const snapshot = registry.snapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(Object.isFrozen(snapshot[0]?.models)).toBe(true);
    expect(Object.isFrozen(snapshot[0]?.descriptor)).toBe(true);
  });

  it("snapshot mutation cannot change exact lookup state", () => {
    const registry = new ModelProviderRegistry();
    registry.registerProvider(new FixtureAdapter(providerDescriptor(), [modelDescriptor()]));
    const snapshot = registry.snapshot();

    expect(() => {
      (snapshot as unknown as unknown[]).push("bad");
    }).toThrow();
    expect(registry.getModel("provider-a", "model-a")?.modelId).toBe("model-a");
  });

  it("returns false when removing an unknown provider", async () => {
    const registry = new ModelProviderRegistry();
    await expect(registry.removeProvider("missing")).resolves.toBe(false);
  });

  it("rejects removal while provider work is active", async () => {
    const registry = new ModelProviderRegistry();
    registry.registerProvider(new FixtureAdapter(providerDescriptor(), [modelDescriptor()]));
    await expect(registry.removeProvider("provider-a", 1)).rejects.toThrow(/active invocations/);
  });

  it("removes and disposes an inactive provider", async () => {
    const registry = new ModelProviderRegistry();
    const adapter = new FixtureAdapter(providerDescriptor(), [modelDescriptor()]);
    registry.registerProvider(adapter);

    await expect(registry.removeProvider("provider-a")).resolves.toBe(true);
    expect(adapter.disposeCount).toBe(1);
    expect(registry.getProvider("provider-a")).toBeUndefined();
    expect(registry.getModelOwner("model-a")).toBeUndefined();
  });

  it("provider registration order does not change exact lookup", () => {
    const registry = new ModelProviderRegistry();
    registry.registerProvider(
      new FixtureAdapter(providerDescriptor("provider-b"), [
        modelDescriptor("provider-b", "model-b"),
      ]),
    );
    registry.registerProvider(
      new FixtureAdapter(providerDescriptor("provider-a"), [
        modelDescriptor("provider-a", "model-a"),
      ]),
    );

    expect(registry.getModel("provider-a", "model-a")?.providerId).toBe("provider-a");
    expect(registry.getModel("provider-b", "model-b")?.providerId).toBe("provider-b");
  });

  it("exposes registered capabilities without provider mutation", () => {
    const registry = new ModelProviderRegistry();
    const descriptor = providerDescriptor();
    registry.registerProvider(new FixtureAdapter(descriptor, [modelDescriptor()]));
    (descriptor.capabilities as { structuredOutput: boolean }).structuredOutput = false;

    expect(registry.getProviderDescriptor("provider-a")?.capabilities.structuredOutput).toBe(true);
  });

  it("disposes every provider exactly once", async () => {
    const registry = new ModelProviderRegistry();
    const a = new FixtureAdapter(providerDescriptor("provider-a"), [
      modelDescriptor("provider-a", "model-a"),
    ]);
    const b = new FixtureAdapter(providerDescriptor("provider-b"), [
      modelDescriptor("provider-b", "model-b"),
    ]);
    registry.registerProvider(a);
    registry.registerProvider(b);

    await registry.dispose();
    await registry.dispose();
    expect(a.disposeCount).toBe(1);
    expect(b.disposeCount).toBe(1);
  });

  it("rejects registry operations after disposal", async () => {
    const registry = new ModelProviderRegistry();
    await registry.dispose();

    expect(() => registry.snapshot()).toThrow(/disposed/);
    expect(() =>
      registry.registerProvider(new FixtureAdapter(providerDescriptor(), [modelDescriptor()])),
    ).toThrow(/disposed/);
  });
});
