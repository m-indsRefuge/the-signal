import { describe, expect, it } from "vitest";

import {
  DEFAULT_KTS_OBSERVATION_BUDGET,
  projectKtsObservation,
  type KtsObservationPacket,
} from "../app/features/keep-the-signal/intelligence-adapter";
import {
  ENGINE_CONSTANTS,
  createInitialGameState,
  type GameState,
} from "../app/features/keep-the-signal/engine";
import type { AdviserRequest } from "../app/features/intelligence-harness/tactical-adviser/adviser-contract";
import { createStrategyRecord } from "../app/features/intelligence-harness/tactical-adviser/strategy-contract";
import { StrategyPortfolio } from "../app/features/intelligence-harness/tactical-adviser/strategy-portfolio";
import {
  KTS_ADVISER_PROMPT_CONTRACT_ID,
  KTS_ADVISER_PROMPT_CONTRACT_VERSION,
} from "../app/features/intelligence-harness/tactical-adviser/context-contract";
import { KtsRuleBasedAdviser } from "../app/features/keep-the-signal/tactical-adviser/kts-rule-based-adviser";
import {
  KTS_BASELINE_STRATEGY_IDS,
  createKtsBaselinePortfolio,
  createKtsBaselineStrategies,
} from "../app/features/keep-the-signal/tactical-adviser/kts-strategy-portfolio";

function observation(state = createInitialGameState({ seed: 42 })): KtsObservationPacket {
  const projected = projectKtsObservation(state, [], {
    observationId: "observation:rule",
    requestedLevel: 1,
    budget: DEFAULT_KTS_OBSERVATION_BUDGET,
  });
  if (!projected.ok) throw new Error(projected.failure.message);
  return projected.observation;
}

function request(value: Readonly<KtsObservationPacket>, suffix = "one"): AdviserRequest {
  return {
    adviserRequestId: `request:${suffix}`,
    proposalId: `proposal:${suffix}`,
    invocationId: `baseline:${suffix}`,
    roleId: "signal_officer_tactical_adviser",
    roleVersion: "1",
    domainId: "keep-the-signal",
    domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
    observation: {
      observationId: value.metadata.observationId,
      observationSchemaId: value.metadata.observationSchemaId,
      observationSchemaVersion: value.metadata.observationSchemaVersion,
      observationLevel: value.level,
      sourceStateDigest: value.metadata.sourceStateDigest,
    },
    providerId: "baseline:rule",
    modelId: "baseline:rule",
    invocationBudget: {
      maximumInputTokens: 1,
      maximumOutputTokens: 1,
      maximumTotalTokens: 1,
      maximumInputCharacters: 1,
      maximumOutputCharacters: 1,
      deadlineMilliseconds: 1,
      maximumAttempts: 1,
    },
    contextBudget: {
      maximumMessages: 4,
      maximumSerializedCharacters: 100_000,
      maximumStrategies: 8,
      maximumRetrievedMemories: 0,
      maximumEvidenceReferences: 0,
      maximumObservationCharacters: 100_000,
      maximumReasonCharacters: 600,
      maximumSystemInstructionCharacters: 2_000,
      maximumDeveloperInstructionCharacters: 2_000,
    },
    strategyCandidateBudget: { maximumStrategies: 8, maximumSerializedCharacters: 100_000 },
    retrieval: {
      mode: "disabled",
      requestId: `retrieval:${suffix}`,
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

async function adviser(value: Readonly<KtsObservationPacket>) {
  const portfolio = await createKtsBaselinePortfolio({
    recordedAt: "2026-08-01T00:00:00.000Z",
    actorId: "operator:test",
    domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
  });
  return new KtsRuleBasedAdviser(portfolio);
}

function tamperObservation(
  value: Readonly<KtsObservationPacket>,
  metadata: Readonly<Record<string, unknown>>,
): KtsObservationPacket {
  const tampered = JSON.parse(JSON.stringify(value)) as KtsObservationPacket;
  Object.assign(tampered.metadata as unknown as Record<string, unknown>, metadata);
  return tampered;
}

async function extraSignalBaselineVersion(value: Readonly<KtsObservationPacket>) {
  return createStrategyRecord({
    strategyId: "preserve-signal",
    strategyVersion: "2",
    domainId: "keep-the-signal",
    domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
    family: "preservation",
    objective: "Caller-added version that must not enter the fixed adviser baseline.",
    triggerConditions: [],
    applicabilityConstraints: [],
    actionPreferences: { intent: "preserve_signal" },
    terminationConditions: [],
    expectedEffects: ["caller_added"],
    knownFailureModes: ["not_part_of_fixed_baseline"],
    evidenceReferences: [],
    counterexampleReferences: [],
    confidenceBasisPoints: 10_000,
    calibrationState: "uncalibrated",
    evaluationSummaries: [],
    parentStrategies: [],
    portfolioPriority: 10_000,
    classification: "deterministic_baseline",
    recordedAt: "2026-08-01T00:00:00.000Z",
    actorId: "operator:test",
  });
}

function stateWithEnemy(): GameState {
  const state = createInitialGameState({ seed: 42 });
  state.enemies = [
    {
      id: 7,
      archetype: "scout",
      positionX: state.player.positionX,
      positionY: state.player.positionY - 100_000,
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
  return state;
}

function stateWithProjectile(): GameState {
  const state = stateWithEnemy();
  state.enemyProjectiles = [
    {
      id: 9,
      ownerEnemyId: 7,
      kind: "kinetic",
      positionX: state.player.positionX + 1,
      positionY: state.player.positionY + 1,
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

describe("KTS-I4-E deterministic rule-based adviser", () => {
  it("rejects a portfolio that is not the exact fixed KTS baseline", () => {
    const portfolio = new StrategyPortfolio({
      maximumStrategyCount: 8,
      maximumSerializedCharacters: 100_000,
    });
    expect(() => new KtsRuleBasedAdviser(portfolio)).toThrow("exact fixed KTS baseline");
  });

  it.each(KTS_BASELINE_STRATEGY_IDS)(
    "creates the %s deterministic baseline",
    async (strategyId) => {
      const records = await createKtsBaselineStrategies({
        recordedAt: "2026-08-01T00:00:00.000Z",
        actorId: "operator:test",
        domainVersion: "engine-1:rules-1",
      });
      expect(records.find((record) => record.strategyId === strategyId)?.classification).toBe(
        "deterministic_baseline",
      );
    },
  );

  it("returns equivalent proposals for equivalent observations", async () => {
    const value = observation();
    const baseline = await adviser(value);
    const first = baseline.advise({ request: request(value), observation: value });
    const second = baseline.advise({ request: request(value), observation: value });
    expect(first.proposal).toEqual(second.proposal);
  });

  it("isolates the fixed baseline from later caller registration", async () => {
    const state = createInitialGameState({ seed: 42 });
    state.signal.integrity = 1;
    const value = observation(state);
    const portfolio = await createKtsBaselinePortfolio(
      {
        recordedAt: "2026-08-01T00:00:00.000Z",
        actorId: "operator:test",
        domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
      },
      { maximumStrategyCount: 10, maximumSerializedCharacters: 200_000 },
    );
    const baseline = new KtsRuleBasedAdviser(portfolio);
    const before = baseline.advise({ request: request(value), observation: value });
    await portfolio.registerStrategy(await extraSignalBaselineVersion(value));
    const after = baseline.advise({ request: request(value), observation: value });
    expect(after.strategySelection.candidates).toHaveLength(
      before.strategySelection.candidates.length,
    );
    expect(
      after.strategySelection.candidates.some(({ strategy }) => strategy.strategyVersion === "2"),
    ).toBe(false);
    expect(after.proposal).toEqual(before.proposal);
  });

  it("continues deterministically after the caller portfolio is disposed", async () => {
    const value = observation();
    const portfolio = await createKtsBaselinePortfolio(
      {
        recordedAt: "2026-08-01T00:00:00.000Z",
        actorId: "operator:test",
        domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
      },
      { maximumStrategyCount: 10, maximumSerializedCharacters: 200_000 },
    );
    const baseline = new KtsRuleBasedAdviser(portfolio);
    const before = baseline.advise({ request: request(value), observation: value });
    portfolio.dispose();
    const after = baseline.advise({ request: request(value), observation: value });
    expect(after.proposal).toEqual(before.proposal);
    expect(after.strategySelection.candidates).toEqual(before.strategySelection.candidates);
  });

  it("prioritizes Signal preservation when Signal integrity is low", async () => {
    const state = createInitialGameState({ seed: 42 });
    state.signal.integrity = 1;
    const value = observation(state);
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.proposal.intent).toBe("preserve_signal");
    expect(result.proposal.selectedStrategy?.strategyId).toBe("preserve-signal");
  });

  it("prioritizes Defence preservation when Defence integrity is low", async () => {
    const state = createInitialGameState({ seed: 42 });
    state.defence.integrity = 1;
    const value = observation(state);
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.proposal.intent).toBe("preserve_defence");
  });

  it("prioritizes a visible projectile threat", async () => {
    const value = observation(stateWithProjectile());
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.proposal.intent).toBe("reduce_threat");
    expect(result.proposal.target).toMatchObject({ kind: "enemy_projectile", entityId: 9 });
  });

  it("recommends recovery when recovery is ready and resources are moderately damaged", async () => {
    const state = createInitialGameState({ seed: 42 });
    state.signal.integrity = Math.floor(ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY * 0.7);
    const value = observation(state);
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.proposal.intent).toBe("recover");
    expect(result.proposal.recoveryRecommendation).toBe("activate_now");
  });

  it("recommends a readiness-consistent power rebalance", async () => {
    const state = createInitialGameState({ seed: 42 });
    state.power.weapons += ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT;
    state.power.defence -= ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT;
    const value = observation(state);
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.proposal.intent).toBe("rebalance_power");
    expect(result.proposal.powerTransferRecommendation).not.toBe("none");
  });

  it("engages the nearest visible enemy when no stronger threat applies", async () => {
    const value = observation(stateWithEnemy());
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.proposal.intent).toBe("engage_target");
    expect(result.proposal.target).toMatchObject({ kind: "enemy", entityId: 7 });
  });

  it("advances the wave when no visible hostile entity is present", async () => {
    const value = observation();
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.proposal.intent).toBe("advance_wave");
  });

  it("does not advance when hostile entities were truncated", async () => {
    const projected = projectKtsObservation(stateWithEnemy(), [], {
      observationId: "observation:rule",
      requestedLevel: 1,
      budget: { ...DEFAULT_KTS_OBSERVATION_BUDGET, maximumEnemies: 0 },
    });
    if (!projected.ok) throw new Error(projected.failure.message);
    const value = projected.observation;
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.proposal.intent).not.toBe("advance_wave");
    expect(result.proposal.selectedStrategy?.strategyId).not.toBe("advance-wave");
  });

  it("rejects a packet with a tampered observation schema ID", async () => {
    const accepted = observation();
    const value = tamperObservation(accepted, { observationSchemaId: "kts.other-observation" });
    const baseline = await adviser(accepted);
    expect(() => baseline.advise({ request: request(accepted), observation: value })).toThrow(
      "accepted KTS observation",
    );
  });

  it("rejects a packet with a tampered observation schema version", async () => {
    const accepted = observation();
    const value = tamperObservation(accepted, { observationSchemaVersion: 2 });
    const baseline = await adviser(accepted);
    expect(() => baseline.advise({ request: request(accepted), observation: value })).toThrow(
      "accepted KTS observation",
    );
  });

  it("rejects a packet whose requested level differs from its level", async () => {
    const accepted = observation();
    const value = tamperObservation(accepted, { requestedLevel: 0 });
    const baseline = await adviser(accepted);
    expect(() => baseline.advise({ request: request(accepted), observation: value })).toThrow(
      "accepted KTS observation",
    );
  });

  it("rejects request-to-packet observation lineage tampering", async () => {
    const value = observation();
    const adviserRequest = request(value);
    const baseline = await adviser(value);
    expect(() =>
      baseline.advise({
        request: {
          ...adviserRequest,
          observation: { ...adviserRequest.observation, observationId: "observation:other" },
        },
        observation: value,
      }),
    ).toThrow("accepted KTS observation");
  });

  it("rejects a packet with a tampered adapter ID", async () => {
    const accepted = observation();
    const value = tamperObservation(accepted, { adapterId: "kts.other-adapter" });
    const baseline = await adviser(accepted);
    expect(() => baseline.advise({ request: request(accepted), observation: value })).toThrow(
      "accepted KTS observation",
    );
  });

  it("rejects a packet with a tampered adapter version", async () => {
    const accepted = observation();
    const value = tamperObservation(accepted, { adapterVersion: "unsupported" });
    const baseline = await adviser(accepted);
    expect(() => baseline.advise({ request: request(accepted), observation: value })).toThrow(
      "accepted KTS observation",
    );
  });

  it("uses uncertainty-safe abstention outside active gameplay", async () => {
    const active = observation();
    const value = JSON.parse(JSON.stringify(active)) as KtsObservationPacket;
    (value.lifecycle as { status: string }).status = "won";
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.classification).toBe("abstention");
    expect(result.proposal.abstention.abstained).toBe(true);
  });

  it("passes every baseline proposal through the deterministic validator", async () => {
    const value = observation();
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.validation.classification).toBe("advisory_valid");
  });

  it("identifies itself as a rule-based baseline", async () => {
    const value = observation();
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.envelope.proposerKind).toBe("rule_based_baseline");
  });

  it("records that no model was used", async () => {
    const value = observation();
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.envelope.provenance.modelUsed).toBe(false);
  });

  it("records that no memory repository was used", async () => {
    const value = observation();
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.envelope.provenance.memoryUsed).toBe(false);
  });

  it("records that no gameplay action was executed", async () => {
    const value = observation();
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(result.envelope.provenance.actionExecuted).toBe(false);
  });

  it("returns immutable proposal, envelope, and validation records", async () => {
    const value = observation();
    const result = (await adviser(value)).advise({ request: request(value), observation: value });
    expect(Object.isFrozen(result.proposal)).toBe(true);
    expect(Object.isFrozen(result.envelope)).toBe(true);
    expect(Object.isFrozen(result.validation)).toBe(true);
  });

  it("does not mutate the accepted observation", async () => {
    const value = observation();
    const before = JSON.stringify(value);
    (await adviser(value)).advise({ request: request(value), observation: value });
    expect(JSON.stringify(value)).toBe(before);
  });

  it("rejects work after adviser disposal", async () => {
    const value = observation();
    const baseline = await adviser(value);
    baseline.dispose();
    expect(() => baseline.advise({ request: request(value), observation: value })).toThrow(
      "disposed",
    );
  });
});
