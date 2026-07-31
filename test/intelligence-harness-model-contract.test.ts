import { describe, expect, it } from "vitest";

import {
  cloneAndFreezeJson,
  isJsonValue,
  normalizeInvocationRequest,
  validateInvocationBudget,
  validateInvocationRequest,
  validateModelDescriptor,
  validateProviderDescriptor,
  validateStructuredOutputContract,
  type InvocationBudget,
  type ModelDescriptor,
  type ModelInvocationRequest,
  type ProviderDescriptor,
  type StructuredOutputContract,
} from "../app/features/intelligence-harness/model-bridge";

interface Answer {
  readonly answer: string;
}

const provider: ProviderDescriptor = {
  providerId: "test-provider",
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
};

const model: ModelDescriptor = {
  modelId: "test-model-r1",
  providerId: provider.providerId,
  providerModelName: "test/model",
  modelRevision: "revision-1",
  family: "test-family",
  parameterClass: "tiny",
  contextWindowTokens: 4_096,
  maximumOutputTokens: 1_024,
  supportedInputModalities: ["text"],
  supportedOutputModalities: ["text", "json"],
  structuredOutput: true,
  deterministicSeed: true,
  temperatureControl: true,
  executionKind: "test",
};

const budget: InvocationBudget = {
  maximumInputTokens: 1_024,
  maximumOutputTokens: 256,
  maximumTotalTokens: 1_280,
  maximumInputCharacters: 8_000,
  maximumOutputCharacters: 2_000,
  deadlineMilliseconds: 1_000,
  maximumAttempts: 1,
};

const output: StructuredOutputContract<Answer> = {
  schemaId: "answer",
  schemaVersion: "1",
  purpose: "Return one answer.",
  schema: {
    type: "object",
    required: ["answer"],
  },
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

function request(): ModelInvocationRequest<Answer> {
  return {
    invocationId: "invocation-1",
    providerId: provider.providerId,
    modelId: model.modelId,
    messages: [
      { role: "system", content: "Return structured output.", trust: "trusted" },
      {
        role: "context",
        content: "Evidence context.",
        sourceLabel: "fixture",
        trust: "untrusted",
        evidenceReferences: [{ evidenceId: "evidence-1", digest: "abc" }],
      },
      { role: "user", content: "Answer now." },
    ],
    budget,
    output,
    parameters: { temperature: 0, seed: 42 },
  };
}

describe("KTS-I4-B model contracts", () => {
  it("accepts every JSON primitive", () => {
    expect([null, true, false, "signal", 0, -4.5].every(isJsonValue)).toBe(true);
  });

  it("accepts nested plain JSON arrays and objects", () => {
    expect(isJsonValue({ a: [1, { b: "two" }, null] })).toBe(true);
  });

  it("rejects non-finite JSON numbers", () => {
    expect(isJsonValue(Number.NaN)).toBe(false);
    expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("rejects undefined, functions, symbols, and bigint", () => {
    expect(isJsonValue(undefined)).toBe(false);
    expect(isJsonValue(() => undefined)).toBe(false);
    expect(isJsonValue(Symbol("x"))).toBe(false);
    expect(isJsonValue(BigInt(1))).toBe(false);
  });

  it("rejects class instances crossing the JSON boundary", () => {
    expect(isJsonValue(new Date())).toBe(false);
  });

  it("rejects cyclic JSON-like records", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isJsonValue(cyclic)).toBe(false);
  });

  it("clones and deeply freezes JSON values", () => {
    const source = { nested: { value: 1 }, list: [1, 2] };
    const frozen = cloneAndFreezeJson(source);
    source.nested.value = 9;
    expect(frozen).toEqual({ nested: { value: 1 }, list: [1, 2] });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
    expect(Object.isFrozen(frozen.list)).toBe(true);
  });

  it("accepts a complete provider descriptor", () => {
    expect(validateProviderDescriptor(provider)).toEqual([]);
  });

  it("rejects a provider without stable identity", () => {
    expect(
      validateProviderDescriptor({ ...provider, providerId: "", providerVersion: " " }),
    ).toEqual(
      expect.arrayContaining(["providerId must be non-empty", "providerVersion must be non-empty"]),
    );
  });

  it("rejects invalid provider concurrency", () => {
    expect(validateProviderDescriptor({ ...provider, maximumConcurrentInvocations: 0 })).toContain(
      "maximumConcurrentInvocations must be a positive integer",
    );
  });

  it("accepts a complete model descriptor", () => {
    expect(validateModelDescriptor(model)).toEqual([]);
  });

  it("rejects a model output limit above its context window", () => {
    expect(
      validateModelDescriptor({
        ...model,
        contextWindowTokens: 100,
        maximumOutputTokens: 101,
      }),
    ).toContain("maximumOutputTokens cannot exceed contextWindowTokens");
  });

  it("requires JSON modality for structured output", () => {
    expect(
      validateModelDescriptor({
        ...model,
        supportedOutputModalities: ["text"],
      }),
    ).toContain("structured-output model must support json output");
  });

  it("accepts a coherent one-attempt budget", () => {
    expect(validateInvocationBudget(budget)).toEqual([]);
  });

  it("rejects retries in the initial bridge contract", () => {
    expect(validateInvocationBudget({ ...budget, maximumAttempts: 2 as 1 })).toContain(
      "maximumAttempts must equal 1",
    );
  });

  it("rejects a total-token budget lower than either component", () => {
    expect(validateInvocationBudget({ ...budget, maximumTotalTokens: 128 })).toEqual(
      expect.arrayContaining([
        "maximumTotalTokens cannot be lower than maximumInputTokens",
        "maximumTotalTokens cannot be lower than maximumOutputTokens",
      ]),
    );
  });

  it("accepts a complete structured-output contract", () => {
    expect(validateStructuredOutputContract(output)).toEqual([]);
  });

  it("rejects incomplete invocation identity and messages", () => {
    expect(
      validateInvocationRequest({
        ...request(),
        invocationId: "",
        messages: [],
      }),
    ).toEqual(
      expect.arrayContaining([
        "invocationId must be non-empty",
        "messages must contain at least one message",
      ]),
    );
  });

  it("preserves the context role, trust, and evidence identity", () => {
    const normalized = normalizeInvocationRequest(request(), model);
    expect(normalized.messages[1]).toEqual({
      role: "context",
      content: "Evidence context.",
      sourceLabel: "fixture",
      trust: "untrusted",
      evidenceReferences: [{ evidenceId: "evidence-1", digest: "abc" }],
    });
  });

  it("normalizes messages and schema into immutable copies", () => {
    const mutableMessages = [...request().messages];
    const mutableSchema = { type: "object", required: ["answer"] };
    const source = {
      ...request(),
      messages: mutableMessages,
      output: { ...output, schema: mutableSchema },
    };
    const normalized = normalizeInvocationRequest(source, model);

    mutableMessages[0] = { role: "user", content: "mutated" };
    mutableSchema.required.push("other");

    expect(normalized.messages[0]?.role).toBe("system");
    expect(normalized.outputSchema.schema).toEqual({
      type: "object",
      required: ["answer"],
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.messages)).toBe(true);
    expect(Object.isFrozen(normalized.outputSchema.schema)).toBe(true);
  });

  it("rejects invalid temperature and seed parameters", () => {
    expect(
      validateInvocationRequest({
        ...request(),
        parameters: { temperature: -1, seed: -4 },
      }),
    ).toEqual(
      expect.arrayContaining([
        "temperature must be a finite non-negative number",
        "seed must be a non-negative integer",
      ]),
    );
  });
});
