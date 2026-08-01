import type {
  ActionRejectionReason,
  EncounterPhase,
  EnemyArchetype,
  EnemyProjectileKind,
  EngineEvent,
  GameStatus,
  PowerChannel,
  TerminalReason,
} from "../engine";

export const KTS_OBSERVATION_SCHEMA_ID = "kts.observation" as const;
export const KTS_OBSERVATION_SCHEMA_VERSION = 1 as const;
export const KTS_OBSERVATION_ADAPTER_ID = "keep-the-signal" as const;
export const KTS_OBSERVATION_ADAPTER_VERSION = "KTS-I4-C" as const;

export type KtsObservationLevel = 0 | 1;

export const KTS_OBSERVATION_LEVELS: readonly KtsObservationLevel[] = Object.freeze([0, 1]);

export interface KtsObservationBudget {
  readonly maximumPlayerProjectiles: number;
  readonly maximumEnemies: number;
  readonly maximumEnemyProjectiles: number;
  readonly maximumRecentEvents: number;
  readonly maximumEventAgeTicks: number;
  readonly maximumSerializedCharacters: number;
}

export const DEFAULT_KTS_OBSERVATION_BUDGET: Readonly<KtsObservationBudget> = Object.freeze({
  maximumPlayerProjectiles: 24,
  maximumEnemies: 24,
  maximumEnemyProjectiles: 48,
  maximumRecentEvents: 48,
  maximumEventAgeTicks: 600,
  maximumSerializedCharacters: 96_000,
});

export interface KtsObservationSourceMetadata {
  readonly sourceLabel?: string;
  readonly sessionId?: string;
  readonly episodeId?: string;
  readonly previousObservationId?: string;
  readonly eventWindowStartTick?: number;
}

export interface KtsObservationRequest {
  readonly observationId: string;
  readonly requestedLevel: KtsObservationLevel;
  readonly budget: Readonly<KtsObservationBudget>;
  readonly source?: Readonly<KtsObservationSourceMetadata>;
}

export interface KtsObservationMetadata {
  readonly observationId: string;
  readonly observationSchemaId: typeof KTS_OBSERVATION_SCHEMA_ID;
  readonly observationSchemaVersion: typeof KTS_OBSERVATION_SCHEMA_VERSION;
  readonly adapterId: typeof KTS_OBSERVATION_ADAPTER_ID;
  readonly adapterVersion: typeof KTS_OBSERVATION_ADAPTER_VERSION;
  readonly requestedLevel: KtsObservationLevel;
  readonly sourceStateDigest: string;
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly seed: number;
  readonly tick: number;
  readonly sourceLabel?: string;
  readonly sessionId?: string;
  readonly episodeId?: string;
  readonly previousObservationId?: string;
}

export interface KtsLifecycleObservation {
  readonly status: GameStatus;
  readonly terminalReason: TerminalReason;
  readonly encounterPhase: EncounterPhase;
  readonly encounterComplete: boolean;
  readonly tick: number;
}

export interface KtsPlayerObservation {
  readonly positionX: number;
  readonly positionY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly radius: number;
  readonly moving: boolean;
  readonly horizontalDirection: -1 | 0 | 1;
  readonly verticalDirection: -1 | 0 | 1;
}

export interface KtsPowerObservation {
  readonly weapons: number;
  readonly defence: number;
  readonly signal: number;
  readonly shiftCooldownTicks: number;
}

export interface KtsDefenceObservation {
  readonly integrity: number;
  readonly ticksSinceDamage: number;
  readonly integrityBasisPoints: number;
}

export interface KtsSignalObservation {
  readonly integrity: number;
  readonly ticksSinceDamage: number;
  readonly collapseTicks: number;
  readonly integrityBasisPoints: number;
}

export interface KtsInterferenceObservation {
  readonly load: number;
  readonly loadBasisPoints: number;
}

export interface KtsResourceObservation {
  readonly power: KtsPowerObservation;
  readonly defence: KtsDefenceObservation;
  readonly signal: KtsSignalObservation;
  readonly interference: KtsInterferenceObservation;
}

export interface KtsCooldownObservation {
  readonly fireCooldownTicks: number;
  readonly powerShiftCooldownTicks: number;
  readonly recoveryPulseCooldownTicks: number;
}

export interface KtsEncounterObservation {
  readonly phase: EncounterPhase;
  readonly waveNumber: 1 | 2 | 3 | 4 | 5;
  readonly phaseTicks: number;
  readonly spawnCooldownTicks: number;
  readonly enemiesScheduled: number;
  readonly enemiesSpawned: number;
  readonly enemiesDefeated: number;
  readonly enemiesEscaped: number;
  readonly totalEnemiesDefeated: number;
  readonly totalEnemiesEscaped: number;
}

export interface KtsPlayerProjectileObservation {
  readonly id: number;
  readonly positionX: number;
  readonly positionY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly radius: number;
  readonly remainingTicks: number;
}

export interface KtsEnemyObservation {
  readonly id: number;
  readonly archetype: EnemyArchetype;
  readonly positionX: number;
  readonly positionY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly radius: number;
  readonly integrity: number;
  readonly maximumIntegrity: number;
  readonly integrityBasisPoints: number;
  readonly fireCooldownTicks: number;
  readonly fireIntervalTicks: number;
  readonly fireReady: boolean;
  readonly squaredDistanceFromPlayer: number;
}

export interface KtsEnemyProjectileObservation {
  readonly id: number;
  readonly ownerEnemyId: number;
  readonly kind: EnemyProjectileKind;
  readonly positionX: number;
  readonly positionY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly radius: number;
  readonly rawDamage: number;
  readonly remainingTicks: number;
  readonly squaredDistanceFromPlayer: number;
}

export interface KtsCollectionProjectionMetadata {
  readonly sourceCount: number;
  readonly includedCount: number;
  readonly omittedCount: number;
  readonly truncated: boolean;
  readonly selectionPolicy: string;
}

export interface KtsEntityProjectionMetadata {
  readonly playerProjectiles: KtsCollectionProjectionMetadata;
  readonly enemies: KtsCollectionProjectionMetadata;
  readonly enemyProjectiles: KtsCollectionProjectionMetadata;
}

export type KtsProjectedEventDetails = Readonly<Record<string, string | number | boolean | null>>;

export interface KtsProjectedEngineEvent {
  readonly type: EngineEvent["type"];
  readonly tick: number;
  readonly sequence: number;
  readonly sourceId?: string;
  readonly details: KtsProjectedEventDetails;
}

export interface KtsEventWindowMetadata {
  readonly sourceCount: number;
  readonly eligibleCount: number;
  readonly includedCount: number;
  readonly omittedByAge: number;
  readonly omittedByCount: number;
  readonly omittedCount: number;
  readonly truncated: boolean;
  readonly maximumRecentEvents: number;
  readonly maximumEventAgeTicks: number;
  readonly effectiveStartTick: number;
  readonly selectionPolicy: "newest_eligible_stable_chronological";
}

export interface KtsEventWindowObservation {
  readonly events: readonly KtsProjectedEngineEvent[];
  readonly metadata: KtsEventWindowMetadata;
}

export interface KtsMovementActionVocabulary {
  readonly moveX: readonly [-1, 0, 1];
  readonly moveY: readonly [-1, 0, 1];
}

export interface KtsPowerShiftVocabularyEntry {
  readonly from: PowerChannel;
  readonly to: PowerChannel;
}

export interface KtsActionVocabulary {
  readonly movement: KtsMovementActionVocabulary;
  readonly fire: "boolean";
  readonly recoveryPulse: "boolean";
  readonly powerShift: readonly KtsPowerShiftVocabularyEntry[];
}

export interface KtsPowerShiftReadiness {
  readonly from: PowerChannel;
  readonly to: PowerChannel;
  readonly ready: boolean;
  readonly blockingReason: "cooldown_active" | "power_floor" | "power_ceiling" | null;
}

export interface KtsActionReadiness {
  readonly fireReady: boolean;
  readonly recoveryPulseReady: boolean;
  readonly powerShiftReady: boolean;
  readonly powerShiftOptions: readonly KtsPowerShiftReadiness[];
}

export interface KtsActionConstraints {
  readonly fireCooldownTicks: number;
  readonly recoveryPulseCooldownTicks: number;
  readonly powerShiftCooldownTicks: number;
  readonly currentPlayerProjectileCount: number;
  readonly maximumPlayerProjectiles: number;
  readonly totalPower: number;
  readonly minimumChannelPower: number;
  readonly maximumChannelPower: number;
  readonly shiftIncrement: number;
  readonly channelAllocations: Readonly<Record<PowerChannel, number>>;
}

export interface KtsActionSpaceObservation {
  readonly vocabulary: KtsActionVocabulary;
  readonly readiness: KtsActionReadiness;
  readonly constraints: KtsActionConstraints;
}

export interface KtsProjectionBudgetObservation {
  readonly requested: KtsObservationBudget;
  readonly entities: KtsEntityProjectionMetadata;
  readonly events: KtsEventWindowMetadata;
}

export interface KtsLevelOneSummary {
  readonly enemyCountsByArchetype: Readonly<Record<EnemyArchetype, number>>;
  readonly enemyProjectileCountsByKind: Readonly<Record<EnemyProjectileKind, number>>;
  readonly playerProjectileCount: number;
  readonly currentWaveResolvedCount: number;
  readonly currentWaveRemainingCount: number;
  readonly encounterTotalResolvedCount: number;
  readonly waveProgressBasisPoints: number;
  readonly fireReady: boolean;
  readonly powerShiftReady: boolean;
  readonly recoveryPulseReady: boolean;
  readonly nearestEnemy: {
    readonly id: number;
    readonly squaredDistance: number;
  } | null;
  readonly nearestEnemyProjectile: {
    readonly id: number;
    readonly squaredDistance: number;
  } | null;
  readonly activeEntityCounts: {
    readonly source: {
      readonly playerProjectiles: number;
      readonly enemies: number;
      readonly enemyProjectiles: number;
    };
    readonly included: {
      readonly playerProjectiles: number;
      readonly enemies: number;
      readonly enemyProjectiles: number;
    };
  };
  readonly recentEventCountsByType: Readonly<Record<string, number>>;
}

export interface KtsObservationPacketBase {
  readonly metadata: KtsObservationMetadata;
  readonly lifecycle: KtsLifecycleObservation;
  readonly player: KtsPlayerObservation;
  readonly resources: KtsResourceObservation;
  readonly cooldowns: KtsCooldownObservation;
  readonly encounter: KtsEncounterObservation;
  readonly entities: {
    readonly playerProjectiles: readonly KtsPlayerProjectileObservation[];
    readonly enemies: readonly KtsEnemyObservation[];
    readonly enemyProjectiles: readonly KtsEnemyProjectileObservation[];
  };
  readonly recentEvents: readonly KtsProjectedEngineEvent[];
  readonly actionSpace: KtsActionSpaceObservation;
  readonly projection: KtsProjectionBudgetObservation;
}

export interface KtsLevelZeroObservation extends KtsObservationPacketBase {
  readonly level: 0;
}

export interface KtsLevelOneObservation extends KtsObservationPacketBase {
  readonly level: 1;
  readonly summary: KtsLevelOneSummary;
}

export type KtsObservationPacket = KtsLevelZeroObservation | KtsLevelOneObservation;

export const KTS_OBSERVATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function isKtsObservationId(value: unknown): value is string {
  return typeof value === "string" && KTS_OBSERVATION_ID_PATTERN.test(value);
}

export function isKtsObservationLevel(value: unknown): value is KtsObservationLevel {
  return value === 0 || value === 1;
}

export function validateKtsObservationBudget(
  value: unknown,
): value is Readonly<KtsObservationBudget> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonNegativeSafeInteger(value.maximumPlayerProjectiles) &&
    isNonNegativeSafeInteger(value.maximumEnemies) &&
    isNonNegativeSafeInteger(value.maximumEnemyProjectiles) &&
    isNonNegativeSafeInteger(value.maximumRecentEvents) &&
    isNonNegativeSafeInteger(value.maximumEventAgeTicks) &&
    isPositiveSafeInteger(value.maximumSerializedCharacters)
  );
}

export function canonicalSerializeKtsObservation(
  observation: Readonly<KtsObservationPacket>,
): string {
  return JSON.stringify(observation);
}

export function deepFreezeKtsValue<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreezeKtsValue(item);
    }

    return Object.freeze(value) as Readonly<T>;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    deepFreezeKtsValue(item);
  }

  return Object.freeze(value) as Readonly<T>;
}

export function isKtsJsonCompatible(value: unknown): boolean {
  return isJsonCompatibleValue(value, new Set<object>());
}

export function movementDirection(value: number): -1 | 0 | 1 {
  if (value < 0) {
    return -1;
  }

  if (value > 0) {
    return 1;
  }

  return 0;
}

export function toBasisPoints(value: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(10_000, Math.floor((value * 10_000) / maximum)));
}

export function isActionRejectionReason(value: unknown): value is ActionRejectionReason {
  return (
    value === "cooldown_active" ||
    value === "power_floor" ||
    value === "power_ceiling" ||
    value === "same_power_channel" ||
    value === "projectile_capacity" ||
    value === "invalid_environment_event" ||
    value === "duplicate_environment_event_id" ||
    value === "invalid_action"
  );
}

function isJsonCompatibleValue(value: unknown, seen: Set<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const valid = value.every((item) => isJsonCompatibleValue(item, seen));
    seen.delete(value);
    return valid;
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    seen.delete(value);
    return false;
  }

  const valid = Object.values(value as Record<string, unknown>).every((item) =>
    isJsonCompatibleValue(item, seen),
  );
  seen.delete(value);
  return valid;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
