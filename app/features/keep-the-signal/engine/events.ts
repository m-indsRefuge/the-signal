import type { PowerChannel } from "./actions";
import type { EncounterWaveNumber } from "./encounters";
import type { EnemyArchetype, EnemyProjectileExpiryReason, EnemyProjectileKind } from "./enemies";

export interface EngineEventBase {
  readonly type: string;
  readonly tick: number;
}

export type RejectedAction =
  "movement" | "power_shift" | "fire" | "recovery_pulse" | "environment_event";

export type ActionRejectionReason =
  | "cooldown_active"
  | "power_floor"
  | "power_ceiling"
  | "same_power_channel"
  | "projectile_capacity"
  | "invalid_environment_event"
  | "duplicate_environment_event_id"
  | "invalid_action";

export interface PowerShiftAppliedEvent extends EngineEventBase {
  readonly type: "power_shift_applied";
  readonly from: PowerChannel;
  readonly to: PowerChannel;
  readonly amount: number;
}

export interface ActionRejectedEvent extends EngineEventBase {
  readonly type: "action_rejected";
  readonly action: RejectedAction;
  readonly reason: ActionRejectionReason;
  readonly sourceId?: string;
}

export interface ProjectileFiredEvent extends EngineEventBase {
  readonly type: "projectile_fired";
  readonly projectileId: number;
}

export interface ProjectileExpiredEvent extends EngineEventBase {
  readonly type: "projectile_expired";
  readonly projectileId: number;
  readonly reason: "lifetime" | "world_boundary";
}

export interface EnemySpawnedEvent extends EngineEventBase {
  readonly type: "enemy_spawned";
  readonly enemyId: number;
  readonly archetype: EnemyArchetype;
  readonly waveNumber: EncounterWaveNumber;
  readonly positionX: number;
  readonly positionY: number;
  readonly archetypeRoll: number;
  readonly spawnXRoll: number;
}

export interface EnemyFiredEvent extends EngineEventBase {
  readonly type: "enemy_fired";
  readonly enemyId: number;
  readonly projectileId: number;
  readonly projectileKind: EnemyProjectileKind;
  readonly positionX: number;
  readonly positionY: number;
  readonly rawDamage: number;
}

export interface EnemyFireRejectedEvent extends EngineEventBase {
  readonly type: "enemy_fire_rejected";
  readonly enemyId: number;
  readonly reason: "projectile_capacity";
}

export interface EnemyProjectileExpiredEvent extends EngineEventBase {
  readonly type: "enemy_projectile_expired";
  readonly projectileId: number;
  readonly ownerEnemyId: number;
  readonly reason: EnemyProjectileExpiryReason;
}

export interface PlayerProjectileHitEnemyEvent extends EngineEventBase {
  readonly type: "player_projectile_hit_enemy";
  readonly projectileId: number;
  readonly enemyId: number;
  readonly rawDamage: number;
  readonly effectiveDamage: number;
}

export interface EnemyDamagedEvent extends EngineEventBase {
  readonly type: "enemy_damaged";
  readonly enemyId: number;
  readonly projectileId: number;
  readonly previousIntegrity: number;
  readonly nextIntegrity: number;
  readonly rawDamage: number;
  readonly effectiveDamage: number;
}

export interface EnemyDestroyedEvent extends EngineEventBase {
  readonly type: "enemy_destroyed";
  readonly enemyId: number;
  readonly archetype: EnemyArchetype;
  readonly projectileId: number;
}

export interface EnemyScoreAwardedEvent extends EngineEventBase {
  readonly type: "enemy_score_awarded";
  readonly enemyId: number;
  readonly amount: number;
  readonly scoreAfter: number;
}

export interface EnemyProjectileHitPlayerEvent extends EngineEventBase {
  readonly type: "enemy_projectile_hit_player";
  readonly projectileId: number;
  readonly ownerEnemyId: number;
  readonly projectileKind: EnemyProjectileKind;
  readonly target: "defence" | "signal";
  readonly rawDamage: number;
}

export interface EnemyEscapedEvent extends EngineEventBase {
  readonly type: "enemy_escaped";
  readonly enemyId: number;
  readonly archetype: EnemyArchetype;
  readonly positionY: number;
  readonly defenceRawDamage: number;
  readonly signalRawDamage: number;
}

export interface WaveStartedEvent extends EngineEventBase {
  readonly type: "wave_started";
  readonly waveNumber: EncounterWaveNumber;
  readonly enemiesScheduled: number;
}

export interface WaveCompletedEvent extends EngineEventBase {
  readonly type: "wave_completed";
  readonly waveNumber: EncounterWaveNumber;
  readonly enemiesDefeated: number;
  readonly enemiesEscaped: number;
  readonly totalEnemiesDefeated: number;
  readonly totalEnemiesEscaped: number;
}

export interface EncounterCompletedEvent extends EngineEventBase {
  readonly type: "encounter_completed";
  readonly totalEnemiesDefeated: number;
  readonly totalEnemiesEscaped: number;
}

export interface RecoveryPulseAppliedEvent extends EngineEventBase {
  readonly type: "recovery_pulse_applied";
  readonly signalRestored: number;
  readonly defenceRestored: number;
}

export interface DefenceDamagedEvent extends EngineEventBase {
  readonly type: "defence_damaged";
  readonly sourceId: string;
  readonly rawDamage: number;
  readonly effectiveDamage: number;
}

export interface DefenceRecoveredEvent extends EngineEventBase {
  readonly type: "defence_recovered";
  readonly amount: number;
}

export interface SignalDamagedEvent extends EngineEventBase {
  readonly type: "signal_damaged";
  readonly sourceId: string;
  readonly source: "corruption" | "interference";
  readonly rawDamage: number;
  readonly effectiveDamage: number;
}

export interface SignalRecoveredEvent extends EngineEventBase {
  readonly type: "signal_recovered";
  readonly amount: number;
}

export interface InterferenceLoadChangedEvent extends EngineEventBase {
  readonly type: "interference_load_changed";
  readonly sourceId: string;
  readonly previousLoad: number;
  readonly nextLoad: number;
}

export interface SignalCollapseStartedEvent extends EngineEventBase {
  readonly type: "signal_collapse_started";
}

export interface SignalCollapseAvertedEvent extends EngineEventBase {
  readonly type: "signal_collapse_averted";
}

export interface GameTerminatedEvent extends EngineEventBase {
  readonly type: "game_terminated";
  readonly reason: "signal_collapse";
}

export interface ScoreAddedEvent extends EngineEventBase {
  readonly type: "score_added";
  readonly amount: number;
  readonly integrityTier: number;
  readonly coherenceMultiplier: number;
}

export type EngineEvent =
  | PowerShiftAppliedEvent
  | ActionRejectedEvent
  | ProjectileFiredEvent
  | ProjectileExpiredEvent
  | EnemySpawnedEvent
  | EnemyFiredEvent
  | EnemyFireRejectedEvent
  | EnemyProjectileExpiredEvent
  | PlayerProjectileHitEnemyEvent
  | EnemyDamagedEvent
  | EnemyDestroyedEvent
  | EnemyScoreAwardedEvent
  | EnemyProjectileHitPlayerEvent
  | EnemyEscapedEvent
  | WaveStartedEvent
  | WaveCompletedEvent
  | EncounterCompletedEvent
  | RecoveryPulseAppliedEvent
  | DefenceDamagedEvent
  | DefenceRecoveredEvent
  | SignalDamagedEvent
  | SignalRecoveredEvent
  | InterferenceLoadChangedEvent
  | SignalCollapseStartedEvent
  | SignalCollapseAvertedEvent
  | GameTerminatedEvent
  | ScoreAddedEvent;
