import { ENGINE_CONSTANTS } from "./constants";
import type { EncounterWaveNumber } from "./encounters";
import { nextInt } from "./seeded-random";

export type EnemyArchetype = "scout" | "interceptor" | "disruptor";

export type EnemyProjectileKind = "kinetic" | "corruption";

export type EnemyProjectileExpiryReason = "lifetime" | "world_boundary";

export interface EnemyArchetypeConfig {
  readonly archetype: EnemyArchetype;
  readonly maximumIntegrity: number;
  readonly radius: number;
  readonly verticalSpeed: number;
  readonly horizontalSpeed: number;
  readonly fireIntervalTicks: number;
  readonly projectileKind: EnemyProjectileKind | null;
  readonly projectileRawDamage: number;
  readonly destructionScore: number;
  readonly escapeDefenceDamage: number;
  readonly escapeSignalDamage: number;
}

export interface EnemyState {
  id: number;
  archetype: EnemyArchetype;
  positionX: number;
  positionY: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  integrity: number;
  maximumIntegrity: number;
  fireCooldownTicks: number;
  fireIntervalTicks: number;
  destructionScore: number;
  escapeDefenceDamage: number;
  escapeSignalDamage: number;
}

export interface EnemyProjectileState {
  id: number;
  ownerEnemyId: number;
  kind: EnemyProjectileKind;
  positionX: number;
  positionY: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  rawDamage: number;
  remainingTicks: number;
}

export interface EnemyProjectileIntegrationResult {
  readonly projectile: EnemyProjectileState;
  readonly expiryReason: EnemyProjectileExpiryReason | null;
}

const SCOUT_CONFIG: Readonly<EnemyArchetypeConfig> = Object.freeze({
  archetype: "scout",
  maximumIntegrity: 1_000,
  radius: 14_000,
  verticalSpeed: 1_800,
  horizontalSpeed: 0,
  fireIntervalTicks: 0,
  projectileKind: null,
  projectileRawDamage: 0,
  destructionScore: 100,
  escapeDefenceDamage: 300,
  escapeSignalDamage: 0,
});

const INTERCEPTOR_CONFIG: Readonly<EnemyArchetypeConfig> = Object.freeze({
  archetype: "interceptor",
  maximumIntegrity: 1_800,
  radius: 17_000,
  verticalSpeed: 1_300,
  horizontalSpeed: 900,
  fireIntervalTicks: 120,
  projectileKind: "kinetic",
  projectileRawDamage: 400,
  destructionScore: 250,
  escapeDefenceDamage: 500,
  escapeSignalDamage: 200,
});

const DISRUPTOR_CONFIG: Readonly<EnemyArchetypeConfig> = Object.freeze({
  archetype: "disruptor",
  maximumIntegrity: 2_600,
  radius: 20_000,
  verticalSpeed: 900,
  horizontalSpeed: 0,
  fireIntervalTicks: 180,
  projectileKind: "corruption",
  projectileRawDamage: 650,
  destructionScore: 400,
  escapeDefenceDamage: 0,
  escapeSignalDamage: 700,
});

export const ENEMY_ARCHETYPE_CONFIGS: Readonly<
  Record<EnemyArchetype, Readonly<EnemyArchetypeConfig>>
> = Object.freeze({
  scout: SCOUT_CONFIG,
  interceptor: INTERCEPTOR_CONFIG,
  disruptor: DISRUPTOR_CONFIG,
});

export interface ArchetypeSelectionResult {
  readonly archetype: EnemyArchetype;
  readonly roll: number;
  readonly nextRngState: number;
}

export interface SpawnXSelectionResult {
  readonly positionX: number;
  readonly roll: number;
  readonly nextRngState: number;
}

export interface CreateEnemySpawnOptions {
  readonly waveNumber: EncounterWaveNumber;
  readonly enemyId: number;
  readonly rngState: number;
}

export interface EnemySpawnResult {
  readonly enemy: EnemyState;
  readonly archetypeRoll: number;
  readonly spawnXRoll: number;
  readonly nextRngState: number;
}

export function getEnemyArchetypeConfig(archetype: EnemyArchetype): Readonly<EnemyArchetypeConfig> {
  return ENEMY_ARCHETYPE_CONFIGS[archetype];
}

export function selectEnemyArchetypeFromRoll(
  waveNumber: EncounterWaveNumber,
  roll: number,
): EnemyArchetype {
  assertEncounterWaveNumber(waveNumber);

  if (!Number.isSafeInteger(roll) || roll < 0 || roll > 99) {
    throw new RangeError("Archetype roll must be an integer from 0 to 99.");
  }

  if (waveNumber === 1) {
    return "scout";
  }

  if (waveNumber === 2) {
    return roll <= 74 ? "scout" : "interceptor";
  }

  if (waveNumber === 3) {
    if (roll <= 54) {
      return "scout";
    }

    return roll <= 84 ? "interceptor" : "disruptor";
  }

  if (waveNumber === 4) {
    if (roll <= 39) {
      return "scout";
    }

    return roll <= 74 ? "interceptor" : "disruptor";
  }

  if (roll <= 29) {
    return "scout";
  }

  return roll <= 64 ? "interceptor" : "disruptor";
}

export function selectEnemyArchetype(
  waveNumber: EncounterWaveNumber,
  rngState: number,
): ArchetypeSelectionResult {
  const result = nextInt(rngState, 100);

  return {
    archetype: selectEnemyArchetypeFromRoll(waveNumber, result.value),
    roll: result.value,
    nextRngState: result.nextState,
  };
}

export function selectEnemySpawnX(rngState: number): SpawnXSelectionResult {
  const result = nextInt(rngState, ENGINE_CONSTANTS.ENEMY_SPAWN_X_ROLL_MAX_EXCLUSIVE);

  return {
    positionX: ENGINE_CONSTANTS.ENEMY_SPAWN_MIN_X + result.value,
    roll: result.value,
    nextRngState: result.nextState,
  };
}

export function createEnemyState(
  enemyId: number,
  archetype: EnemyArchetype,
  positionX: number,
): EnemyState {
  assertPositiveSafeInteger(enemyId, "Enemy ID");

  if (
    !Number.isSafeInteger(positionX) ||
    positionX < ENGINE_CONSTANTS.ENEMY_SPAWN_MIN_X ||
    positionX > ENGINE_CONSTANTS.ENEMY_SPAWN_MAX_X
  ) {
    throw new RangeError(
      `Enemy spawn X must be an integer from ${ENGINE_CONSTANTS.ENEMY_SPAWN_MIN_X} to ${ENGINE_CONSTANTS.ENEMY_SPAWN_MAX_X}.`,
    );
  }

  const config = getEnemyArchetypeConfig(archetype);

  const velocityX =
    archetype === "interceptor"
      ? enemyId % 2 === 1
        ? config.horizontalSpeed
        : -config.horizontalSpeed
      : 0;

  return {
    id: enemyId,
    archetype,
    positionX,
    positionY: ENGINE_CONSTANTS.ENEMY_SPAWN_Y,
    velocityX,
    velocityY: config.verticalSpeed,
    radius: config.radius,
    integrity: config.maximumIntegrity,
    maximumIntegrity: config.maximumIntegrity,
    fireCooldownTicks: config.fireIntervalTicks,
    fireIntervalTicks: config.fireIntervalTicks,
    destructionScore: config.destructionScore,
    escapeDefenceDamage: config.escapeDefenceDamage,
    escapeSignalDamage: config.escapeSignalDamage,
  };
}

export function createEnemySpawn(options: Readonly<CreateEnemySpawnOptions>): EnemySpawnResult {
  assertEncounterWaveNumber(options.waveNumber);
  assertPositiveSafeInteger(options.enemyId, "Enemy ID");

  const archetypeSelection = selectEnemyArchetype(options.waveNumber, options.rngState);

  const spawnXSelection = selectEnemySpawnX(archetypeSelection.nextRngState);

  return {
    enemy: createEnemyState(
      options.enemyId,
      archetypeSelection.archetype,
      spawnXSelection.positionX,
    ),
    archetypeRoll: archetypeSelection.roll,
    spawnXRoll: spawnXSelection.roll,
    nextRngState: spawnXSelection.nextRngState,
  };
}

export function decrementEnemyFireCooldown(enemy: Readonly<EnemyState>): EnemyState {
  return {
    ...enemy,
    fireCooldownTicks: enemy.fireCooldownTicks > 0 ? enemy.fireCooldownTicks - 1 : 0,
  };
}

export function decrementEnemyFireCooldowns(
  enemies: readonly Readonly<EnemyState>[],
): EnemyState[] {
  return enemies.map(decrementEnemyFireCooldown);
}

export function canEnemyFire(enemy: Readonly<EnemyState>): boolean {
  const config = getEnemyArchetypeConfig(enemy.archetype);

  return config.projectileKind !== null && enemy.fireCooldownTicks === 0;
}

export function integrateEnemyMovement(enemy: Readonly<EnemyState>): EnemyState {
  const nextPositionY = enemy.positionY + enemy.velocityY;

  if (enemy.archetype !== "interceptor") {
    return {
      ...enemy,
      positionX: enemy.positionX + enemy.velocityX,
      positionY: nextPositionY,
    };
  }

  const proposedPositionX = enemy.positionX + enemy.velocityX;

  if (proposedPositionX < ENGINE_CONSTANTS.ENEMY_SPAWN_MIN_X) {
    return {
      ...enemy,
      positionX: ENGINE_CONSTANTS.ENEMY_SPAWN_MIN_X,
      positionY: nextPositionY,
      velocityX: Math.abs(enemy.velocityX),
    };
  }

  if (proposedPositionX > ENGINE_CONSTANTS.ENEMY_SPAWN_MAX_X) {
    return {
      ...enemy,
      positionX: ENGINE_CONSTANTS.ENEMY_SPAWN_MAX_X,
      positionY: nextPositionY,
      velocityX: -Math.abs(enemy.velocityX),
    };
  }

  return {
    ...enemy,
    positionX: proposedPositionX,
    positionY: nextPositionY,
  };
}

export function createEnemyProjectileState(
  projectileId: number,
  enemy: Readonly<EnemyState>,
): EnemyProjectileState {
  assertPositiveSafeInteger(projectileId, "Enemy projectile ID");

  const config = getEnemyArchetypeConfig(enemy.archetype);

  if (
    config.projectileKind === null ||
    config.projectileRawDamage <= 0 ||
    config.fireIntervalTicks <= 0
  ) {
    throw new RangeError(`Enemy archetype "${enemy.archetype}" cannot create a projectile.`);
  }

  return {
    id: projectileId,
    ownerEnemyId: enemy.id,
    kind: config.projectileKind,
    positionX: enemy.positionX,
    positionY: enemy.positionY + enemy.radius + ENGINE_CONSTANTS.ENEMY_PROJECTILE_RADIUS,
    velocityX: 0,
    velocityY: ENGINE_CONSTANTS.ENEMY_PROJECTILE_SPEED_PER_TICK,
    radius: ENGINE_CONSTANTS.ENEMY_PROJECTILE_RADIUS,
    rawDamage: config.projectileRawDamage,
    remainingTicks: ENGINE_CONSTANTS.ENEMY_PROJECTILE_LIFETIME_TICKS,
  };
}

export function integrateEnemyProjectile(
  projectile: Readonly<EnemyProjectileState>,
): EnemyProjectileIntegrationResult {
  const movedProjectile: EnemyProjectileState = {
    ...projectile,
    positionX: projectile.positionX + projectile.velocityX,
    positionY: projectile.positionY + projectile.velocityY,
    remainingTicks: projectile.remainingTicks - 1,
  };

  if (movedProjectile.remainingTicks <= 0) {
    return {
      projectile: movedProjectile,
      expiryReason: "lifetime",
    };
  }

  if (enemyProjectileIsOutsideWorld(movedProjectile)) {
    return {
      projectile: movedProjectile,
      expiryReason: "world_boundary",
    };
  }

  return {
    projectile: movedProjectile,
    expiryReason: null,
  };
}

export function enemyProjectileIsOutsideWorld(projectile: Readonly<EnemyProjectileState>): boolean {
  return (
    projectile.positionX + projectile.radius < ENGINE_CONSTANTS.WORLD_MIN ||
    projectile.positionX - projectile.radius > ENGINE_CONSTANTS.WORLD_MAX ||
    projectile.positionY + projectile.radius < ENGINE_CONSTANTS.WORLD_MIN ||
    projectile.positionY - projectile.radius > ENGINE_CONSTANTS.WORLD_MAX
  );
}

function assertEncounterWaveNumber(waveNumber: number): asserts waveNumber is EncounterWaveNumber {
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

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
}
