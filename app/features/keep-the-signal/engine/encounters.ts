import { ENGINE_CONSTANTS } from "./constants";
import {
  ENEMY_ARCHETYPE_CONFIGS,
  createEnemySpawn,
  type EnemyArchetype,
  type EnemyProjectileKind,
  type EnemyProjectileState,
  type EnemySpawnResult,
  type EnemyState,
} from "./enemies";

export type EncounterPhase = "active" | "intermission" | "complete";

export type EncounterWaveNumber = 1 | 2 | 3 | 4 | 5;

export interface EncounterState {
  phase: EncounterPhase;
  waveNumber: EncounterWaveNumber;
  phaseTicks: number;
  spawnCooldownTicks: number;
  enemiesScheduled: number;
  enemiesSpawned: number;
  enemiesDefeated: number;
  enemiesEscaped: number;
  totalEnemiesDefeated: number;
  totalEnemiesEscaped: number;
  nextEnemyId: number;
  nextEnemyProjectileId: number;
}

export interface EncounterValidationResult {
  readonly valid: true;
}

export class EncounterInvariantError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EncounterInvariantError";
    this.code = code;
  }
}

export interface SpawnEncounterEnemyResult extends EnemySpawnResult {
  readonly encounter: EncounterState;
}

export interface AdvanceEncounterIntermissionResult {
  readonly encounter: EncounterState;
  readonly waveStarted: EncounterWaveNumber | null;
}

export interface CompleteEncounterWaveResult {
  readonly encounter: EncounterState;
  readonly waveCompleted: EncounterWaveNumber | null;
  readonly encounterCompleted: boolean;
}

export function createInitialEncounterState(): EncounterState {
  return {
    phase: "active",
    waveNumber: 1,
    phaseTicks: 0,
    spawnCooldownTicks: 0,
    enemiesScheduled: getWaveEnemyCount(1),
    enemiesSpawned: 0,
    enemiesDefeated: 0,
    enemiesEscaped: 0,
    totalEnemiesDefeated: 0,
    totalEnemiesEscaped: 0,
    nextEnemyId: 1,
    nextEnemyProjectileId: 1,
  };
}

export function getWaveEnemyCount(waveNumber: EncounterWaveNumber): number {
  assertWaveNumber(waveNumber);

  return ENGINE_CONSTANTS.WAVE_ENEMY_COUNTS[waveNumber - 1];
}

export function getWaveSpawnInterval(waveNumber: EncounterWaveNumber): number {
  assertWaveNumber(waveNumber);

  return ENGINE_CONSTANTS.WAVE_SPAWN_INTERVAL_TICKS[waveNumber - 1];
}

export function canSpawnEncounterEnemy(encounter: Readonly<EncounterState>): boolean {
  return (
    encounter.phase === "active" &&
    encounter.spawnCooldownTicks === 0 &&
    encounter.enemiesSpawned < encounter.enemiesScheduled
  );
}

export function decrementEncounterSpawnCooldown(
  encounter: Readonly<EncounterState>,
): EncounterState {
  return {
    ...encounter,
    spawnCooldownTicks: encounter.spawnCooldownTicks > 0 ? encounter.spawnCooldownTicks - 1 : 0,
  };
}

export function spawnEncounterEnemy(
  encounter: Readonly<EncounterState>,
  rngState: number,
): SpawnEncounterEnemyResult {
  if (!canSpawnEncounterEnemy(encounter)) {
    throw new EncounterInvariantError(
      "spawn_not_eligible",
      "The encounter is not currently eligible to spawn an enemy.",
    );
  }

  const result = createEnemySpawn({
    waveNumber: encounter.waveNumber,
    enemyId: encounter.nextEnemyId,
    rngState,
  });

  return {
    ...result,
    encounter: {
      ...encounter,
      spawnCooldownTicks: getWaveSpawnInterval(encounter.waveNumber),
      enemiesSpawned: encounter.enemiesSpawned + 1,
      nextEnemyId: encounter.nextEnemyId + 1,
    },
  };
}

export function advanceEncounterIntermission(
  encounter: Readonly<EncounterState>,
): AdvanceEncounterIntermissionResult {
  if (encounter.phase !== "intermission") {
    return {
      encounter: { ...encounter },
      waveStarted: null,
    };
  }

  if (encounter.waveNumber >= ENGINE_CONSTANTS.ENCOUNTER_WAVE_COUNT) {
    throw new EncounterInvariantError(
      "intermission_after_final_wave",
      "Wave 5 cannot enter or advance an intermission.",
    );
  }

  const nextPhaseTicks = encounter.phaseTicks + 1;

  if (nextPhaseTicks < ENGINE_CONSTANTS.WAVE_INTERMISSION_TICKS) {
    return {
      encounter: {
        ...encounter,
        phaseTicks: nextPhaseTicks,
      },
      waveStarted: null,
    };
  }

  const nextWaveNumber = (encounter.waveNumber + 1) as EncounterWaveNumber;

  return {
    encounter: {
      ...encounter,
      phase: "active",
      waveNumber: nextWaveNumber,
      phaseTicks: 0,
      spawnCooldownTicks: 0,
      enemiesScheduled: getWaveEnemyCount(nextWaveNumber),
      enemiesSpawned: 0,
      enemiesDefeated: 0,
      enemiesEscaped: 0,
    },
    waveStarted: nextWaveNumber,
  };
}

export function completeEncounterWaveIfEligible(
  encounter: Readonly<EncounterState>,
  enemies: readonly Readonly<EnemyState>[],
  enemyProjectiles: readonly Readonly<EnemyProjectileState>[],
): CompleteEncounterWaveResult {
  const waveIsComplete =
    encounter.phase === "active" &&
    encounter.enemiesSpawned === encounter.enemiesScheduled &&
    enemies.length === 0 &&
    enemyProjectiles.length === 0;

  if (!waveIsComplete) {
    return {
      encounter: { ...encounter },
      waveCompleted: null,
      encounterCompleted: false,
    };
  }

  if (encounter.waveNumber === ENGINE_CONSTANTS.ENCOUNTER_WAVE_COUNT) {
    return {
      encounter: {
        ...encounter,
        phase: "complete",
        phaseTicks: 0,
        spawnCooldownTicks: 0,
      },
      waveCompleted: encounter.waveNumber,
      encounterCompleted: true,
    };
  }

  return {
    encounter: {
      ...encounter,
      phase: "intermission",
      phaseTicks: 0,
      spawnCooldownTicks: 0,
    },
    waveCompleted: encounter.waveNumber,
    encounterCompleted: false,
  };
}

export function validateEncounterState(
  encounter: Readonly<EncounterState>,
  enemies: readonly Readonly<EnemyState>[],
  enemyProjectiles: readonly Readonly<EnemyProjectileState>[],
): EncounterValidationResult {
  if (
    encounter.phase !== "active" &&
    encounter.phase !== "intermission" &&
    encounter.phase !== "complete"
  ) {
    fail("phase", "Encounter phase is invalid.");
  }

  assertWaveNumber(encounter.waveNumber);

  assertNonNegativeSafeInteger(encounter.phaseTicks, "encounter.phaseTicks");
  assertNonNegativeSafeInteger(encounter.spawnCooldownTicks, "encounter.spawnCooldownTicks");
  assertNonNegativeSafeInteger(encounter.enemiesScheduled, "encounter.enemiesScheduled");
  assertNonNegativeSafeInteger(encounter.enemiesSpawned, "encounter.enemiesSpawned");
  assertNonNegativeSafeInteger(encounter.enemiesDefeated, "encounter.enemiesDefeated");
  assertNonNegativeSafeInteger(encounter.enemiesEscaped, "encounter.enemiesEscaped");
  assertNonNegativeSafeInteger(encounter.totalEnemiesDefeated, "encounter.totalEnemiesDefeated");
  assertNonNegativeSafeInteger(encounter.totalEnemiesEscaped, "encounter.totalEnemiesEscaped");
  assertPositiveSafeInteger(encounter.nextEnemyId, "encounter.nextEnemyId");
  assertPositiveSafeInteger(encounter.nextEnemyProjectileId, "encounter.nextEnemyProjectileId");

  const expectedScheduled = getWaveEnemyCount(encounter.waveNumber);

  if (encounter.enemiesScheduled !== expectedScheduled) {
    fail(
      "scheduled_count",
      `Wave ${encounter.waveNumber} must schedule ${expectedScheduled} enemies.`,
    );
  }

  if (encounter.enemiesSpawned > encounter.enemiesScheduled) {
    fail("spawned_count", "Current-wave spawned enemies must not exceed scheduled enemies.");
  }

  if (encounter.enemiesDefeated + encounter.enemiesEscaped > encounter.enemiesSpawned) {
    fail(
      "resolved_count",
      "Current-wave defeated and escaped enemies must not exceed spawned enemies.",
    );
  }

  const expectedActiveEnemyCount =
    encounter.enemiesSpawned - encounter.enemiesDefeated - encounter.enemiesEscaped;

  if (enemies.length !== expectedActiveEnemyCount) {
    fail("active_enemy_count", "Active enemy count is inconsistent with encounter counters.");
  }

  if (
    encounter.totalEnemiesDefeated < encounter.enemiesDefeated ||
    encounter.totalEnemiesEscaped < encounter.enemiesEscaped
  ) {
    fail("total_count", "Encounter totals must not be below current-wave counters.");
  }

  if (
    encounter.totalEnemiesDefeated + encounter.totalEnemiesEscaped >
    ENGINE_CONSTANTS.ENCOUNTER_TOTAL_ENEMIES
  ) {
    fail(
      "total_resolved_count",
      `Encounter resolved-enemy totals must not exceed ${ENGINE_CONSTANTS.ENCOUNTER_TOTAL_ENEMIES}.`,
    );
  }

  if (enemies.length > ENGINE_CONSTANTS.MAX_ACTIVE_ENEMIES) {
    fail(
      "enemy_capacity",
      `Active enemy count must not exceed ${ENGINE_CONSTANTS.MAX_ACTIVE_ENEMIES}.`,
    );
  }

  if (enemyProjectiles.length > ENGINE_CONSTANTS.MAX_ACTIVE_ENEMY_PROJECTILES) {
    fail(
      "enemy_projectile_capacity",
      `Enemy-projectile count must not exceed ${ENGINE_CONSTANTS.MAX_ACTIVE_ENEMY_PROJECTILES}.`,
    );
  }

  if (
    encounter.phase === "intermission" &&
    (encounter.enemiesSpawned !== encounter.enemiesScheduled ||
      enemies.length !== 0 ||
      enemyProjectiles.length !== 0)
  ) {
    fail(
      "intermission_state",
      "Intermission requires a fully resolved wave and no active enemy entities.",
    );
  }

  if (encounter.phase === "active" && encounter.phaseTicks !== 0) {
    fail("active_phase_ticks", "Active encounter phase ticks must remain zero.");
  }

  if (encounter.phase === "intermission") {
    if (encounter.waveNumber === ENGINE_CONSTANTS.ENCOUNTER_WAVE_COUNT) {
      fail("final_wave_intermission", "Wave 5 cannot enter an intermission.");
    }

    if (encounter.phaseTicks >= ENGINE_CONSTANTS.WAVE_INTERMISSION_TICKS) {
      fail(
        "intermission_phase_ticks",
        `Intermission phase ticks must remain below ${ENGINE_CONSTANTS.WAVE_INTERMISSION_TICKS}.`,
      );
    }

    if (encounter.spawnCooldownTicks !== 0) {
      fail("intermission_spawn_cooldown", "Intermission spawn cooldown must be zero.");
    }
  }

  if (encounter.phase === "complete") {
    if (encounter.waveNumber !== 5) {
      fail("complete_wave", "Encounter completion is permitted only after Wave 5.");
    }

    if (encounter.phaseTicks !== 0) {
      fail("complete_phase_ticks", "Completed encounter phase ticks must be zero.");
    }

    if (encounter.spawnCooldownTicks !== 0) {
      fail("complete_spawn_cooldown", "Completed encounter spawn cooldown must be zero.");
    }

    if (
      encounter.enemiesSpawned !== encounter.enemiesScheduled ||
      enemies.length !== 0 ||
      enemyProjectiles.length !== 0
    ) {
      fail(
        "complete_state",
        "Encounter completion requires a fully resolved final wave and no active enemy entities.",
      );
    }
  }

  validateEnemies(enemies, encounter.nextEnemyId);
  validateEnemyProjectiles(enemyProjectiles, encounter.nextEnemyProjectileId);

  return { valid: true };
}

function validateEnemies(enemies: readonly Readonly<EnemyState>[], nextEnemyId: number): void {
  let previousId = 0;

  for (const enemy of enemies) {
    assertPositiveSafeInteger(enemy.id, "enemy.id");

    if (enemy.id <= previousId) {
      fail("enemy_order", "Enemy IDs must be unique and ordered in ascending order.");
    }

    if (enemy.id >= nextEnemyId) {
      fail("enemy_next_id", "Every active enemy ID must be lower than nextEnemyId.");
    }

    if (!isEnemyArchetype(enemy.archetype)) {
      fail("enemy_archetype", "Enemy archetype is invalid.");
    }

    const config = ENEMY_ARCHETYPE_CONFIGS[enemy.archetype];

    assertSafeInteger(enemy.positionX, "enemy.positionX");
    assertSafeInteger(enemy.positionY, "enemy.positionY");
    assertSafeInteger(enemy.velocityX, "enemy.velocityX");
    assertSafeInteger(enemy.velocityY, "enemy.velocityY");

    if (
      enemy.positionX < ENGINE_CONSTANTS.ENEMY_SPAWN_MIN_X ||
      enemy.positionX > ENGINE_CONSTANTS.ENEMY_SPAWN_MAX_X
    ) {
      fail("enemy_position_x", "Enemy X must remain within the horizontal enemy boundaries.");
    }

    if (enemy.radius !== config.radius) {
      fail("enemy_radius", "Enemy radius does not match its archetype.");
    }

    if (enemy.maximumIntegrity !== config.maximumIntegrity) {
      fail("enemy_maximum_integrity", "Enemy maximum integrity does not match its archetype.");
    }

    if (
      !Number.isSafeInteger(enemy.integrity) ||
      enemy.integrity <= 0 ||
      enemy.integrity > enemy.maximumIntegrity
    ) {
      fail(
        "enemy_integrity",
        "Active enemy integrity must be positive and no greater than maximum integrity.",
      );
    }

    if (enemy.fireIntervalTicks !== config.fireIntervalTicks) {
      fail("enemy_fire_interval", "Enemy fire interval does not match its archetype.");
    }

    if (
      !Number.isSafeInteger(enemy.fireCooldownTicks) ||
      enemy.fireCooldownTicks < 0 ||
      enemy.fireCooldownTicks > enemy.fireIntervalTicks
    ) {
      fail("enemy_fire_cooldown", "Enemy fire cooldown is outside its archetype interval.");
    }

    previousId = enemy.id;
  }
}

function validateEnemyProjectiles(
  projectiles: readonly Readonly<EnemyProjectileState>[],
  nextProjectileId: number,
): void {
  let previousId = 0;

  for (const projectile of projectiles) {
    assertPositiveSafeInteger(projectile.id, "enemyProjectile.id");
    assertPositiveSafeInteger(projectile.ownerEnemyId, "enemyProjectile.ownerEnemyId");

    if (projectile.id <= previousId) {
      fail(
        "enemy_projectile_order",
        "Enemy-projectile IDs must be unique and ordered in ascending order.",
      );
    }

    if (projectile.id >= nextProjectileId) {
      fail(
        "enemy_projectile_next_id",
        "Every enemy-projectile ID must be lower than nextEnemyProjectileId.",
      );
    }

    if (!isEnemyProjectileKind(projectile.kind)) {
      fail("enemy_projectile_kind", "Enemy-projectile kind is invalid.");
    }

    assertSafeInteger(projectile.positionX, "enemyProjectile.positionX");
    assertSafeInteger(projectile.positionY, "enemyProjectile.positionY");
    assertSafeInteger(projectile.velocityX, "enemyProjectile.velocityX");
    assertSafeInteger(projectile.velocityY, "enemyProjectile.velocityY");

    if (projectile.radius !== ENGINE_CONSTANTS.ENEMY_PROJECTILE_RADIUS) {
      fail("enemy_projectile_radius", "Enemy-projectile radius is invalid.");
    }

    if (!Number.isSafeInteger(projectile.rawDamage) || projectile.rawDamage <= 0) {
      fail("enemy_projectile_damage", "Enemy-projectile raw damage must be positive.");
    }

    if (
      !Number.isSafeInteger(projectile.remainingTicks) ||
      projectile.remainingTicks <= 0 ||
      projectile.remainingTicks > ENGINE_CONSTANTS.ENEMY_PROJECTILE_LIFETIME_TICKS
    ) {
      fail("enemy_projectile_lifetime", "Enemy-projectile lifetime is invalid.");
    }

    previousId = projectile.id;
  }
}

function isEnemyArchetype(value: unknown): value is EnemyArchetype {
  return value === "scout" || value === "interceptor" || value === "disruptor";
}

function isEnemyProjectileKind(value: unknown): value is EnemyProjectileKind {
  return value === "kinetic" || value === "corruption";
}

function assertWaveNumber(waveNumber: number): asserts waveNumber is EncounterWaveNumber {
  if (
    !Number.isSafeInteger(waveNumber) ||
    waveNumber < 1 ||
    waveNumber > ENGINE_CONSTANTS.ENCOUNTER_WAVE_COUNT
  ) {
    throw new RangeError(
      `Wave number must be an integer from 1 to ${ENGINE_CONSTANTS.ENCOUNTER_WAVE_COUNT}.`,
    );
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    fail("safe_integer", `${label} must be a safe integer.`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);

  if (value < 0) {
    fail("non_negative_integer", `${label} must not be negative.`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);

  if (value <= 0) {
    fail("positive_integer", `${label} must be greater than zero.`);
  }
}

function fail(code: string, message: string): never {
  throw new EncounterInvariantError(code, message);
}
