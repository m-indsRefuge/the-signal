import { describe, expect, it } from "vitest";

import {
  ENGINE_CONSTANTS,
  createInitialGameState,
  runSimulation,
  stepGame,
  type EngineEvent,
  type EnemyProjectileState,
  type EnemyState,
  type GameState,
  type PowerShiftAction,
  type TickFrame,
} from "../app/features/keep-the-signal/engine";

const KTS_I2_FIXTURE_SEED = 1_987_041_211;
const KTS_I2_DIFFERENT_SEED = 1_987_041_212;
const KTS_I2_MAXIMUM_FRAMES = 7_200;

const KTS_I2_EXPECTED_DIGEST = "58211ef2";
const KTS_I2_EXPECTED_CANONICAL_STATE =
  '{"engineVersion":"kts-i2.0.0","rulesetVersion":"kts-foundation-0.1","seed":1987041211,"rngState":2583674287,"tick":7200,"status":"running","terminalReason":null,"score":107342,"currentCoherenceTicks":7200,"longestCoherenceTicks":7200,"player":{"positionX":96220,"positionY":800000,"velocityX":-3800,"velocityY":0,"radius":18000},"power":{"weapons":49,"defence":28,"signal":23,"shiftCooldownTicks":0},"weapon":{"fireCooldownTicks":0,"nextProjectileId":373},"recoveryPulse":{"cooldownTicks":0},"defence":{"integrity":10000,"ticksSinceDamage":992,"recoveryRemainder":0},"signal":{"integrity":9610,"ticksSinceDamage":1250,"collapseTicks":0,"recoveryRemainder":42,"interferenceDamageRemainder":0},"interference":{"load":0},"projectiles":[],"encounter":{"phase":"complete","waveNumber":5,"phaseTicks":0,"spawnCooldownTicks":0,"enemiesScheduled":16,"enemiesSpawned":16,"enemiesDefeated":16,"enemiesEscaped":0,"totalEnemiesDefeated":59,"totalEnemiesEscaped":1,"nextEnemyId":61,"nextEnemyProjectileId":68},"enemies":[],"enemyProjectiles":[]}';

const KTS_I2_EXPECTED_EVENT_COUNTS: Readonly<Record<string, number>> = {
  action_rejected: 3593,
  defence_damaged: 5,
  defence_recovered: 1343,
  encounter_completed: 1,
  enemy_damaged: 99,
  enemy_destroyed: 59,
  enemy_escaped: 1,
  enemy_fired: 67,
  enemy_projectile_expired: 55,
  enemy_projectile_hit_player: 12,
  enemy_score_awarded: 59,
  enemy_spawned: 60,
  player_projectile_hit_enemy: 99,
  power_shift_applied: 6,
  projectile_expired: 273,
  projectile_fired: 372,
  recovery_pulse_applied: 1,
  score_added: 7200,
  signal_damaged: 8,
  signal_recovered: 3218,
  wave_completed: 5,
  wave_started: 4,
};

const KTS_I2_EXPECTED_ARCHETYPE_COUNTS: Readonly<Record<string, number>> = {
  disruptor: 11,
  interceptor: 18,
  scout: 31,
};

const KTS_I2_EXPECTED_SPAWN_SEQUENCE = [
  [1, 1, "scout", 315326, 35, 275326],
  [2, 1, "scout", 876255, 47, 836255],
  [3, 1, "scout", 62242, 86, 22242],
  [4, 1, "scout", 568296, 34, 528296],
  [5, 1, "scout", 144263, 17, 104263],
  [6, 1, "scout", 585240, 43, 545240],
  [7, 1, "scout", 842476, 54, 802476],
  [8, 1, "scout", 277313, 69, 237313],
  [9, 2, "scout", 604535, 68, 564535],
  [10, 2, "scout", 494772, 43, 454772],
  [11, 2, "scout", 953668, 35, 913668],
  [12, 2, "scout", 570889, 17, 530889],
  [13, 2, "scout", 68012, 63, 28012],
  [14, 2, "scout", 513933, 25, 473933],
  [15, 2, "scout", 587648, 69, 547648],
  [16, 2, "scout", 348801, 72, 308801],
  [17, 2, "interceptor", 693178, 91, 653178],
  [18, 2, "scout", 47839, 68, 7839],
  [19, 3, "scout", 493164, 48, 453164],
  [20, 3, "interceptor", 62705, 80, 22705],
  [21, 3, "scout", 893038, 42, 853038],
  [22, 3, "disruptor", 216886, 93, 176886],
  [23, 3, "disruptor", 359316, 90, 319316],
  [24, 3, "scout", 497181, 28, 457181],
  [25, 3, "scout", 780424, 12, 740424],
  [26, 3, "interceptor", 318588, 82, 278588],
  [27, 3, "interceptor", 818810, 55, 778810],
  [28, 3, "interceptor", 744722, 56, 704722],
  [29, 3, "disruptor", 596280, 93, 556280],
  [30, 3, "interceptor", 206096, 71, 166096],
  [31, 4, "interceptor", 267050, 65, 227050],
  [32, 4, "disruptor", 567381, 78, 527381],
  [33, 4, "scout", 591407, 16, 551407],
  [34, 4, "interceptor", 623356, 71, 583356],
  [35, 4, "interceptor", 125736, 41, 85736],
  [36, 4, "scout", 222353, 15, 182353],
  [37, 4, "interceptor", 462811, 58, 422811],
  [38, 4, "interceptor", 739057, 42, 699057],
  [39, 4, "disruptor", 651935, 95, 611935],
  [40, 4, "interceptor", 76665, 60, 36665],
  [41, 4, "interceptor", 646072, 52, 606072],
  [42, 4, "disruptor", 825802, 87, 785802],
  [43, 4, "scout", 489618, 19, 449618],
  [44, 4, "interceptor", 428854, 59, 388854],
  [45, 5, "scout", 907622, 2, 867622],
  [46, 5, "scout", 166084, 11, 126084],
  [47, 5, "disruptor", 673346, 66, 633346],
  [48, 5, "scout", 624369, 0, 584369],
  [49, 5, "scout", 695931, 17, 655931],
  [50, 5, "interceptor", 618532, 40, 578532],
  [51, 5, "scout", 885979, 11, 845979],
  [52, 5, "disruptor", 490344, 66, 450344],
  [53, 5, "disruptor", 307360, 94, 267360],
  [54, 5, "interceptor", 728356, 34, 688356],
  [55, 5, "disruptor", 908252, 78, 868252],
  [56, 5, "interceptor", 520993, 51, 480993],
  [57, 5, "disruptor", 214019, 79, 174019],
  [58, 5, "interceptor", 807391, 50, 767391],
  [59, 5, "scout", 746242, 3, 706242],
  [60, 5, "scout", 351479, 3, 311479],
] as const;

interface FixtureControllerMemory {
  escapeWitnessId: number | null;
  kineticWitnessId: number | null;
  corruptionWitnessId: number | null;
  kineticHitObserved: boolean;
  corruptionHitObserved: boolean;
}

interface FixtureEvidence {
  readonly processedTicks: number;
  readonly stateDigest: string;
  readonly canonicalState: string;
  readonly status: GameState["status"];
  readonly terminalReason: GameState["terminalReason"];
  readonly finalSignalIntegrity: number;
  readonly finalDefenceIntegrity: number;
  readonly finalScore: number;
  readonly encounterPhase: GameState["encounter"]["phase"];
  readonly finalWaveNumber: number;
  readonly totalEnemiesDefeated: number;
  readonly totalEnemiesEscaped: number;
  readonly waveStarts: number[];
  readonly waveCompletions: number[];
  readonly spawnedArchetypes: string[];
  readonly spawnedArchetypeCounts: Record<string, number>;
  readonly kineticPlayerHits: number;
  readonly corruptionPlayerHits: number;
  readonly powerShiftsApplied: number;
  readonly rejectedActions: number;
  readonly playerProjectilesFired: number;
  readonly recoveryPulsesApplied: number;
  readonly eventCounts: Record<string, number>;
  readonly spawnSequence: Array<{
    readonly enemyId: number;
    readonly waveNumber: number;
    readonly archetype: string;
    readonly positionX: number;
    readonly archetypeRoll: number;
    readonly spawnXRoll: number;
  }>;
}

function createFixtureControllerMemory(): FixtureControllerMemory {
  return {
    escapeWitnessId: null,
    kineticWitnessId: null,
    corruptionWitnessId: null,
    kineticHitObserved: false,
    corruptionHitObserved: false,
  };
}

function createKtsI2FixtureFrames(): TickFrame[] {
  const frames: TickFrame[] = [];
  const memory = createFixtureControllerMemory();

  let state = createInitialGameState({
    seed: KTS_I2_FIXTURE_SEED,
  });

  for (let tick = 0; tick < KTS_I2_MAXIMUM_FRAMES; tick += 1) {
    refreshWitnesses(state, memory);

    const target = selectControllerTarget(state, memory, tick);
    const moveX = chooseMovementAxis(
      state.player.positionX,
      state.player.velocityX,
      target.positionX,
    );

    const powerShift = createFixturePowerShift(tick);
    const recoveryPulse =
      tick === 900 ||
      (state.recoveryPulse.cooldownTicks === 0 &&
        (state.signal.integrity < 7_000 || state.defence.integrity < 5_000));

    const frame: TickFrame = {
      player: {
        moveX,
        moveY: 0,
        fire: target.fire,
        recoveryPulse,
        ...(powerShift === undefined ? {} : { powerShift }),
      },
      environmentEvents: [],
    };

    frames.push(frame);

    const result = stepGame(state, frame);

    observeFixtureEvents(result.events, memory);
    state = result.state;
  }

  return frames;
}

function refreshWitnesses(state: Readonly<GameState>, memory: FixtureControllerMemory): void {
  if (state.encounter.totalEnemiesEscaped > 0) {
    memory.escapeWitnessId = null;
  } else if (
    memory.escapeWitnessId === null ||
    !state.enemies.some((enemy) => enemy.id === memory.escapeWitnessId)
  ) {
    memory.escapeWitnessId = state.enemies[0]?.id ?? null;
  }

  if (memory.kineticHitObserved) {
    memory.kineticWitnessId = null;
  } else if (
    memory.kineticWitnessId === null ||
    !state.enemies.some((enemy) => enemy.id === memory.kineticWitnessId)
  ) {
    memory.kineticWitnessId =
      state.enemies.find((enemy) => enemy.archetype === "interceptor")?.id ?? null;
  }

  if (memory.corruptionHitObserved) {
    memory.corruptionWitnessId = null;
  } else if (
    memory.corruptionWitnessId === null ||
    !state.enemies.some((enemy) => enemy.id === memory.corruptionWitnessId)
  ) {
    memory.corruptionWitnessId =
      state.enemies.find((enemy) => enemy.archetype === "disruptor")?.id ?? null;
  }
}

function selectControllerTarget(
  state: Readonly<GameState>,
  memory: Readonly<FixtureControllerMemory>,
  tick: number,
): {
  readonly positionX: number;
  readonly fire: boolean;
} {
  const awaitedProjectile = selectAwaitedProjectile(state, memory);

  if (awaitedProjectile !== null) {
    return {
      positionX: awaitedProjectile.positionX,
      fire: false,
    };
  }

  const armedWitness = selectArmedWitness(state, memory);

  if (armedWitness !== null) {
    return {
      positionX: armedWitness.positionX,
      fire: false,
    };
  }

  const protectedIds = new Set<number>();

  if (memory.escapeWitnessId !== null) {
    protectedIds.add(memory.escapeWitnessId);
  }

  if (memory.kineticWitnessId !== null) {
    protectedIds.add(memory.kineticWitnessId);
  }

  if (memory.corruptionWitnessId !== null) {
    protectedIds.add(memory.corruptionWitnessId);
  }

  const targetEnemy = [...state.enemies]
    .filter((enemy) => !protectedIds.has(enemy.id) && canPlayerProjectileReachEnemy(state, enemy))
    .sort((left, right) => {
      if (left.positionY !== right.positionY) {
        return right.positionY - left.positionY;
      }

      return left.id - right.id;
    })[0];

  if (targetEnemy !== undefined) {
    const horizontalError = Math.abs(targetEnemy.positionX - state.player.positionX);

    const requiredWitnessesComplete =
      memory.kineticHitObserved &&
      memory.corruptionHitObserved &&
      state.encounter.totalEnemiesEscaped > 0;

    return {
      positionX: targetEnemy.positionX,
      fire: requiredWitnessesComplete || horizontalError <= 60_000,
    };
  }

  return {
    positionX: patrolPositionX(tick),
    fire: false,
  };
}

function selectAwaitedProjectile(
  state: Readonly<GameState>,
  memory: Readonly<FixtureControllerMemory>,
): Readonly<EnemyProjectileState> | null {
  if (!memory.kineticHitObserved) {
    const kineticProjectile = state.enemyProjectiles.find(
      (projectile) => projectile.kind === "kinetic",
    );

    if (kineticProjectile !== undefined) {
      return kineticProjectile;
    }
  }

  if (!memory.corruptionHitObserved) {
    const corruptionProjectile = state.enemyProjectiles.find(
      (projectile) => projectile.kind === "corruption",
    );

    if (corruptionProjectile !== undefined) {
      return corruptionProjectile;
    }
  }

  return null;
}

function selectArmedWitness(
  state: Readonly<GameState>,
  memory: Readonly<FixtureControllerMemory>,
): Readonly<EnemyState> | null {
  const kineticWitness = findEnemy(state, memory.kineticWitnessId);

  if (
    !memory.kineticHitObserved &&
    kineticWitness !== null &&
    canPlayerProjectileReachEnemy(state, kineticWitness) &&
    kineticWitness.fireCooldownTicks <= 24
  ) {
    return kineticWitness;
  }

  const corruptionWitness = findEnemy(state, memory.corruptionWitnessId);

  if (
    !memory.corruptionHitObserved &&
    corruptionWitness !== null &&
    canPlayerProjectileReachEnemy(state, corruptionWitness) &&
    corruptionWitness.fireCooldownTicks <= 24
  ) {
    return corruptionWitness;
  }

  return null;
}

function findEnemy(
  state: Readonly<GameState>,
  enemyId: number | null,
): Readonly<EnemyState> | null {
  if (enemyId === null) {
    return null;
  }

  return state.enemies.find((enemy) => enemy.id === enemyId) ?? null;
}

function canPlayerProjectileReachEnemy(
  state: Readonly<GameState>,
  enemy: Readonly<EnemyState>,
): boolean {
  const projectilePositionYAfterCurrentTick =
    state.player.positionY -
    ENGINE_CONSTANTS.PLAYER_RADIUS -
    ENGINE_CONSTANTS.PROJECTILE_RADIUS -
    ENGINE_CONSTANTS.PROJECTILE_SPEED_PER_TICK;

  return (
    enemy.positionY - enemy.radius <=
    projectilePositionYAfterCurrentTick + ENGINE_CONSTANTS.PROJECTILE_RADIUS
  );
}

function chooseMovementAxis(positionX: number, velocityX: number, targetX: number): -1 | 0 | 1 {
  const error = targetX - positionX;
  const absoluteError = Math.abs(error);

  if (absoluteError <= 6_000) {
    if (Math.abs(velocityX) <= 360) {
      return 0;
    }

    return velocityX > 0 ? -1 : 1;
  }

  const stoppingDistance = Math.floor((velocityX * velocityX) / (2 * 360));

  if (error > 0) {
    if (velocityX < 0) {
      return 1;
    }

    return stoppingDistance >= error ? -1 : 1;
  }

  if (velocityX > 0) {
    return -1;
  }

  return stoppingDistance >= absoluteError ? 1 : -1;
}

function patrolPositionX(tick: number): number {
  const patrolPeriod = 480;
  const halfPeriod = patrolPeriod / 2;
  const positionInPeriod = tick % patrolPeriod;
  const distance =
    positionInPeriod <= halfPeriod ? positionInPeriod : patrolPeriod - positionInPeriod;

  return 80_000 + Math.floor((distance * 840_000) / halfPeriod);
}

function createFixturePowerShift(tick: number): PowerShiftAction | undefined {
  if (tick === 0 || tick === 1) {
    return {
      from: "weapons",
      to: "signal",
    };
  }

  if (tick === 24) {
    return {
      from: "defence",
      to: "signal",
    };
  }

  if (tick === 48 || tick === 72 || tick === 96 || tick === 120) {
    return {
      from: "signal",
      to: "weapons",
    };
  }

  return undefined;
}

function observeFixtureEvents(
  events: readonly EngineEvent[],
  memory: FixtureControllerMemory,
): void {
  for (const event of events) {
    if (event.type !== "enemy_projectile_hit_player") {
      continue;
    }

    if (event.projectileKind === "kinetic") {
      memory.kineticHitObserved = true;
    } else {
      memory.corruptionHitObserved = true;
    }
  }
}

function eventsOfType<T extends EngineEvent["type"]>(
  events: readonly EngineEvent[],
  type: T,
): Array<Extract<EngineEvent, { readonly type: T }>> {
  return events.filter(
    (event): event is Extract<EngineEvent, { readonly type: T }> => event.type === type,
  );
}

function countEvents(events: readonly EngineEvent[]): Record<string, number> {
  const counts = new Map<string, number>();

  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function countSpawnedArchetypes(
  spawnedEvents: ReturnType<typeof getSpawnedEvents>,
): Record<string, number> {
  const counts = new Map<string, number>();

  for (const event of spawnedEvents) {
    counts.set(event.archetype, (counts.get(event.archetype) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function getSpawnedEvents(events: readonly EngineEvent[]) {
  return eventsOfType(events, "enemy_spawned");
}

function createFixtureEvidence(result: ReturnType<typeof runSimulation>): FixtureEvidence {
  const spawnedEvents = getSpawnedEvents(result.events);
  const waveStartedEvents = eventsOfType(result.events, "wave_started");
  const waveCompletedEvents = eventsOfType(result.events, "wave_completed");
  const projectileHitEvents = eventsOfType(result.events, "enemy_projectile_hit_player");

  return {
    processedTicks: result.processedTicks,
    stateDigest: result.stateDigest,
    canonicalState: result.canonicalState,
    status: result.finalState.status,
    terminalReason: result.finalState.terminalReason,
    finalSignalIntegrity: result.finalState.signal.integrity,
    finalDefenceIntegrity: result.finalState.defence.integrity,
    finalScore: result.finalState.score,
    encounterPhase: result.finalState.encounter.phase,
    finalWaveNumber: result.finalState.encounter.waveNumber,
    totalEnemiesDefeated: result.finalState.encounter.totalEnemiesDefeated,
    totalEnemiesEscaped: result.finalState.encounter.totalEnemiesEscaped,
    waveStarts: [1, ...waveStartedEvents.map((event) => event.waveNumber)],
    waveCompletions: waveCompletedEvents.map((event) => event.waveNumber),
    spawnedArchetypes: [...new Set(spawnedEvents.map((event) => event.archetype))].sort(),
    spawnedArchetypeCounts: countSpawnedArchetypes(spawnedEvents),
    kineticPlayerHits: projectileHitEvents.filter((event) => event.projectileKind === "kinetic")
      .length,
    corruptionPlayerHits: projectileHitEvents.filter(
      (event) => event.projectileKind === "corruption",
    ).length,
    powerShiftsApplied: eventsOfType(result.events, "power_shift_applied").length,
    rejectedActions: eventsOfType(result.events, "action_rejected").length,
    playerProjectilesFired: eventsOfType(result.events, "projectile_fired").length,
    recoveryPulsesApplied: eventsOfType(result.events, "recovery_pulse_applied").length,
    eventCounts: countEvents(result.events),
    spawnSequence: spawnedEvents.map((event) => ({
      enemyId: event.enemyId,
      waveNumber: event.waveNumber,
      archetype: event.archetype,
      positionX: event.positionX,
      archetypeRoll: event.archetypeRoll,
      spawnXRoll: event.spawnXRoll,
    })),
  };
}

describe("Keep the Signal KTS-I2 deterministic encounter fixture", () => {
  const frames = createKtsI2FixtureFrames();

  it("defines exactly 7,200 deterministic scripted input frames", () => {
    expect(frames).toHaveLength(KTS_I2_MAXIMUM_FRAMES);
  });

  it("replays the same seed with byte-identical state, digest, and events", () => {
    const first = runSimulation({
      seed: KTS_I2_FIXTURE_SEED,
      frames,
      maximumTickCount: KTS_I2_MAXIMUM_FRAMES,
    });

    const second = runSimulation({
      seed: KTS_I2_FIXTURE_SEED,
      frames,
      maximumTickCount: KTS_I2_MAXIMUM_FRAMES,
    });

    expect(first.canonicalState).toBe(KTS_I2_EXPECTED_CANONICAL_STATE);
    expect(first.stateDigest).toBe(KTS_I2_EXPECTED_DIGEST);
    expect(second.canonicalState).toBe(first.canonicalState);
    expect(second.stateDigest).toBe(first.stateDigest);
    expect(second.events).toEqual(first.events);
    expect(second.finalState).toEqual(first.finalState);
  });

  it("diverges when the same frames are replayed with a different seed", () => {
    const canonical = runSimulation({
      seed: KTS_I2_FIXTURE_SEED,
      frames,
      maximumTickCount: KTS_I2_MAXIMUM_FRAMES,
    });

    const divergent = runSimulation({
      seed: KTS_I2_DIFFERENT_SEED,
      frames,
      maximumTickCount: KTS_I2_MAXIMUM_FRAMES,
    });

    const canonicalSpawns = getSpawnedEvents(canonical.events).map((event) => [
      event.waveNumber,
      event.archetype,
      event.positionX,
    ]);

    const divergentSpawns = getSpawnedEvents(divergent.events).map((event) => [
      event.waveNumber,
      event.archetype,
      event.positionX,
    ]);

    expect(
      divergent.stateDigest !== canonical.stateDigest ||
        JSON.stringify(divergentSpawns) !== JSON.stringify(canonicalSpawns),
    ).toBe(true);
  });

  it("demonstrates every required canonical encounter outcome", () => {
    const result = runSimulation({
      seed: KTS_I2_FIXTURE_SEED,
      frames,
      maximumTickCount: KTS_I2_MAXIMUM_FRAMES,
    });

    const evidence = createFixtureEvidence(result);

    expect(evidence.processedTicks).toBe(KTS_I2_MAXIMUM_FRAMES);
    expect(evidence.waveStarts).toEqual([1, 2, 3, 4, 5]);
    expect(evidence.waveCompletions).toEqual([1, 2, 3, 4, 5]);
    expect(evidence.encounterPhase).toBe("complete");
    expect(evidence.finalWaveNumber).toBe(5);
    expect(evidence.spawnedArchetypes).toEqual(["disruptor", "interceptor", "scout"]);
    expect(evidence.totalEnemiesDefeated).toBeGreaterThanOrEqual(20);
    expect(evidence.totalEnemiesEscaped).toBeGreaterThanOrEqual(1);
    expect(evidence.kineticPlayerHits).toBeGreaterThanOrEqual(1);
    expect(evidence.corruptionPlayerHits).toBeGreaterThanOrEqual(1);
    expect(evidence.powerShiftsApplied).toBeGreaterThanOrEqual(1);
    expect(evidence.rejectedActions).toBeGreaterThanOrEqual(1);
    expect(evidence.playerProjectilesFired).toBeGreaterThanOrEqual(1);
    expect(evidence.recoveryPulsesApplied).toBeGreaterThanOrEqual(1);
    expect(evidence.finalSignalIntegrity).toBeGreaterThan(0);
    expect(evidence.status).toBe("running");
    expect(evidence.terminalReason).toBeNull();
    expect(evidence.stateDigest).toMatch(/^[0-9a-f]{8}$/);
  });

  it("matches the permanent canonical event and spawn evidence", () => {
    const result = runSimulation({
      seed: KTS_I2_FIXTURE_SEED,
      frames,
      maximumTickCount: KTS_I2_MAXIMUM_FRAMES,
    });

    const evidence = createFixtureEvidence(result);

    expect(evidence).toMatchObject({
      processedTicks: 7_200,
      stateDigest: KTS_I2_EXPECTED_DIGEST,
      canonicalState: KTS_I2_EXPECTED_CANONICAL_STATE,
      status: "running",
      terminalReason: null,
      finalSignalIntegrity: 9610,
      finalDefenceIntegrity: 10000,
      finalScore: 107342,
      encounterPhase: "complete",
      finalWaveNumber: 5,
      totalEnemiesDefeated: 59,
      totalEnemiesEscaped: 1,
      waveStarts: [1, 2, 3, 4, 5],
      waveCompletions: [1, 2, 3, 4, 5],
      spawnedArchetypes: ["disruptor", "interceptor", "scout"],
      kineticPlayerHits: 4,
      corruptionPlayerHits: 8,
      powerShiftsApplied: 6,
      rejectedActions: 3593,
      playerProjectilesFired: 372,
      recoveryPulsesApplied: 1,
    });

    expect(evidence.eventCounts).toEqual(KTS_I2_EXPECTED_EVENT_COUNTS);
    expect(evidence.spawnedArchetypeCounts).toEqual(KTS_I2_EXPECTED_ARCHETYPE_COUNTS);
    expect(
      evidence.spawnSequence.map((event) => [
        event.enemyId,
        event.waveNumber,
        event.archetype,
        event.positionX,
        event.archetypeRoll,
        event.spawnXRoll,
      ]),
    ).toEqual(KTS_I2_EXPECTED_SPAWN_SEQUENCE);
  });
});
