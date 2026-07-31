import { describe, expect, it } from "vitest";

import {
  ENGINE_CONSTANTS,
  EncounterInvariantError,
  canSpawnEncounterEnemy,
  createEnemySpawn,
  createEnemyState,
  createInitialEncounterState,
  createInitialGameState,
  decrementEncounterSpawnCooldown,
  getWaveEnemyCount,
  getWaveSpawnInterval,
  nextInt,
  selectEnemyArchetypeFromRoll,
  selectEnemySpawnX,
  spawnEncounterEnemy,
  validateEncounterState,
  type EnemyProjectileState,
  type EnemyState,
  type EncounterWaveNumber,
} from "../app/features/keep-the-signal/engine";

describe("Keep the Signal encounter state foundation", () => {
  it("defines the accepted five-wave encounter constants", () => {
    expect(ENGINE_CONSTANTS.ENCOUNTER_WAVE_COUNT).toBe(5);
    expect(ENGINE_CONSTANTS.ENCOUNTER_TOTAL_ENEMIES).toBe(60);
    expect(ENGINE_CONSTANTS.WAVE_ENEMY_COUNTS).toEqual([8, 10, 12, 14, 16]);
    expect(ENGINE_CONSTANTS.WAVE_SPAWN_INTERVAL_TICKS).toEqual([82, 74, 66, 58, 50]);
    expect(ENGINE_CONSTANTS.WAVE_INTERMISSION_TICKS).toBe(180);
  });

  it("creates the accepted initial encounter state", () => {
    expect(createInitialEncounterState()).toEqual({
      phase: "active",
      waveNumber: 1,
      phaseTicks: 0,
      spawnCooldownTicks: 0,
      enemiesScheduled: 8,
      enemiesSpawned: 0,
      enemiesDefeated: 0,
      enemiesEscaped: 0,
      totalEnemiesDefeated: 0,
      totalEnemiesEscaped: 0,
      nextEnemyId: 1,
      nextEnemyProjectileId: 1,
    });
  });

  it("extends the initial game state with independent encounter arrays", () => {
    const first = createInitialGameState({ seed: 1 });
    const second = createInitialGameState({ seed: 1 });

    expect(first.engineVersion).toBe("kts-i2.0.0");
    expect(first.encounter).toEqual(createInitialEncounterState());
    expect(first.enemies).toEqual([]);
    expect(first.enemyProjectiles).toEqual([]);

    expect(first.encounter).not.toBe(second.encounter);
    expect(first.enemies).not.toBe(second.enemies);
    expect(first.enemyProjectiles).not.toBe(second.enemyProjectiles);
  });

  it.each([
    [1, 8, 82],
    [2, 10, 74],
    [3, 12, 66],
    [4, 14, 58],
    [5, 16, 50],
  ] as const)("returns the accepted Wave %i count and interval", (waveNumber, count, interval) => {
    expect(getWaveEnemyCount(waveNumber)).toBe(count);
    expect(getWaveSpawnInterval(waveNumber)).toBe(interval);
  });

  it("validates the initial encounter state", () => {
    expect(validateEncounterState(createInitialEncounterState(), [], [])).toEqual({ valid: true });
  });

  it("rejects an incorrect scheduled enemy count", () => {
    const encounter = createInitialEncounterState();

    encounter.enemiesScheduled = 9;

    expect(() => validateEncounterState(encounter, [], [])).toThrow(EncounterInvariantError);

    expect(() => validateEncounterState(encounter, [], [])).toThrow(
      "Wave 1 must schedule 8 enemies.",
    );
  });

  it("rejects encounter counters inconsistent with active enemies", () => {
    const encounter = createInitialEncounterState();

    encounter.enemiesSpawned = 1;
    encounter.nextEnemyId = 2;

    expect(() => validateEncounterState(encounter, [], [])).toThrow(
      "Active enemy count is inconsistent with encounter counters.",
    );
  });

  it("allows the first enemy to spawn immediately", () => {
    const encounter = createInitialEncounterState();

    expect(canSpawnEncounterEnemy(encounter)).toBe(true);
  });

  it("creates a deterministic encounter spawn", () => {
    const encounter = createInitialEncounterState();

    const result = spawnEncounterEnemy(encounter, 1_987_041_211);

    expect(result.enemy.id).toBe(1);
    expect(result.enemy.archetype).toBe("scout");
    expect(result.enemy.positionY).toBe(40_000);

    expect(result.encounter).toEqual({
      ...encounter,
      spawnCooldownTicks: 82,
      enemiesSpawned: 1,
      nextEnemyId: 2,
    });

    expect(encounter).toEqual(createInitialEncounterState());
  });

  it("consumes exactly two RNG transitions for every spawn", () => {
    const seed = 1_987_041_211;

    const firstTransition = nextInt(seed, 100);
    const secondTransition = nextInt(
      firstTransition.nextState,
      ENGINE_CONSTANTS.ENEMY_SPAWN_X_ROLL_MAX_EXCLUSIVE,
    );

    const result = createEnemySpawn({
      waveNumber: 5,
      enemyId: 1,
      rngState: seed,
    });

    expect(result.archetypeRoll).toBe(firstTransition.value);
    expect(result.spawnXRoll).toBe(secondTransition.value);
    expect(result.nextRngState).toBe(secondTransition.nextState);
  });

  it("maps Wave 1 entirely to Scouts", () => {
    expect(selectEnemyArchetypeFromRoll(1, 0)).toBe("scout");
    expect(selectEnemyArchetypeFromRoll(1, 99)).toBe("scout");
  });

  it("uses the accepted Wave 2 archetype boundaries", () => {
    expect(selectEnemyArchetypeFromRoll(2, 74)).toBe("scout");
    expect(selectEnemyArchetypeFromRoll(2, 75)).toBe("interceptor");
    expect(selectEnemyArchetypeFromRoll(2, 99)).toBe("interceptor");
  });

  it("uses the accepted Wave 3 archetype boundaries", () => {
    expect(selectEnemyArchetypeFromRoll(3, 54)).toBe("scout");
    expect(selectEnemyArchetypeFromRoll(3, 55)).toBe("interceptor");
    expect(selectEnemyArchetypeFromRoll(3, 84)).toBe("interceptor");
    expect(selectEnemyArchetypeFromRoll(3, 85)).toBe("disruptor");
  });

  it("uses the accepted Wave 4 archetype boundaries", () => {
    expect(selectEnemyArchetypeFromRoll(4, 39)).toBe("scout");
    expect(selectEnemyArchetypeFromRoll(4, 40)).toBe("interceptor");
    expect(selectEnemyArchetypeFromRoll(4, 74)).toBe("interceptor");
    expect(selectEnemyArchetypeFromRoll(4, 75)).toBe("disruptor");
  });

  it("uses the accepted Wave 5 archetype boundaries", () => {
    expect(selectEnemyArchetypeFromRoll(5, 29)).toBe("scout");
    expect(selectEnemyArchetypeFromRoll(5, 30)).toBe("interceptor");
    expect(selectEnemyArchetypeFromRoll(5, 64)).toBe("interceptor");
    expect(selectEnemyArchetypeFromRoll(5, 65)).toBe("disruptor");
  });

  it("keeps every seeded spawn X inside the accepted margins", () => {
    let rngState = 1;

    for (let index = 0; index < 500; index += 1) {
      const result = selectEnemySpawnX(rngState);

      expect(result.positionX).toBeGreaterThanOrEqual(40_000);
      expect(result.positionX).toBeLessThanOrEqual(960_000);

      rngState = result.nextRngState;
    }
  });

  it("gives odd Interceptors rightward velocity", () => {
    const enemy = createEnemyState(1, "interceptor", 500_000);

    expect(enemy.velocityX).toBe(900);
    expect(enemy.velocityY).toBe(1_300);
    expect(enemy.fireCooldownTicks).toBe(120);
  });

  it("gives even Interceptors leftward velocity", () => {
    const enemy = createEnemyState(2, "interceptor", 500_000);

    expect(enemy.velocityX).toBe(-900);
    expect(enemy.velocityY).toBe(1_300);
    expect(enemy.fireCooldownTicks).toBe(120);
  });

  it("creates a non-firing Scout with the accepted attributes", () => {
    expect(createEnemyState(1, "scout", 500_000)).toEqual({
      id: 1,
      archetype: "scout",
      positionX: 500_000,
      positionY: 40_000,
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
    });
  });

  it("creates a Disruptor with the accepted firing interval", () => {
    const enemy = createEnemyState(1, "disruptor", 500_000);

    expect(enemy.integrity).toBe(2_600);
    expect(enemy.radius).toBe(20_000);
    expect(enemy.fireCooldownTicks).toBe(180);
    expect(enemy.fireIntervalTicks).toBe(180);
    expect(enemy.destructionScore).toBe(400);
  });

  it("decrements encounter spawn cooldown without mutation", () => {
    const encounter = createInitialEncounterState();

    encounter.spawnCooldownTicks = 2;

    const result = decrementEncounterSpawnCooldown(encounter);

    expect(result.spawnCooldownTicks).toBe(1);
    expect(encounter.spawnCooldownTicks).toBe(2);
  });

  it("clamps encounter spawn cooldown at zero", () => {
    const encounter = createInitialEncounterState();

    expect(decrementEncounterSpawnCooldown(encounter).spawnCooldownTicks).toBe(0);
  });

  it("rejects spawning while the cooldown is active", () => {
    const encounter = createInitialEncounterState();

    encounter.spawnCooldownTicks = 1;

    expect(() => spawnEncounterEnemy(encounter, 1)).toThrow(
      "The encounter is not currently eligible to spawn an enemy.",
    );
  });

  it("rejects spawning after the wave schedule is exhausted", () => {
    const encounter = createInitialEncounterState();

    encounter.enemiesSpawned = encounter.enemiesScheduled;

    expect(canSpawnEncounterEnemy(encounter)).toBe(false);

    expect(() => spawnEncounterEnemy(encounter, 1)).toThrow(
      "The encounter is not currently eligible to spawn an enemy.",
    );
  });

  it("produces monotonically increasing enemy IDs", () => {
    let encounter = createInitialEncounterState();
    let rngState = 42;

    const first = spawnEncounterEnemy(encounter, rngState);

    encounter = {
      ...first.encounter,
      spawnCooldownTicks: 0,
    };
    rngState = first.nextRngState;

    const second = spawnEncounterEnemy(encounter, rngState);

    expect(first.enemy.id).toBe(1);
    expect(second.enemy.id).toBe(2);
    expect(second.encounter.nextEnemyId).toBe(3);
  });

  it("rejects duplicate or unordered active enemy IDs", () => {
    const encounter = createInitialEncounterState();

    encounter.enemiesSpawned = 2;
    encounter.nextEnemyId = 3;

    const first = createEnemyState(2, "scout", 400_000);
    const second = createEnemyState(1, "scout", 600_000);

    expect(() => validateEncounterState(encounter, [first, second], [])).toThrow(
      "Enemy IDs must be unique and ordered in ascending order.",
    );
  });

  it("validates an accepted enemy projectile", () => {
    const projectile: EnemyProjectileState = {
      id: 1,
      ownerEnemyId: 1,
      kind: "kinetic",
      positionX: 500_000,
      positionY: 100_000,
      velocityX: 0,
      velocityY: 5_000,
      radius: 5_000,
      rawDamage: 400,
      remainingTicks: 240,
    };

    const encounter = createInitialEncounterState();

    encounter.nextEnemyProjectileId = 2;

    expect(validateEncounterState(encounter, [], [projectile])).toEqual({ valid: true });
  });

  it("rejects unordered enemy-projectile IDs", () => {
    const createProjectile = (id: number): EnemyProjectileState => ({
      id,
      ownerEnemyId: 1,
      kind: "kinetic",
      positionX: 500_000,
      positionY: 100_000,
      velocityX: 0,
      velocityY: 5_000,
      radius: 5_000,
      rawDamage: 400,
      remainingTicks: 240,
    });

    const encounter = createInitialEncounterState();

    encounter.nextEnemyProjectileId = 3;

    expect(() =>
      validateEncounterState(encounter, [], [createProjectile(2), createProjectile(1)]),
    ).toThrow("Enemy-projectile IDs must be unique and ordered in ascending order.");
  });

  it("reproduces equal spawns from equal seeds", () => {
    const createSpawn = () =>
      createEnemySpawn({
        waveNumber: 5,
        enemyId: 1,
        rngState: 1_987_041_211,
      });

    expect(createSpawn()).toEqual(createSpawn());
  });

  it("diverges across different spawn seeds", () => {
    const first = createEnemySpawn({
      waveNumber: 5,
      enemyId: 1,
      rngState: 1,
    });

    const second = createEnemySpawn({
      waveNumber: 5,
      enemyId: 1,
      rngState: 2,
    });

    expect({
      archetype: first.enemy.archetype,
      positionX: first.enemy.positionX,
      nextRngState: first.nextRngState,
    }).not.toEqual({
      archetype: second.enemy.archetype,
      positionX: second.enemy.positionX,
      nextRngState: second.nextRngState,
    });
  });

  it.each([0, 6, -1, 1.5])("rejects an invalid wave number: %s", (waveNumber) => {
    expect(() => getWaveEnemyCount(waveNumber as EncounterWaveNumber)).toThrow(
      "Wave number must be an integer from 1 to 5.",
    );
  });

  it("rejects an invalid archetype roll", () => {
    expect(() => selectEnemyArchetypeFromRoll(1, 100)).toThrow(
      "Archetype roll must be an integer from 0 to 99.",
    );
  });

  it("rejects an invalid enemy ID", () => {
    expect(() => createEnemyState(0, "scout", 500_000)).toThrow(
      "Enemy ID must be a positive safe integer.",
    );
  });

  it("rejects an enemy spawn outside the horizontal margins", () => {
    expect(() => createEnemyState(1, "scout", 39_999)).toThrow(
      "Enemy spawn X must be an integer from 40000 to 960000.",
    );
  });

  it("accepts a consistent active enemy state", () => {
    const encounter = createInitialEncounterState();
    const enemy: EnemyState = createEnemyState(1, "scout", 500_000);

    encounter.enemiesSpawned = 1;
    encounter.nextEnemyId = 2;

    expect(validateEncounterState(encounter, [enemy], [])).toEqual({ valid: true });
  });
});
