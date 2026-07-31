export type MovementAxis = -1 | 0 | 1;

export type PowerChannel = "weapons" | "defence" | "signal";

export interface PowerShiftAction {
  readonly from: PowerChannel;
  readonly to: PowerChannel;
}

export interface PlayerInputFrame {
  readonly moveX: MovementAxis;
  readonly moveY: MovementAxis;
  readonly fire: boolean;
  readonly recoveryPulse: boolean;
  readonly powerShift?: PowerShiftAction;
}

interface EnvironmentEventBase {
  readonly id: string;
  readonly sequence: number;
}

export interface SetInterferenceLoadEvent extends EnvironmentEventBase {
  readonly type: "set_interference_load";
  readonly load: number;
}

export interface ImpactEvent extends EnvironmentEventBase {
  readonly type: "impact";
  readonly rawDamage: number;
}

export interface SignalCorruptionEvent extends EnvironmentEventBase {
  readonly type: "signal_corruption";
  readonly rawDamage: number;
}

export type EnvironmentEvent = SetInterferenceLoadEvent | ImpactEvent | SignalCorruptionEvent;

export interface TickFrame {
  readonly player: PlayerInputFrame;
  readonly environmentEvents: readonly EnvironmentEvent[];
}

export const NEUTRAL_PLAYER_INPUT: Readonly<PlayerInputFrame> = Object.freeze({
  moveX: 0,
  moveY: 0,
  fire: false,
  recoveryPulse: false,
});

const EMPTY_ENVIRONMENT_EVENTS: readonly EnvironmentEvent[] = Object.freeze([]);

export const NEUTRAL_TICK_FRAME: Readonly<TickFrame> = Object.freeze({
  player: NEUTRAL_PLAYER_INPUT,
  environmentEvents: EMPTY_ENVIRONMENT_EVENTS,
});
