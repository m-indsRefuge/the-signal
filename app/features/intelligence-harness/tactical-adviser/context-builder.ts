import {
  assembleWorkingMemory,
  type WorkingMemoryItemDraft,
} from "../memory-fabric/working-memory";
import { canonicalStringify, canonicalizeJson } from "../memory-fabric/canonical-json";
import type { ModelMessage } from "../model-bridge";
import { requestContext } from "./adviser-contract";
import {
  KTS_ADVISER_PROMPT_CONTRACT_ID,
  KTS_ADVISER_PROMPT_CONTRACT_VERSION,
  SIGNAL_OFFICER_DEVELOPER_INSTRUCTION,
  SIGNAL_OFFICER_SYSTEM_INSTRUCTION,
  type AdviserContextInput,
  type AdviserContextOmission,
  type AdviserContextReport,
} from "./context-contract";
import { failAdviser } from "./failures";
import type { StrategyCandidate } from "./strategy-portfolio";

export function buildAdviserContext(
  input: Readonly<AdviserContextInput>,
): Readonly<AdviserContextReport> {
  const { request, role, observation } = input;
  const budget = request.contextBudget;
  if (
    request.promptContractId !== KTS_ADVISER_PROMPT_CONTRACT_ID ||
    request.promptContractVersion !== KTS_ADVISER_PROMPT_CONTRACT_VERSION
  ) {
    failAdviser(
      "invalid_prompt_contract",
      "context",
      "Prompt contract identity is unsupported.",
      requestContext(request),
    );
  }
  if (
    SIGNAL_OFFICER_SYSTEM_INSTRUCTION.length > budget.maximumSystemInstructionCharacters ||
    SIGNAL_OFFICER_DEVELOPER_INSTRUCTION.length > budget.maximumDeveloperInstructionCharacters ||
    budget.maximumMessages < 4
  ) {
    failAdviser(
      "required_context_omitted",
      "context",
      "Required instruction messages cannot fit the context budget.",
      requestContext(request),
    );
  }
  const observationCharacters = canonicalStringify(observation).length;
  if (observationCharacters > budget.maximumObservationCharacters) {
    failAdviser(
      "required_context_omitted",
      "context",
      "The required observation cannot fit its context budget.",
      requestContext(request),
    );
  }

  const omissions: AdviserContextOmission[] = [];
  const strategies = selectStrategies(input.strategySelection.candidates, budget.maximumStrategies);
  for (const candidate of input.strategySelection.candidates.slice(strategies.length)) {
    omissions.push({ itemId: strategyItemId(candidate), reason: "strategy_count" });
  }
  const memories = input.retrievedMemories.slice(0, budget.maximumRetrievedMemories);
  for (const memory of input.retrievedMemories.slice(memories.length)) {
    omissions.push({ itemId: `memory:${memory.memoryId}`, reason: "retrieved_memory_count" });
  }
  const evidence = input.retrievedEvidence.slice(0, budget.maximumEvidenceReferences);
  for (const record of input.retrievedEvidence.slice(evidence.length)) {
    omissions.push({ itemId: `evidence:${record.evidenceId}`, reason: "evidence_reference_count" });
  }

  const drafts: WorkingMemoryItemDraft[] = [
    {
      itemId: "instruction:system",
      kind: "instruction",
      sequence: 0,
      priority: 10_000,
      required: true,
      sourceIdentity: KTS_ADVISER_PROMPT_CONTRACT_ID,
      content: {
        role: "system",
        promptContractVersion: KTS_ADVISER_PROMPT_CONTRACT_VERSION,
        text: SIGNAL_OFFICER_SYSTEM_INSTRUCTION,
      },
    },
    {
      itemId: "instruction:developer",
      kind: "instruction",
      sequence: 1,
      priority: 10_000,
      required: true,
      sourceIdentity: KTS_ADVISER_PROMPT_CONTRACT_ID,
      content: {
        role: "developer",
        promptContractVersion: KTS_ADVISER_PROMPT_CONTRACT_VERSION,
        text: SIGNAL_OFFICER_DEVELOPER_INSTRUCTION,
      },
    },
    {
      itemId: `observation:${request.observation.observationId}`,
      kind: "observation",
      sequence: 2,
      priority: 10_000,
      required: true,
      sourceIdentity: request.observation.observationId,
      content: observation,
    },
    ...strategies.map((candidate, index) => ({
      itemId: strategyItemId(candidate),
      kind: "inference" as const,
      sequence: 100 + index,
      priority: candidate.applicability.applicabilityBasisPoints,
      required: false,
      sourceIdentity: candidate.strategy.strategyId,
      content: canonicalizeJson({
        record: candidate.strategy,
        applicability: candidate.applicability,
        trust: "candidate_strategy_not_authority",
      }),
      evidenceReferences: candidate.strategy.evidenceReferences,
    })),
    ...memories.map((memory, index) => ({
      itemId: `memory:${memory.memoryId}`,
      kind: "retrieved_memory" as const,
      sequence: 10_000 + index,
      priority: 100,
      required: false,
      sourceIdentity: memory.memoryId,
      content: canonicalizeJson({ record: memory, trust: "untrusted_evidence" }),
      evidenceReferences: [],
    })),
    ...evidence.map((record, index) => ({
      itemId: `evidence:${record.evidenceId}`,
      kind: "evidence_reference" as const,
      sequence: 20_000 + index,
      priority: record.sourceType === "human_correction" ? 200 : 100,
      required: false,
      sourceIdentity: record.evidenceId,
      content: canonicalizeJson({ record, trust: "untrusted_evidence" }),
      evidenceReferences: [record.evidenceId],
    })),
  ];

  const fixedMessageCharacters =
    SIGNAL_OFFICER_SYSTEM_INSTRUCTION.length +
    SIGNAL_OFFICER_DEVELOPER_INSTRUCTION.length +
    canonicalStringify(input.userRequest).length;
  const workingMemoryCharacters = budget.maximumSerializedCharacters - fixedMessageCharacters;
  if (workingMemoryCharacters < 1) {
    failAdviser(
      "context_budget_exceeded",
      "context",
      "Required context messages exceed the serialized-character budget.",
      requestContext(request),
    );
  }

  let workingMemory;
  try {
    workingMemory = assembleWorkingMemory(drafts, {
      maximumItemCount: drafts.length,
      maximumSerializedCharacters: workingMemoryCharacters,
      maximumRetrievedMemoryItems: budget.maximumRetrievedMemories,
      maximumEvidenceReferences: budget.maximumEvidenceReferences,
    });
  } catch (error) {
    failAdviser(
      "required_context_omitted",
      "context",
      "A required working-memory item could not be assembled.",
      { ...requestContext(request), underlyingCode: safeUnderlyingCode(error) },
    );
  }
  omissions.push(...workingMemory.omissions);

  const evidenceItems = workingMemory.items.filter((item) => item.kind !== "instruction");
  const contextContent = canonicalStringify({
    authority: "evidence_not_instruction",
    items: evidenceItems,
    outputSchema: input.outputSchemaDescriptor,
    abstentionRequiredWhenUnsupported: role.supportsAbstention,
  });
  const userContent = canonicalStringify(input.userRequest);
  const evidenceReferences = Object.freeze(
    [...new Set(evidenceItems.flatMap((item) => item.evidenceReferences ?? []))]
      .sort()
      .map((evidenceId) => Object.freeze({ evidenceId })),
  );
  const messages: readonly Readonly<ModelMessage>[] = Object.freeze([
    Object.freeze({
      role: "system" as const,
      content: SIGNAL_OFFICER_SYSTEM_INSTRUCTION,
      sourceLabel: `${request.promptContractId}:${request.promptContractVersion}`,
      trust: "trusted" as const,
    }),
    Object.freeze({
      role: "developer" as const,
      content: SIGNAL_OFFICER_DEVELOPER_INSTRUCTION,
      sourceLabel: `${request.promptContractId}:${request.promptContractVersion}`,
      trust: "trusted" as const,
    }),
    Object.freeze({
      role: "context" as const,
      content: contextContent,
      sourceLabel: "kts-i4-e:bounded-evidence-context",
      evidenceReferences,
      trust: "untrusted" as const,
    }),
    Object.freeze({
      role: "user" as const,
      content: userContent,
      sourceLabel: request.adviserRequestId,
      trust: "trusted" as const,
    }),
  ]);
  const serializedCharacters = messages.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  if (
    messages.length > budget.maximumMessages ||
    serializedCharacters > budget.maximumSerializedCharacters
  ) {
    failAdviser(
      "context_budget_exceeded",
      "context",
      "Assembled adviser messages exceed the context budget.",
      requestContext(request),
    );
  }
  const includedStrategyKeys = new Set(
    workingMemory.items
      .filter((item) => item.itemId.startsWith("strategy:"))
      .map((item) => item.itemId),
  );
  const includedStrategies = strategies.filter((candidate) =>
    includedStrategyKeys.has(strategyItemId(candidate)),
  );
  const includedMemoryIds = workingMemory.items
    .filter((item) => item.kind === "retrieved_memory")
    .map((item) => item.sourceIdentity);
  const includedEvidenceIds = workingMemory.items
    .filter((item) => item.kind === "evidence_reference")
    .map((item) => item.sourceIdentity);

  return Object.freeze({
    promptContractId: request.promptContractId,
    promptContractVersion: request.promptContractVersion,
    messages,
    workingMemory,
    includedStrategies: Object.freeze(includedStrategies),
    includedMemoryIds: Object.freeze(includedMemoryIds),
    includedEvidenceIds: Object.freeze(includedEvidenceIds),
    omissions: Object.freeze(omissions.map((omission) => Object.freeze({ ...omission }))),
    serializedCharacters,
    messageCount: messages.length,
    tokenCountClaimed: false as const,
  });
}

function selectStrategies(
  candidates: readonly Readonly<StrategyCandidate>[],
  maximum: number,
): readonly Readonly<StrategyCandidate>[] {
  return candidates.slice(0, maximum);
}

function strategyItemId(candidate: Readonly<StrategyCandidate>): string {
  return `strategy:${candidate.strategy.strategyId}:${candidate.strategy.strategyVersion}`;
}

function safeUnderlyingCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "failure" in error &&
    typeof error.failure === "object" &&
    error.failure !== null &&
    "code" in error.failure &&
    typeof error.failure.code === "string"
  ) {
    return error.failure.code;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "working_memory_failed";
}
