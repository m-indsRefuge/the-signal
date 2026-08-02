import { describe, expect, it } from "vitest";

import { InMemoryMemoryRepository } from "../app/features/intelligence-harness/memory-fabric/in-memory-repository";
import type {
  EvidenceQuery,
  MemoryQuery,
  RetrievalResult,
} from "../app/features/intelligence-harness/memory-fabric/retrieval-contract";
import {
  createEvidenceRecord,
  type EvidenceRecord,
} from "../app/features/intelligence-harness/memory-fabric/evidence-contract";
import {
  createEpisodicMemoryRecord,
  type EpisodicMemoryRecord,
} from "../app/features/intelligence-harness/memory-fabric/memory-contract";
import {
  ModelInvocationCoordinator,
  ModelProviderRegistry,
  ProviderFault,
  type DeadlineScheduler,
  type ModelDescriptor,
  type ModelProviderAdapter,
  type NormalizedInvocationRequest,
  type ProviderDescriptor,
  type ProviderInvocationResponse,
  type StructuredOutputContract,
} from "../app/features/intelligence-harness/model-bridge";
import {
  SIGNAL_OFFICER_ADVISER_ROLE,
  type AdviserRequest,
} from "../app/features/intelligence-harness/tactical-adviser/adviser-contract";
import {
  TacticalAdviserCoordinator,
  type AdviserCoordinationInput,
} from "../app/features/intelligence-harness/tactical-adviser/adviser-coordinator";
import {
  KTS_ADVISER_PROMPT_CONTRACT_ID,
  KTS_ADVISER_PROMPT_CONTRACT_VERSION,
} from "../app/features/intelligence-harness/tactical-adviser/context-contract";
import { createStrategyRecord } from "../app/features/intelligence-harness/tactical-adviser/strategy-contract";
import { StrategyPortfolio } from "../app/features/intelligence-harness/tactical-adviser/strategy-portfolio";
import { createInitialGameState } from "../app/features/keep-the-signal/engine";
import {
  DEFAULT_KTS_OBSERVATION_BUDGET,
  projectKtsObservation,
  type KtsObservationPacket,
} from "../app/features/keep-the-signal/intelligence-adapter";
import { KtsTacticalAdviser } from "../app/features/keep-the-signal/tactical-adviser/kts-adviser-adapter";
import type { KtsTacticalProposal } from "../app/features/keep-the-signal/tactical-adviser/kts-proposal-contract";
import { createKtsBaselinePortfolio } from "../app/features/keep-the-signal/tactical-adviser/kts-strategy-portfolio";

interface TestProposal {
  readonly answer: string;
  readonly abstained: boolean;
}

const output: StructuredOutputContract<TestProposal> = {
  schemaId: "kts.tactical-proposal",
  schemaVersion: "1",
  purpose: "Return a test proposal.",
  schema: { type: "object", required: ["answer", "abstained"] },
  strictness: "strict",
  decode(raw) {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  },
  validate(value): value is TestProposal {
    return (
      typeof value === "object" &&
      value !== null &&
      "answer" in value &&
      typeof value.answer === "string" &&
      "abstained" in value &&
      typeof value.abstained === "boolean"
    );
  },
};

function providerDescriptor(): ProviderDescriptor {
  return {
    providerId: "provider:test",
    providerVersion: "1",
    executionKind: "test",
    supportedInputModalities: ["text"],
    supportedOutputModalities: ["json"],
    capabilities: {
      textInput: true,
      textOutput: false,
      structuredOutput: true,
      streaming: false,
      cancellation: true,
      usageReporting: true,
      deterministicSeed: false,
      temperatureControl: false,
      localExecution: false,
      remoteExecution: false,
    },
    maximumConcurrentInvocations: 10,
  };
}

function modelDescriptor(): ModelDescriptor {
  return {
    modelId: "model:test",
    providerId: "provider:test",
    providerModelName: "provider-test/model-test",
    modelRevision: "revision-1",
    family: "fixture",
    contextWindowTokens: 8_000,
    maximumOutputTokens: 1_000,
    supportedInputModalities: ["text"],
    supportedOutputModalities: ["json"],
    structuredOutput: true,
    deterministicSeed: false,
    temperatureControl: false,
    executionKind: "test",
  };
}

class TestAdapter implements ModelProviderAdapter {
  invokeCount = 0;
  seen: NormalizedInvocationRequest[] = [];

  constructor(
    readonly script: (
      request: NormalizedInvocationRequest,
      signal: AbortSignal,
    ) => Promise<ProviderInvocationResponse>,
  ) {}

  descriptor() {
    return providerDescriptor();
  }

  listModels() {
    return [modelDescriptor()];
  }

  async invoke(request: NormalizedInvocationRequest, signal: AbortSignal) {
    this.invokeCount += 1;
    this.seen.push(request);
    return this.script(request, signal);
  }

  dispose() {}
}

class ManualScheduler implements DeadlineScheduler {
  callback: (() => void) | undefined;

  schedule(_delayMilliseconds: number, callback: () => void) {
    this.callback = callback;
    return () => {};
  }
}

class TrackingRepository extends InMemoryMemoryRepository {
  memoryQueries = 0;
  evidenceQueries = 0;
  failQueries = false;
  seenMemoryQuery: MemoryQuery | undefined;
  seenEvidenceQuery: EvidenceQuery | undefined;
  memoryResult: Readonly<RetrievalResult<EpisodicMemoryRecord>> | undefined;
  evidenceResult: Readonly<RetrievalResult<EvidenceRecord>> | undefined;

  override async queryMemory(
    query: Readonly<MemoryQuery>,
  ): Promise<Readonly<RetrievalResult<EpisodicMemoryRecord>>> {
    this.memoryQueries += 1;
    this.seenMemoryQuery = query;
    if (this.failQueries) throw new Error("repository unavailable");
    if (this.memoryResult !== undefined) return this.memoryResult;
    return super.queryMemory(query);
  }

  override async queryEvidence(
    query: Readonly<EvidenceQuery>,
  ): Promise<Readonly<RetrievalResult<EvidenceRecord>>> {
    this.evidenceQueries += 1;
    this.seenEvidenceQuery = query;
    if (this.failQueries) throw new Error("repository unavailable");
    if (this.evidenceResult !== undefined) return this.evidenceResult;
    return super.queryEvidence(query);
  }
}

function fixedRetrievalResult<T extends object>(
  records: readonly Readonly<T>[],
): Readonly<RetrievalResult<T>> {
  return Object.freeze({
    records: Object.freeze([...records]),
    metadata: Object.freeze({
      sourceMatchCount: records.length,
      returnedCount: records.length,
      omittedCount: 0,
      truncated: false,
      serializedCharacters: JSON.stringify(records).length,
      orderingPolicy: "test_fixture",
      appliedFilters: Object.freeze([]),
    }),
  });
}

function response(
  outputValue: ProviderInvocationResponse["output"] = { answer: "hold", abstained: false },
) {
  return {
    providerId: "provider:test",
    modelId: "model:test",
    providerModelName: "provider-test/model-test",
    modelRevision: "revision-1",
    output: outputValue,
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  } satisfies ProviderInvocationResponse;
}

function request(overrides: Partial<AdviserRequest> = {}): AdviserRequest {
  return {
    adviserRequestId: "request:coordinator",
    proposalId: "proposal:coordinator",
    invocationId: "invocation:coordinator",
    roleId: "signal_officer_tactical_adviser",
    roleVersion: "1",
    domainId: "keep-the-signal",
    domainVersion: "engine-1:rules-1",
    observation: {
      observationId: "observation:coordinator",
      observationSchemaId: "kts.observation",
      observationSchemaVersion: 1,
      observationLevel: 1,
      sourceStateDigest: "digest-coordinator",
    },
    providerId: "provider:test",
    modelId: "model:test",
    invocationBudget: {
      maximumInputTokens: 2_000,
      maximumOutputTokens: 500,
      maximumTotalTokens: 2_500,
      maximumInputCharacters: 100_000,
      maximumOutputCharacters: 10_000,
      deadlineMilliseconds: 1_000,
      maximumAttempts: 1,
    },
    contextBudget: {
      maximumMessages: 4,
      maximumSerializedCharacters: 100_000,
      maximumStrategies: 5,
      maximumRetrievedMemories: 5,
      maximumEvidenceReferences: 10,
      maximumObservationCharacters: 10_000,
      maximumReasonCharacters: 600,
      maximumSystemInstructionCharacters: 2_000,
      maximumDeveloperInstructionCharacters: 2_000,
    },
    strategyCandidateBudget: { maximumStrategies: 5, maximumSerializedCharacters: 50_000 },
    retrieval: disabledRetrieval(),
    promptContractId: KTS_ADVISER_PROMPT_CONTRACT_ID,
    promptContractVersion: KTS_ADVISER_PROMPT_CONTRACT_VERSION,
    proposalSchemaId: "kts.tactical-proposal",
    proposalSchemaVersion: "1",
    recordedAt: "2026-08-01T00:00:00.000Z",
    exposeRawFailureOutput: false,
    ...overrides,
  };
}

function disabledRetrieval(): AdviserRequest["retrieval"] {
  return {
    mode: "disabled",
    requestId: "retrieval:disabled",
    allowedDomains: ["keep-the-signal"],
    allowedClassifications: ["internal"],
    acceptedRetentionClasses: ["standard"],
    budget: { resultLimit: 0, maximumSerializedCharacters: 0, relationTraversalLimit: 0 },
  };
}

function enabledRetrieval(): AdviserRequest["retrieval"] {
  const policy = {
    requestId: "retrieval:enabled",
    allowedDomains: ["keep-the-signal"] as const,
    allowedClassifications: ["internal"] as const,
    acceptedRetentionClasses: ["standard"] as const,
    budget: { resultLimit: 5, maximumSerializedCharacters: 10_000, relationTraversalLimit: 1 },
  };
  return {
    mode: "enabled",
    memoryQuery: { ...policy, memoryKinds: ["episodic"] },
    evidenceQuery: { ...policy, sourceTypes: ["observation"] },
  };
}

function ktsObservation(): KtsObservationPacket {
  const projected = projectKtsObservation(createInitialGameState({ seed: 42 }), [], {
    observationId: "observation:kts-adapter",
    requestedLevel: 1,
    budget: DEFAULT_KTS_OBSERVATION_BUDGET,
  });
  if (!projected.ok) throw new Error(projected.failure.message);
  return projected.observation;
}

function ktsRequest(value: Readonly<KtsObservationPacket>): AdviserRequest {
  return request({
    adviserRequestId: "request:kts-adapter",
    proposalId: "proposal:kts-adapter",
    invocationId: "invocation:kts-adapter",
    domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
    observation: {
      observationId: value.metadata.observationId,
      observationSchemaId: value.metadata.observationSchemaId,
      observationSchemaVersion: value.metadata.observationSchemaVersion,
      observationLevel: value.level,
      sourceStateDigest: value.metadata.sourceStateDigest,
    },
    contextBudget: {
      ...request().contextBudget,
      maximumSerializedCharacters: 200_000,
      maximumObservationCharacters: 100_000,
    },
    strategyCandidateBudget: {
      maximumStrategies: 8,
      maximumSerializedCharacters: 100_000,
    },
  });
}

function ktsProposal(value: Readonly<KtsObservationPacket>): KtsTacticalProposal {
  return {
    proposalId: "proposal:kts-adapter",
    proposalSchemaId: "kts.tactical-proposal",
    proposalSchemaVersion: "1",
    adviserRequestId: "request:kts-adapter",
    observationId: value.metadata.observationId,
    sourceStateDigest: value.metadata.sourceStateDigest,
    intent: "advance_wave",
    movement: { moveX: 0, moveY: -1, priority: "medium" },
    fireRecommendation: "hold_fire",
    powerTransferRecommendation: "none",
    recoveryRecommendation: "hold",
    target: { kind: "none", priority: "low" },
    selectedStrategy: { strategyId: "advance-wave", strategyVersion: "1" },
    confidenceBasisPoints: 6_000,
    uncertainty: "medium",
    abstention: { abstained: false },
    reason: "Advance while the bounded observation contains no visible hostile entity.",
    supportingFacts: [
      {
        kind: "observation_field",
        path: "lifecycle.encounterComplete",
        value: value.lifecycle.encounterComplete,
      },
      { kind: "strategy", strategyId: "advance-wave", strategyVersion: "1" },
    ],
    evidenceReferences: [],
    contradictionReferences: [],
    warnings: ["advisory_only_not_final_engine_legality"],
  };
}

async function runKtsModelAdviser(
  value: Readonly<KtsObservationPacket>,
  proposal: Readonly<KtsTacticalProposal>,
  adviserRequest: Readonly<AdviserRequest>,
  repository?: TrackingRepository,
) {
  const adapter = new TestAdapter(async () =>
    response(proposal as unknown as ProviderInvocationResponse["output"]),
  );
  const registry = new ModelProviderRegistry();
  registry.registerProvider(adapter);
  const tacticalAdviser = new KtsTacticalAdviser(
    new ModelInvocationCoordinator(registry),
    repository,
  );
  const portfolio = await createKtsBaselinePortfolio({
    recordedAt: "2026-08-01T00:00:00.000Z",
    actorId: "operator:test",
    domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
  });
  return {
    adapter,
    result: await tacticalAdviser.advise({
      request: adviserRequest,
      observation: value,
      strategyPortfolio: portfolio,
    }),
  };
}

async function omittedMemory(memoryId: string): Promise<Readonly<EpisodicMemoryRecord>> {
  return createEpisodicMemoryRecord({
    memoryId,
    memoryKind: "episodic",
    domainId: "keep-the-signal",
    domainVersion: "engine-1:rules-1",
    significance: "routine",
    summary: { recommendation: "hold" },
    acceptanceState: "accepted",
    classification: "internal",
    retentionClass: "standard",
    tags: [],
    recordedAt: "2026-08-01T00:00:00.000Z",
  });
}

async function omittedEvidence(evidenceId: string): Promise<Readonly<EvidenceRecord>> {
  return createEvidenceRecord({
    evidenceId,
    domainId: "keep-the-signal",
    domainVersion: "engine-1:rules-1",
    sourceType: "observation",
    sourceSchemaId: "kts.observation",
    sourceSchemaVersion: 1,
    sourceIdentity: "observation:omitted",
    authoritativePosition: { tick: 1 },
    payload: { recommendation: "hold" },
    acceptanceState: "accepted",
    classification: "internal",
    retentionClass: "standard",
    tags: [],
    recordedAt: "2026-08-01T00:00:00.000Z",
  });
}

async function strategyPortfolio(applicable = true) {
  const store = new StrategyPortfolio({
    maximumStrategyCount: 10,
    maximumSerializedCharacters: 100_000,
  });
  const record = await createStrategyRecord({
    strategyId: "strategy:test",
    strategyVersion: "1",
    domainId: "keep-the-signal",
    domainVersion: "engine-1:rules-1",
    family: "uncertainty_safe",
    objective: "Hold safely.",
    triggerConditions: [],
    applicabilityConstraints: [],
    actionPreferences: { intent: "hold" },
    terminationConditions: [],
    expectedEffects: ["bounded"],
    knownFailureModes: ["conservative"],
    evidenceReferences: [],
    counterexampleReferences: [],
    confidenceBasisPoints: 1_000,
    calibrationState: "uncalibrated",
    evaluationSummaries: [],
    parentStrategies: [],
    portfolioPriority: 1,
    classification: "deterministic_baseline",
    recordedAt: "2026-08-01T00:00:00.000Z",
    actorId: "operator:test",
  });
  await store.registerStrategy(record);
  return {
    store,
    evaluator: () => ({
      strategyId: record.strategyId,
      strategyVersion: record.strategyVersion,
      applicable,
      applicabilityBasisPoints: applicable ? 1_000 : 0,
      satisfiedConstraints: [],
      unsatisfiedConstraints: [],
      uncertaintyFlags: [],
      supportingObservationReferences: [],
      supportingEvidenceReferences: [],
      evaluatorId: "evaluator",
      evaluatorVersion: "1",
    }),
  };
}

async function harness(
  options: {
    script?: TestAdapter["script"];
    repository?: TrackingRepository;
    scheduler?: ManualScheduler;
    applicable?: boolean;
    validation?: "advisory_valid" | "advisory_rejected" | "abstained";
    request?: AdviserRequest;
    outputContract?: StructuredOutputContract<TestProposal>;
  } = {},
) {
  const adapter = new TestAdapter(options.script ?? (async () => response()));
  const registry = new ModelProviderRegistry();
  registry.registerProvider(adapter);
  const bridge = new ModelInvocationCoordinator(registry, {
    ...(options.scheduler === undefined ? {} : { deadlineScheduler: options.scheduler }),
  });
  const coordinator = new TacticalAdviserCoordinator(bridge, options.repository);
  const { store, evaluator } = await strategyPortfolio(options.applicable ?? true);
  const coordinationInput: AdviserCoordinationInput<TestProposal> = {
    request: options.request ?? request(),
    role: SIGNAL_OFFICER_ADVISER_ROLE,
    observation: { metadata: { observationId: "observation:coordinator" }, signal: 5_000 },
    strategyPortfolio: store,
    applicabilityEvaluator: evaluator,
    userRequest: { request: "advise" },
    output: options.outputContract ?? output,
    validateProposal: (proposal) => ({
      classification: options.validation ?? (proposal.abstained ? "abstained" : "advisory_valid"),
      issues:
        options.validation === "advisory_rejected"
          ? [{ code: "rejected", message: "Rejected." }]
          : [],
    }),
  };
  return { adapter, bridge, coordinator, input: coordinationInput };
}

describe("KTS-I4-E adviser coordinator", () => {
  it("returns a validated advisory proposal", async () => {
    const { coordinator, input } = await harness();
    expect(await coordinator.coordinate(input)).toMatchObject({ classification: "proposal" });
  });

  it("invokes the accepted bridge exactly once", async () => {
    const { coordinator, input, adapter } = await harness();
    await coordinator.coordinate(input);
    expect(adapter.invokeCount).toBe(1);
  });

  it("preserves the exact requested provider and model", async () => {
    const { coordinator, input, adapter } = await harness();
    await coordinator.coordinate(input);
    expect(adapter.seen[0]).toMatchObject({ providerId: "provider:test", modelId: "model:test" });
  });

  it("sends separated system, developer, context, and user messages", async () => {
    const { coordinator, input, adapter } = await harness();
    await coordinator.coordinate(input);
    expect(adapter.seen[0]?.messages.map(({ role }) => role)).toEqual([
      "system",
      "developer",
      "context",
      "user",
    ]);
  });

  it("does not query a repository in explicit zero-memory mode", async () => {
    const repository = new TrackingRepository();
    const { coordinator, input } = await harness({ repository });
    await coordinator.coordinate(input);
    expect([repository.memoryQueries, repository.evidenceQueries]).toEqual([0, 0]);
  });

  it("uses the exact authorized memory and evidence queries", async () => {
    const repository = new TrackingRepository();
    const enabledRequest = request({ retrieval: enabledRetrieval() });
    const { coordinator, input } = await harness({ repository, request: enabledRequest });
    await coordinator.coordinate(input);
    expect([repository.memoryQueries, repository.evidenceQueries]).toEqual([1, 1]);
    expect(repository.seenMemoryQuery).toBe(
      enabledRequest.retrieval.mode === "enabled"
        ? enabledRequest.retrieval.memoryQuery
        : undefined,
    );
  });

  it("fails closed when retrieval is requested without a repository", async () => {
    const { coordinator, input, adapter } = await harness({
      request: request({ retrieval: enabledRetrieval() }),
    });
    const result = await coordinator.coordinate(input);
    expect(result.failure?.code).toBe("retrieval_failed");
    expect(adapter.invokeCount).toBe(0);
  });

  it("does not widen permissions after repository failure", async () => {
    const repository = new TrackingRepository();
    repository.failQueries = true;
    const { coordinator, input, adapter } = await harness({
      repository,
      request: request({ retrieval: enabledRetrieval() }),
    });
    const result = await coordinator.coordinate(input);
    expect(result.failure?.code).toBe("retrieval_failed");
    expect(adapter.invokeCount).toBe(0);
  });

  it("abstains before retrieval or invocation when no strategy is applicable", async () => {
    const repository = new TrackingRepository();
    const { coordinator, input, adapter } = await harness({
      applicable: false,
      repository,
      request: request({ retrieval: enabledRetrieval() }),
    });
    const result = await coordinator.coordinate(input);
    expect(result).toMatchObject({
      classification: "abstention",
      strategySelection: {
        candidates: [],
        evaluatedCount: 1,
        applicableCount: 0,
      },
    });
    expect(result.failure).toBeUndefined();
    expect(adapter.invokeCount).toBe(0);
    expect([repository.memoryQueries, repository.evidenceQueries]).toEqual([0, 0]);
  });

  it("rejects a strategy omitted by context packing as ungrounded", async () => {
    const value = ktsObservation();
    const baseRequest = ktsRequest(value);
    const adviserRequest = {
      ...baseRequest,
      contextBudget: { ...baseRequest.contextBudget, maximumStrategies: 0 },
    };
    const { result } = await runKtsModelAdviser(value, ktsProposal(value), adviserRequest);
    expect(result.coordination.context?.includedStrategies).toEqual([]);
    expect(result.coordination).toMatchObject({
      classification: "rejected",
      proposalValidation: { classification: "advisory_rejected" },
    });
    expect(
      result.coordination.proposalValidation?.issues.some(
        ({ code }) => code === "unsupported_strategy_reference",
      ),
    ).toBe(true);
    expect(adviserRequest.contextBudget.maximumStrategies).toBe(0);
  });

  it("rejects a memory omitted by context packing as ungrounded", async () => {
    const value = ktsObservation();
    const repository = new TrackingRepository();
    repository.memoryResult = fixedRetrievalResult([await omittedMemory("memory:omitted")]);
    const baseRequest = ktsRequest(value);
    const adviserRequest = {
      ...baseRequest,
      retrieval: enabledRetrieval(),
      contextBudget: { ...baseRequest.contextBudget, maximumRetrievedMemories: 0 },
    };
    const proposal = ktsProposal(value);
    const { result } = await runKtsModelAdviser(
      value,
      {
        ...proposal,
        supportingFacts: [
          ...proposal.supportingFacts,
          { kind: "memory", memoryId: "memory:omitted" },
        ],
      },
      adviserRequest,
      repository,
    );
    expect(result.coordination.context?.includedMemoryIds).toEqual([]);
    expect(result.coordination.classification).toBe("rejected");
    expect(
      result.coordination.proposalValidation?.issues.some(
        ({ code }) => code === "proposal_not_grounded",
      ),
    ).toBe(true);
    expect(adviserRequest.contextBudget.maximumRetrievedMemories).toBe(0);
  });

  it("rejects evidence omitted by context packing as ungrounded", async () => {
    const value = ktsObservation();
    const repository = new TrackingRepository();
    repository.evidenceResult = fixedRetrievalResult([await omittedEvidence("evidence:omitted")]);
    const baseRequest = ktsRequest(value);
    const adviserRequest = {
      ...baseRequest,
      retrieval: enabledRetrieval(),
      contextBudget: { ...baseRequest.contextBudget, maximumEvidenceReferences: 0 },
    };
    const proposal = ktsProposal(value);
    const { result } = await runKtsModelAdviser(
      value,
      { ...proposal, evidenceReferences: ["evidence:omitted"] },
      adviserRequest,
      repository,
    );
    expect(result.coordination.context?.includedEvidenceIds).toEqual([]);
    expect(result.coordination.classification).toBe("rejected");
    expect(
      result.coordination.proposalValidation?.issues.some(
        ({ code }) => code === "unsupported_evidence_reference",
      ),
    ).toBe(true);
    expect(adviserRequest.contextBudget.maximumEvidenceReferences).toBe(0);
  });

  it("rejects a contradiction omitted by context packing as ungrounded", async () => {
    const value = ktsObservation();
    const repository = new TrackingRepository();
    repository.evidenceResult = fixedRetrievalResult([
      await omittedEvidence("evidence:contradiction-omitted"),
    ]);
    const baseRequest = ktsRequest(value);
    const retrieval = enabledRetrieval();
    if (retrieval.mode !== "enabled" || retrieval.evidenceQuery === undefined) {
      throw new Error("Expected enabled evidence retrieval fixture.");
    }
    const adviserRequest = {
      ...baseRequest,
      retrieval: {
        ...retrieval,
        evidenceQuery: {
          ...retrieval.evidenceQuery,
          relationType: "contradiction" as const,
          relationEvidenceId: "evidence:anchor",
        },
      },
      contextBudget: { ...baseRequest.contextBudget, maximumEvidenceReferences: 0 },
    };
    const proposal = ktsProposal(value);
    const { result } = await runKtsModelAdviser(
      value,
      { ...proposal, contradictionReferences: ["evidence:contradiction-omitted"] },
      adviserRequest,
      repository,
    );
    expect(result.coordination.context?.includedEvidenceIds).toEqual([]);
    expect(result.coordination.classification).toBe("rejected");
    expect(
      result.coordination.proposalValidation?.issues.some(
        ({ code }) => code === "unsupported_evidence_reference",
      ),
    ).toBe(true);
    expect(adviserRequest.contextBudget.maximumEvidenceReferences).toBe(0);
  });

  it("rejects a structured-output identity mismatch before invocation", async () => {
    const wrong = { ...output, schemaId: "wrong" };
    const { coordinator, input, adapter } = await harness({ outputContract: wrong });
    const result = await coordinator.coordinate(input);
    expect(result.failure?.code).toBe("invalid_prompt_contract");
    expect(adapter.invokeCount).toBe(0);
  });

  it("rejects a reason budget above the Signal Officer boundary", async () => {
    const invalidRequest = request({
      contextBudget: { ...request().contextBudget, maximumReasonCharacters: 601 },
    });
    const { coordinator, input, adapter } = await harness({ request: invalidRequest });
    const result = await coordinator.coordinate(input);
    expect(result.failure?.code).toBe("invalid_context_budget");
    expect(adapter.invokeCount).toBe(0);
  });

  it("rejects an unsupported retrieval mode before invocation", async () => {
    const invalidRequest = request({
      retrieval: { mode: "semantic" } as unknown as AdviserRequest["retrieval"],
    });
    const { coordinator, input, adapter } = await harness({ request: invalidRequest });
    const result = await coordinator.coordinate(input);
    expect(result.failure?.code).toBe("retrieval_not_authorized");
    expect(adapter.invokeCount).toBe(0);
  });

  it("maps malformed provider output without a retry", async () => {
    const { coordinator, input, adapter } = await harness({
      script: async () => response("not-json"),
    });
    const result = await coordinator.coordinate(input);
    expect(result.failure?.code).toBe("proposal_malformed");
    expect(adapter.invokeCount).toBe(1);
  });

  it("maps schema-rejected provider output", async () => {
    const { coordinator, input } = await harness({ script: async () => response({ wrong: true }) });
    const result = await coordinator.coordinate(input);
    expect(result).toMatchObject({
      classification: "rejected",
      failure: { code: "proposal_schema_rejected" },
    });
  });

  it("does not retry a retryable provider fault", async () => {
    const { coordinator, input, adapter } = await harness({
      script: async () => {
        throw new ProviderFault({
          kind: "unavailable",
          retryable: true,
          safeMessage: "Unavailable.",
        });
      },
    });
    const result = await coordinator.coordinate(input);
    expect(result.failure?.code).toBe("bridge_failed");
    expect(adapter.invokeCount).toBe(1);
  });

  it("forwards pre-invocation cancellation", async () => {
    const { coordinator, input, adapter } = await harness();
    const controller = new AbortController();
    controller.abort();
    const result = await coordinator.coordinate(input, controller.signal);
    expect(result.classification).toBe("cancelled");
    expect(adapter.invokeCount).toBe(0);
  });

  it("preserves bridge deadline classification", async () => {
    const scheduler = new ManualScheduler();
    const { coordinator, input } = await harness({
      scheduler,
      script: async () => new Promise<ProviderInvocationResponse>(() => {}),
    });
    const pending = coordinator.coordinate(input);
    for (let index = 0; index < 10 && scheduler.callback === undefined; index += 1) {
      await Promise.resolve();
    }
    scheduler.callback?.();
    expect((await pending).classification).toBe("deadline_exceeded");
  });

  it("returns first-class abstention", async () => {
    const { coordinator, input } = await harness({
      script: async () => response({ answer: "uncertain", abstained: true }),
    });
    expect((await coordinator.coordinate(input)).classification).toBe("abstention");
  });

  it("returns deterministic semantic rejection", async () => {
    const { coordinator, input } = await harness({ validation: "advisory_rejected" });
    const result = await coordinator.coordinate(input);
    expect(result).toMatchObject({
      classification: "rejected",
      proposalValidation: { classification: "advisory_rejected" },
    });
  });

  it("clones and freezes decoded model output", async () => {
    const mutable = { answer: "hold", abstained: false };
    const { coordinator, input } = await harness({ script: async () => response(mutable) });
    const result = await coordinator.coordinate(input);
    mutable.answer = "changed";
    expect(result.decodedProposal?.answer).toBe("hold");
    expect(Object.isFrozen(result.decodedProposal)).toBe(true);
  });

  it("withholds raw malformed output by default", async () => {
    const { coordinator, input } = await harness({
      script: async () => response("secret-malformed"),
    });
    const result = await coordinator.coordinate(input);
    expect(
      result.bridgeResult && !result.bridgeResult.ok && result.bridgeResult.rawOutput,
    ).toBeUndefined();
  });

  it("supports independent concurrent adviser requests", async () => {
    const { coordinator, input, adapter } = await harness();
    const second = {
      ...input,
      request: request({
        adviserRequestId: "request:two",
        proposalId: "proposal:two",
        invocationId: "invocation:two",
      }),
    };
    const results = await Promise.all([
      coordinator.coordinate(input),
      coordinator.coordinate(second),
    ]);
    expect(results.every(({ classification }) => classification === "proposal")).toBe(true);
    expect(results.map(({ adviserRequestId }) => adviserRequestId)).toEqual([
      "request:coordinator",
      "request:two",
    ]);
    expect(results.every(Object.isFrozen)).toBe(true);
    expect(adapter.invokeCount).toBe(2);
  });

  it("adapts a validated KTS model proposal and drafts evidence without persistence", async () => {
    const value = ktsObservation();
    const adapter = new TestAdapter(async () =>
      response(ktsProposal(value) as unknown as ProviderInvocationResponse["output"]),
    );
    const registry = new ModelProviderRegistry();
    registry.registerProvider(adapter);
    const bridge = new ModelInvocationCoordinator(registry);
    const tacticalAdviser = new KtsTacticalAdviser(bridge);
    const portfolio = await createKtsBaselinePortfolio({
      recordedAt: "2026-08-01T00:00:00.000Z",
      actorId: "operator:test",
      domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
    });
    const result = await tacticalAdviser.advise({
      request: ktsRequest(value),
      observation: value,
      strategyPortfolio: portfolio,
      observationEvidenceId: "evidence:observation",
      evidenceGovernance: {
        evidenceId: "evidence:kts-adapter-proposal",
        recordedAt: "2026-08-01T00:00:00.000Z",
        acceptanceState: "candidate",
        classification: "internal",
        retentionClass: "benchmark",
        tags: ["kts-adviser"],
      },
    });

    expect(result.coordination.classification).toBe("proposal");
    expect(result.proposalEnvelope?.proposerIdentity).toMatchObject({
      providerId: "provider:test",
      modelId: "model:test",
    });
    expect(result.evidenceDraft?.sourceType).toBe("proposal");
    expect(result.evidenceDraft?.payload).toMatchObject({
      observationEvidenceId: "evidence:observation",
      providerAndModelProvenance: {
        requestedProviderId: "provider:test",
        requestedModelId: "model:test",
        actualProviderId: "provider:test",
        actualModelId: "model:test",
      },
      persistencePerformed: false,
    });
    expect(adapter.invokeCount).toBe(1);
  });

  it("rejects new work after disposal without disposing the accepted bridge", async () => {
    const { coordinator, input, bridge } = await harness();
    coordinator.dispose();
    const result = await coordinator.coordinate(input);
    expect(result.failure?.code).toBe("adviser_disposed");
    expect(bridge.disposed).toBe(false);
  });

  it("returns immutable result and validation records", async () => {
    const { coordinator, input } = await harness();
    const result = await coordinator.coordinate(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.proposalValidation)).toBe(true);
  });
});
