import { describe, expect, it } from "vitest";

import {
  ENGINE_CONSTANTS,
  createInitialGameState,
  createStateDigest,
  type EngineEvent,
  type GameState,
} from "../app/features/keep-the-signal/engine";
import {
  DEFAULT_KTS_OBSERVATION_BUDGET,
  canonicalSerializeKtsObservation,
  projectKtsObservation,
} from "../app/features/keep-the-signal/intelligence-adapter";

function request(level: 0 | 1 = 0) {
  return {
    observationId: `obs-${level}`,
    requestedLevel: level,
    budget: { ...DEFAULT_KTS_OBSERVATION_BUDGET },
    source: {
      sourceLabel: "test",
      sessionId: "session-1",
      episodeId: "episode-1",
      previousObservationId: "previous-1",
    },
  } as const;
}

function stateWithEntities(): GameState {
  const state = createInitialGameState({ seed: 42 });
  state.tick = 50;
  state.player.positionX = 500_000;
  state.player.positionY = 500_000;
  state.projectiles = [
    {
      id: 1,
      positionX: 100,
      positionY: 200,
      velocityX: 0,
      velocityY: -1,
      radius: 4_000,
      remainingTicks: 10,
    },
    {
      id: 2,
      positionX: 200,
      positionY: 300,
      velocityX: 0,
      velocityY: -1,
      radius: 4_000,
      remainingTicks: 20,
    },
  ];
  state.weapon.nextProjectileId = 3;
  state.enemies = [
    {
      id: 1,
      archetype: "scout",
      positionX: 400_000,
      positionY: 500_000,
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
    {
      id: 2,
      archetype: "interceptor",
      positionX: 510_000,
      positionY: 500_000,
      velocityX: 900,
      velocityY: 1_300,
      radius: 17_000,
      integrity: 900,
      maximumIntegrity: 1_800,
      fireCooldownTicks: 0,
      fireIntervalTicks: 120,
      destructionScore: 250,
      escapeDefenceDamage: 500,
      escapeSignalDamage: 200,
    },
  ];
  state.encounter.enemiesSpawned = 2;
  state.encounter.nextEnemyId = 3;
  state.enemyProjectiles = [
    {
      id: 1,
      ownerEnemyId: 2,
      kind: "kinetic",
      positionX: 490_000,
      positionY: 500_000,
      velocityX: 0,
      velocityY: 5_000,
      radius: 5_000,
      rawDamage: 400,
      remainingTicks: 100,
    },
  ];
  state.encounter.nextEnemyProjectileId = 2;
  return state;
}

describe("KTS-I4-C observation projection", () => {
  it("returns a valid Level 0 observation", () => {
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.observation.level).toBe(0);
  });

  it("returns a valid Level 1 observation", () => {
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], request(1));
    expect(result.ok).toBe(true);
    if (result.ok && result.observation.level === 1) {
      expect(result.observation.summary).toBeDefined();
    }
  });

  it("preserves schema, adapter, engine, and ruleset identity", () => {
    const state = createInitialGameState({ seed: 42 });
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.metadata.observationSchemaId).toBe("kts.observation");
      expect(result.observation.metadata.adapterVersion).toBe("KTS-I4-C");
      expect(result.observation.metadata.engineVersion).toBe(state.engineVersion);
      expect(result.observation.metadata.rulesetVersion).toBe(state.rulesetVersion);
    }
  });

  it("preserves the accepted source-state digest", () => {
    const state = createInitialGameState({ seed: 42 });
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.metadata.sourceStateDigest).toBe(createStateDigest(state));
    }
  });

  it("preserves explicit lineage metadata", () => {
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.metadata.sourceLabel).toBe("test");
      expect(result.observation.metadata.sessionId).toBe("session-1");
      expect(result.observation.metadata.episodeId).toBe("episode-1");
      expect(result.observation.metadata.previousObservationId).toBe("previous-1");
    }
  });

  it("projects lifecycle facts", () => {
    const state = createInitialGameState({ seed: 42 });
    state.tick = 12;
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.lifecycle).toMatchObject({
        status: "running",
        terminalReason: null,
        encounterPhase: "active",
        encounterComplete: false,
        tick: 12,
      });
    }
  });

  it("projects player motion facts", () => {
    const state = createInitialGameState({ seed: 42 });
    state.player.velocityX = -10;
    state.player.velocityY = 20;
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.player.moving).toBe(true);
      expect(result.observation.player.horizontalDirection).toBe(-1);
      expect(result.observation.player.verticalDirection).toBe(1);
    }
  });

  it("projects resource ratios as basis points", () => {
    const state = createInitialGameState({ seed: 42 });
    state.defence.integrity = 5_000;
    state.signal.integrity = 2_500;
    state.interference.load = 25;
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.resources.defence.integrityBasisPoints).toBe(5_000);
      expect(result.observation.resources.signal.integrityBasisPoints).toBe(2_500);
      expect(result.observation.resources.interference.loadBasisPoints).toBe(2_500);
    }
  });

  it("projects cooldown facts", () => {
    const state = createInitialGameState({ seed: 42 });
    state.weapon.fireCooldownTicks = 2;
    state.power.shiftCooldownTicks = 3;
    state.recoveryPulse.cooldownTicks = 4;
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.cooldowns).toEqual({
        fireCooldownTicks: 2,
        powerShiftCooldownTicks: 3,
        recoveryPulseCooldownTicks: 4,
      });
    }
  });

  it("projects encounter facts without next-ID counters", () => {
    const state = createInitialGameState({ seed: 42 });
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.encounter.waveNumber).toBe(1);
      expect(result.observation.encounter).not.toHaveProperty("nextEnemyId");
      expect(result.observation.encounter).not.toHaveProperty("nextEnemyProjectileId");
    }
  });

  it("projects player projectiles in ascending ID order", () => {
    const state = stateWithEntities();
    state.projectiles.reverse();
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(false);
  });

  it("projects valid player projectiles with bounded fields", () => {
    const result = projectKtsObservation(stateWithEntities(), [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.entities.playerProjectiles.map((item) => item.id)).toEqual([1, 2]);
      expect(result.observation.entities.playerProjectiles[0]).not.toHaveProperty(
        "nextProjectileId",
      );
    }
  });

  it("projects enemies without score and escape-damage configuration", () => {
    const result = projectKtsObservation(stateWithEntities(), [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const enemy = result.observation.entities.enemies[0];
      expect(enemy).not.toHaveProperty("destructionScore");
      expect(enemy).not.toHaveProperty("escapeDefenceDamage");
      expect(enemy).not.toHaveProperty("escapeSignalDamage");
    }
  });

  it("projects enemy integrity and fire readiness", () => {
    const result = projectKtsObservation(stateWithEntities(), [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const interceptor = result.observation.entities.enemies.find((enemy) => enemy.id === 2);
      expect(interceptor?.integrityBasisPoints).toBe(5_000);
      expect(interceptor?.fireReady).toBe(true);
    }
  });

  it("projects hostile projectile tactical facts", () => {
    const result = projectKtsObservation(stateWithEntities(), [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.entities.enemyProjectiles[0]).toMatchObject({
        id: 1,
        ownerEnemyId: 2,
        kind: "kinetic",
        rawDamage: 400,
      });
    }
  });

  it("selects nearest enemies under truncation and returns ascending IDs", () => {
    const state = stateWithEntities();
    const result = projectKtsObservation(state, [], {
      ...request(0),
      budget: { ...DEFAULT_KTS_OBSERVATION_BUDGET, maximumEnemies: 1 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.entities.enemies.map((enemy) => enemy.id)).toEqual([2]);
      expect(result.observation.projection.entities.enemies.omittedCount).toBe(1);
    }
  });

  it("selects nearest hostile projectiles under truncation", () => {
    const state = stateWithEntities();
    state.enemyProjectiles.push({
      id: 2,
      ownerEnemyId: 1,
      kind: "corruption",
      positionX: 100_000,
      positionY: 100_000,
      velocityX: 0,
      velocityY: 5_000,
      radius: 5_000,
      rawDamage: 650,
      remainingTicks: 100,
    });
    state.encounter.nextEnemyProjectileId = 3;
    const result = projectKtsObservation(state, [], {
      ...request(0),
      budget: { ...DEFAULT_KTS_OBSERVATION_BUDGET, maximumEnemyProjectiles: 1 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.entities.enemyProjectiles.map((item) => item.id)).toEqual([1]);
    }
  });

  it("reports all entity truncation metadata", () => {
    const result = projectKtsObservation(stateWithEntities(), [], {
      ...request(0),
      budget: {
        ...DEFAULT_KTS_OBSERVATION_BUDGET,
        maximumPlayerProjectiles: 1,
        maximumEnemies: 1,
        maximumEnemyProjectiles: 0,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.projection.entities.playerProjectiles.omittedCount).toBe(1);
      expect(result.observation.projection.entities.enemies.omittedCount).toBe(1);
      expect(result.observation.projection.entities.enemyProjectiles.omittedCount).toBe(1);
    }
  });

  it("projects the static action vocabulary", () => {
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.actionSpace.vocabulary.movement.moveX).toEqual([-1, 0, 1]);
      expect(result.observation.actionSpace.vocabulary.powerShift).toHaveLength(6);
    }
  });

  it("projects factual action readiness", () => {
    const state = createInitialGameState({ seed: 42 });
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.actionSpace.readiness.fireReady).toBe(true);
      expect(result.observation.actionSpace.readiness.recoveryPulseReady).toBe(true);
      expect(result.observation.actionSpace.readiness.powerShiftReady).toBe(true);
    }
  });

  it("summarizes entity counts at Level 1", () => {
    const result = projectKtsObservation(stateWithEntities(), [], request(1));
    expect(result.ok).toBe(true);
    if (result.ok && result.observation.level === 1) {
      expect(result.observation.summary.enemyCountsByArchetype).toEqual({
        scout: 1,
        interceptor: 1,
        disruptor: 0,
      });
      expect(result.observation.summary.enemyProjectileCountsByKind.kinetic).toBe(1);
    }
  });

  it("summarizes nearest entities with deterministic tie-breaking", () => {
    const state = stateWithEntities();
    state.enemies[0]!.positionX = 490_000;
    state.enemies[1]!.positionX = 510_000;
    const result = projectKtsObservation(state, [], request(1));
    expect(result.ok).toBe(true);
    if (result.ok && result.observation.level === 1) {
      expect(result.observation.summary.nearestEnemy?.id).toBe(1);
    }
  });

  it("summarizes recent event counts by type", () => {
    const events: EngineEvent[] = [
      { type: "signal_recovered", tick: 0, amount: 1 },
      { type: "signal_recovered", tick: 0, amount: 2 },
      { type: "defence_recovered", tick: 0, amount: 1 },
    ];
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), events, request(1));
    expect(result.ok).toBe(true);
    if (result.ok && result.observation.level === 1) {
      expect(result.observation.summary.recentEventCountsByType).toEqual({
        signal_recovered: 2,
        defence_recovered: 1,
      });
    }
  });

  it("produces stable canonical serialization for identical input", () => {
    const state = stateWithEntities();
    const first = projectKtsObservation(state, [], request(1));
    const second = projectKtsObservation(state, [], request(1));
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(canonicalSerializeKtsObservation(first.observation)).toBe(
        canonicalSerializeKtsObservation(second.observation),
      );
    }
  });

  it("returns independent immutable observations", () => {
    const state = stateWithEntities();
    const first = projectKtsObservation(state, [], request(0));
    const second = projectKtsObservation(state, [], request(0));
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.observation).not.toBe(second.observation);
      expect(Object.isFrozen(first.observation)).toBe(true);
      expect(Object.isFrozen(first.observation.entities.enemies)).toBe(true);
    }
  });

  it("does not mutate authoritative state", () => {
    const state = stateWithEntities();
    const before = structuredClone(state);
    projectKtsObservation(state, [], request(1));
    expect(state).toEqual(before);
  });

  it("isolates the observation from later caller mutation", () => {
    const state = stateWithEntities();
    const result = projectKtsObservation(state, [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      state.player.positionX = 1;
      state.enemies[0]!.integrity = 1;
      expect(result.observation.player.positionX).toBe(500_000);
      expect(result.observation.entities.enemies[0]!.integrity).toBe(1_000);
    }
  });

  it("excludes RNG state and internal implementation fields", () => {
    const result = projectKtsObservation(stateWithEntities(), [], request(1));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialized = canonicalSerializeKtsObservation(result.observation);
      expect(serialized).not.toContain("rngState");
      expect(serialized).not.toContain("nextProjectileId");
      expect(serialized).not.toContain("nextEnemyId");
      expect(serialized).not.toContain("nextEnemyProjectileId");
      expect(serialized).not.toContain("recoveryRemainder");
      expect(serialized).not.toContain("interferenceDamageRemainder");
    }
  });

  it("returns invalid observation ID as a typed failure", () => {
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], {
      ...request(0),
      observationId: "",
    });
    expect(result).toMatchObject({ ok: false, failure: { code: "invalid_observation_id" } });
  });

  it("returns invalid observation level as a typed failure", () => {
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], {
      ...request(0),
      requestedLevel: 2 as never,
    });
    expect(result).toMatchObject({ ok: false, failure: { code: "invalid_observation_level" } });
  });

  it("returns invalid budget as a typed failure", () => {
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], {
      ...request(0),
      budget: { ...DEFAULT_KTS_OBSERVATION_BUDGET, maximumEnemies: -1 },
    });
    expect(result).toMatchObject({ ok: false, failure: { code: "invalid_budget" } });
  });

  it("returns invalid engine state as a typed failure", () => {
    const state = createInitialGameState({ seed: 42 });
    state.power.weapons = 100;
    const result = projectKtsObservation(state, [], request(0));
    expect(result).toMatchObject({ ok: false, failure: { code: "invalid_engine_state" } });
  });

  it("returns future events as a typed failure", () => {
    const state = createInitialGameState({ seed: 42 });
    const result = projectKtsObservation(
      state,
      [{ type: "signal_recovered", tick: 1, amount: 1 }],
      request(0),
    );
    expect(result).toMatchObject({ ok: false, failure: { code: "future_event" } });
  });

  it("enforces the serialized-character budget", () => {
    const result = projectKtsObservation(stateWithEntities(), [], {
      ...request(1),
      budget: { ...DEFAULT_KTS_OBSERVATION_BUDGET, maximumSerializedCharacters: 1 },
    });
    expect(result).toMatchObject({
      ok: false,
      failure: { code: "projection_budget_exceeded" },
    });
  });

  it("supports zero entity budgets without changing source state", () => {
    const state = stateWithEntities();
    const result = projectKtsObservation(state, [], {
      ...request(0),
      budget: {
        ...DEFAULT_KTS_OBSERVATION_BUDGET,
        maximumPlayerProjectiles: 0,
        maximumEnemies: 0,
        maximumEnemyProjectiles: 0,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.entities.playerProjectiles).toEqual([]);
      expect(result.observation.entities.enemies).toEqual([]);
      expect(result.observation.entities.enemyProjectiles).toEqual([]);
      expect(state.enemies).toHaveLength(2);
    }
  });

  it("records the authoritative engine capacity in action constraints", () => {
    const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], request(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.observation.actionSpace.constraints.maximumPlayerProjectiles).toBe(
        ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES,
      );
    }
  });
});
