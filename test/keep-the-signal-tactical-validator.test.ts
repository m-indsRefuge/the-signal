import { describe, expect, it } from "vitest";

import { createInitialGameState, type GameState } from "../app/features/keep-the-signal/engine";
import {
  DEFAULT_KTS_OBSERVATION_BUDGET,
  projectKtsObservation,
  type KtsObservationPacket,
} from "../app/features/keep-the-signal/intelligence-adapter";
import {
  SIGNAL_OFFICER_ADVISER_ROLE,
  type AdviserRequest,
} from "../app/features/intelligence-harness/tactical-adviser/adviser-contract";
import {
  KTS_ADVISER_PROMPT_CONTRACT_ID,
  KTS_ADVISER_PROMPT_CONTRACT_VERSION,
} from "../app/features/intelligence-harness/tactical-adviser/context-contract";
import { createStrategyRecord } from "../app/features/intelligence-harness/tactical-adviser/strategy-contract";
import type { StrategyCandidate } from "../app/features/intelligence-harness/tactical-adviser/strategy-portfolio";
import {
  KTS_POWER_TRANSFER_RECOMMENDATIONS,
  type KtsTacticalProposal,
} from "../app/features/keep-the-signal/tactical-adviser/kts-proposal-contract";
import { validateKtsTacticalProposal } from "../app/features/keep-the-signal/tactical-adviser/kts-proposal-validator";

function project(
  state = createInitialGameState({ seed: 42 }),
  maximumEnemies = DEFAULT_KTS_OBSERVATION_BUDGET.maximumEnemies,
): KtsObservationPacket {
  const result = projectKtsObservation(state, [], {
    observationId: "observation:validator",
    requestedLevel: 1,
    budget: { ...DEFAULT_KTS_OBSERVATION_BUDGET, maximumEnemies },
  });
  if (!result.ok) throw new Error(result.failure.message);
  return result.observation;
}

function stateWithEntities(): GameState {
  const state = createInitialGameState({ seed: 42 });
  state.player.positionX = 500_000;
  state.player.positionY = 500_000;
  state.enemies = [
    {
      id: 7,
      archetype: "scout",
      positionX: 450_000,
      positionY: 450_000,
      velocityX: 0,
      velocityY: 1_800,
      radius: 14_000,
      integrity: 1_000,
      maximumIntegrity: 1_000,
      fireCooldownTicks: 0,
      fireIntervalTicks: 0,
      destructionScore: 100,
      escapeDefenceDamage: 300,
      escapeSignalDamage: 0,
    },
  ];
  state.encounter.enemiesSpawned = 1;
  state.encounter.nextEnemyId = 8;
  state.enemyProjectiles = [
    {
      id: 9,
      ownerEnemyId: 7,
      kind: "kinetic",
      positionX: 490_000,
      positionY: 490_000,
      velocityX: 0,
      velocityY: 5_000,
      radius: 5_000,
      rawDamage: 400,
      remainingTicks: 100,
    },
  ];
  state.encounter.nextEnemyProjectileId = 10;
  return state;
}

function request(observation: Readonly<KtsObservationPacket>): AdviserRequest {
  return {
    adviserRequestId: "request:validator",
    proposalId: "proposal:validator",
    invocationId: "invocation:validator",
    roleId: SIGNAL_OFFICER_ADVISER_ROLE.roleId,
    roleVersion: SIGNAL_OFFICER_ADVISER_ROLE.roleVersion,
    domainId: "keep-the-signal",
    domainVersion: `${observation.metadata.engineVersion}:${observation.metadata.rulesetVersion}`,
    observation: {
      observationId: observation.metadata.observationId,
      observationSchemaId: observation.metadata.observationSchemaId,
      observationSchemaVersion: observation.metadata.observationSchemaVersion,
      observationLevel: observation.level,
      sourceStateDigest: observation.metadata.sourceStateDigest,
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
      maximumObservationCharacters: 100_000,
      maximumReasonCharacters: 600,
      maximumSystemInstructionCharacters: 2_000,
      maximumDeveloperInstructionCharacters: 2_000,
    },
    strategyCandidateBudget: { maximumStrategies: 5, maximumSerializedCharacters: 50_000 },
    retrieval: {
      mode: "disabled",
      requestId: "retrieval:validator",
      allowedDomains: ["keep-the-signal"],
      allowedClassifications: ["internal"],
      acceptedRetentionClasses: ["standard"],
      budget: { resultLimit: 0, maximumSerializedCharacters: 0, relationTraversalLimit: 0 },
    },
    promptContractId: KTS_ADVISER_PROMPT_CONTRACT_ID,
    promptContractVersion: KTS_ADVISER_PROMPT_CONTRACT_VERSION,
    proposalSchemaId: "kts.tactical-proposal",
    proposalSchemaVersion: "1",
    recordedAt: "2026-08-01T00:00:00.000Z",
    exposeRawFailureOutput: false,
  };
}

async function candidate(applicable = true): Promise<StrategyCandidate> {
  const strategy = await createStrategyRecord({
    strategyId: "strategy:validator",
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
    confidenceBasisPoints: 5_000,
    calibrationState: "uncalibrated",
    evaluationSummaries: [],
    parentStrategies: [],
    portfolioPriority: 1,
    classification: "deterministic_baseline",
    recordedAt: "2026-08-01T00:00:00.000Z",
    actorId: "operator:test",
  });
  return {
    strategy,
    applicability: {
      strategyId: strategy.strategyId,
      strategyVersion: strategy.strategyVersion,
      applicable,
      applicabilityBasisPoints: applicable ? 5_000 : 0,
      satisfiedConstraints: [],
      unsatisfiedConstraints: [],
      uncertaintyFlags: [],
      supportingObservationReferences: [],
      supportingEvidenceReferences: [],
      evaluatorId: "evaluator",
      evaluatorVersion: "1",
    },
  };
}

function proposal(
  observation: Readonly<KtsObservationPacket>,
  overrides: Partial<KtsTacticalProposal> = {},
): KtsTacticalProposal {
  return {
    proposalId: "proposal:validator",
    proposalSchemaId: "kts.tactical-proposal",
    proposalSchemaVersion: "1",
    adviserRequestId: "request:validator",
    observationId: observation.metadata.observationId,
    sourceStateDigest: observation.metadata.sourceStateDigest,
    intent: "hold",
    movement: { moveX: 0, moveY: 0, priority: "low" },
    fireRecommendation: "hold_fire",
    powerTransferRecommendation: "none",
    recoveryRecommendation: "hold",
    target: { kind: "none", priority: "low" },
    selectedStrategy: { strategyId: "strategy:validator", strategyVersion: "1" },
    confidenceBasisPoints: 5_000,
    uncertainty: "medium",
    abstention: { abstained: false },
    reason: "The bounded observation supports a conservative hold.",
    supportingFacts: [
      { kind: "observation_field", path: "lifecycle.status", value: observation.lifecycle.status },
      { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
    ],
    evidenceReferences: [],
    contradictionReferences: [],
    warnings: ["advisory_only"],
    ...overrides,
  };
}

async function validate(
  observation: Readonly<KtsObservationPacket>,
  proposalValue: unknown,
  overrides: {
    candidates?: readonly StrategyCandidate[];
    allowedEvidenceIds?: readonly string[];
    allowedMemoryIds?: readonly string[];
    allowedContradictionIds?: readonly string[];
    maximumReasonCharacters?: number;
    schemaOnly?: boolean;
  } = {},
) {
  return validateKtsTacticalProposal({
    proposal: proposalValue,
    request: request(observation),
    observation,
    strategyCandidates: overrides.candidates ?? [await candidate()],
    allowedEvidenceIds: overrides.allowedEvidenceIds ?? [],
    allowedMemoryIds: overrides.allowedMemoryIds ?? [],
    allowedContradictionIds: overrides.allowedContradictionIds ?? [],
    maximumReasonCharacters: overrides.maximumReasonCharacters ?? 600,
    schemaOnly: overrides.schemaOnly,
  });
}

describe("KTS-I4-E deterministic proposal validator", () => {
  it("returns schema_valid for strict schema-only validation", async () => {
    const observation = project();
    expect(
      (await validate(observation, proposal(observation), { schemaOnly: true })).classification,
    ).toBe("schema_valid");
  });

  it("returns advisory_valid for a grounded readiness-neutral proposal", async () => {
    const observation = project();
    expect((await validate(observation, proposal(observation))).classification).toBe(
      "advisory_valid",
    );
  });

  it.each([
    ["proposalId", "proposal:other"],
    ["adviserRequestId", "request:other"],
    ["observationId", "observation:other"],
    ["sourceStateDigest", "digest-other"],
  ] as const)("rejects mismatched %s lineage", async (field, value) => {
    const observation = project();
    const result = await validate(observation, proposal(observation, { [field]: value }));
    expect(result.issues.some(({ code }) => code === "invalid_proposal_identity")).toBe(true);
  });

  it("rejects a reason above the configured boundary", async () => {
    const observation = project();
    const result = await validate(observation, proposal(observation, { reason: "long reason" }), {
      maximumReasonCharacters: 4,
    });
    expect(result.classification).toBe("advisory_rejected");
  });

  it("accepts a present enemy target", async () => {
    const observation = project(stateWithEntities());
    const result = await validate(
      observation,
      proposal(observation, {
        intent: "engage_target",
        target: { kind: "enemy", entityId: 7, priority: "high" },
        supportingFacts: [
          { kind: "entity", entityKind: "enemy", entityId: 7 },
          { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
        ],
      }),
    );
    expect(result.classification).toBe("advisory_valid");
  });

  it("rejects an absent enemy target", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, { target: { kind: "enemy", entityId: 7, priority: "high" } }),
    );
    expect(result.issues.some(({ code }) => code === "invalid_target_reference")).toBe(true);
  });

  it("rejects an entity omitted by deterministic truncation", async () => {
    const observation = project(stateWithEntities(), 0);
    expect(observation.projection.entities.enemies.truncated).toBe(true);
    const result = await validate(
      observation,
      proposal(observation, { target: { kind: "enemy", entityId: 7, priority: "high" } }),
    );
    expect(result.issues.some(({ code }) => code === "invalid_target_reference")).toBe(true);
  });

  it("accepts a present projectile target", async () => {
    const observation = project(stateWithEntities());
    const result = await validate(
      observation,
      proposal(observation, {
        target: { kind: "enemy_projectile", entityId: 9, priority: "high" },
        supportingFacts: [
          { kind: "entity", entityKind: "enemy_projectile", entityId: 9 },
          { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
        ],
      }),
    );
    expect(result.classification).toBe("advisory_valid");
  });

  it("accepts fire_now only when fire readiness is true", async () => {
    const observation = project();
    expect(observation.actionSpace.readiness.fireReady).toBe(true);
    const result = await validate(
      observation,
      proposal(observation, {
        fireRecommendation: "fire_now",
        supportingFacts: [
          { kind: "action_readiness", path: "actionSpace.readiness.fireReady", ready: true },
          { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
        ],
      }),
    );
    expect(result.classification).toBe("advisory_valid");
  });

  it("rejects fire_now when fire readiness is false", async () => {
    const state = createInitialGameState({ seed: 42 });
    state.weapon.fireCooldownTicks = 1;
    const observation = project(state);
    const result = await validate(
      observation,
      proposal(observation, { fireRecommendation: "fire_now" }),
    );
    expect(result.issues.some(({ code }) => code === "unready_recommendation")).toBe(true);
  });

  it("accepts activate_now only when recovery readiness is true", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, {
        recoveryRecommendation: "activate_now",
        supportingFacts: [
          {
            kind: "action_readiness",
            path: "actionSpace.readiness.recoveryPulseReady",
            ready: true,
          },
          { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
        ],
      }),
    );
    expect(result.classification).toBe("advisory_valid");
  });

  it("rejects activate_now when recovery readiness is false", async () => {
    const state = createInitialGameState({ seed: 42 });
    state.recoveryPulse.cooldownTicks = 1;
    const observation = project(state);
    const result = await validate(
      observation,
      proposal(observation, { recoveryRecommendation: "activate_now" }),
    );
    expect(result.issues.some(({ code }) => code === "unready_recommendation")).toBe(true);
  });

  it.each(KTS_POWER_TRANSFER_RECOMMENDATIONS.filter((value) => value !== "none"))(
    "validates readiness for %s",
    async (powerTransferRecommendation) => {
      const observation = project();
      const result = await validate(
        observation,
        proposal(observation, {
          powerTransferRecommendation,
          supportingFacts: [
            { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
          ],
        }),
      );
      const [from, , to] = powerTransferRecommendation.split("_");
      const ready = observation.actionSpace.readiness.powerShiftOptions.some(
        (option) => option.from === from && option.to === to && option.ready,
      );
      expect(result.classification === "advisory_valid").toBe(ready);
    },
  );

  it("rejects an unknown selected strategy", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, { selectedStrategy: { strategyId: "unknown", strategyVersion: "1" } }),
    );
    expect(result.issues.some(({ code }) => code === "unsupported_strategy_reference")).toBe(true);
  });

  it("rejects a selected strategy marked not applicable", async () => {
    const observation = project();
    const result = await validate(observation, proposal(observation), {
      candidates: [await candidate(false)],
    });
    expect(result.issues.some(({ code }) => code === "strategy_not_applicable")).toBe(true);
  });

  it("rejects an unsupported evidence reference", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, { evidenceReferences: ["evidence:unknown"] }),
    );
    expect(result.issues.some(({ code }) => code === "unsupported_evidence_reference")).toBe(true);
  });

  it("accepts an explicitly retrieved evidence reference", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, {
        evidenceReferences: ["evidence:known"],
        supportingFacts: [
          { kind: "evidence", evidenceId: "evidence:known" },
          { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
        ],
      }),
      { allowedEvidenceIds: ["evidence:known"] },
    );
    expect(result.classification).toBe("advisory_valid");
  });

  it("rejects an unsupported contradiction reference", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, { contradictionReferences: ["evidence:contradiction"] }),
    );
    expect(result.issues.some(({ code }) => code === "unsupported_evidence_reference")).toBe(true);
  });

  it("accepts an explicitly retrieved contradiction", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, {
        contradictionReferences: ["evidence:contradiction"],
        supportingFacts: [
          { kind: "contradiction", evidenceId: "evidence:contradiction" },
          { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
        ],
      }),
      { allowedContradictionIds: ["evidence:contradiction"] },
    );
    expect(result.classification).toBe("advisory_valid");
  });

  it("accepts an explicitly retrieved memory supporting fact", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, {
        supportingFacts: [
          { kind: "memory", memoryId: "memory:known" },
          { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
        ],
      }),
      { allowedMemoryIds: ["memory:known"] },
    );
    expect(result.classification).toBe("advisory_valid");
  });

  it("rejects a supporting observation value that does not match", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, {
        supportingFacts: [
          { kind: "observation_field", path: "lifecycle.status", value: "lost" },
          { kind: "strategy", strategyId: "strategy:validator", strategyVersion: "1" },
        ],
      }),
    );
    expect(result.issues.some(({ code }) => code === "proposal_not_grounded")).toBe(true);
  });

  it("rejects high confidence paired with high uncertainty", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, { confidenceBasisPoints: 9_000, uncertainty: "high" }),
    );
    expect(result.issues.some(({ code }) => code === "proposal_not_grounded")).toBe(true);
  });

  it("returns first-class abstention", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, {
        intent: "hold",
        selectedStrategy: null,
        abstention: { abstained: true, code: "insufficient_evidence" },
        confidenceBasisPoints: 0,
        uncertainty: "unknown",
      }),
    );
    expect(result.classification).toBe("abstained");
  });

  it("rejects action-like content inside an abstention", async () => {
    const observation = project();
    const result = await validate(
      observation,
      proposal(observation, {
        intent: "hold",
        selectedStrategy: null,
        abstention: { abstained: true, code: "model_uncertain" },
        fireRecommendation: "fire_now",
      }),
    );
    expect(result.classification).toBe("advisory_rejected");
  });

  it("never returns a final-engine-legality classification", async () => {
    const observation = project();
    const result = await validate(observation, proposal(observation));
    expect(["schema_valid", "advisory_valid", "advisory_rejected", "abstained"]).toContain(
      result.classification,
    );
  });

  it("does not mutate the proposal or observation", async () => {
    const observation = project();
    const value = proposal(observation);
    const beforeProposal = JSON.stringify(value);
    const beforeObservation = JSON.stringify(observation);
    await validate(observation, value);
    expect(JSON.stringify(value)).toBe(beforeProposal);
    expect(JSON.stringify(observation)).toBe(beforeObservation);
  });
});
