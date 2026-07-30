import type { PowerChannel } from "./actions";

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
