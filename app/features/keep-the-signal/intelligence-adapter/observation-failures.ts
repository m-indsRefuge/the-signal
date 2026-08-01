import type { KtsObservationPacket } from "./observation-contract";

export const KTS_OBSERVATION_FAILURE_CODES = Object.freeze([
  "invalid_observation_request",
  "invalid_observation_id",
  "invalid_observation_level",
  "invalid_budget",
  "invalid_engine_state",
  "invalid_event_window",
  "future_event",
  "unknown_event_type",
  "projection_budget_exceeded",
  "observation_not_json",
  "adapter_internal_failure",
] as const);

export type KtsObservationFailureCode = (typeof KTS_OBSERVATION_FAILURE_CODES)[number];

export type KtsObservationFailureStage =
  | "request"
  | "state_validation"
  | "event_projection"
  | "state_projection"
  | "serialization"
  | "internal";

export interface KtsObservationFailure {
  readonly code: KtsObservationFailureCode;
  readonly stage: KtsObservationFailureStage;
  readonly message: string;
  readonly observationId?: string;
  readonly stateTick?: number;
  readonly diagnostics?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface KtsObservationSuccess {
  readonly ok: true;
  readonly observation: Readonly<KtsObservationPacket>;
}

export interface KtsObservationFailureResult {
  readonly ok: false;
  readonly failure: Readonly<KtsObservationFailure>;
}

export type KtsObservationProjectionResult = KtsObservationSuccess | KtsObservationFailureResult;

export class KtsObservationAdapterError extends Error {
  readonly code: KtsObservationFailureCode;
  readonly stage: KtsObservationFailureStage;
  readonly diagnostics: Readonly<Record<string, string | number | boolean | null>> | undefined;

  constructor(
    code: KtsObservationFailureCode,
    stage: KtsObservationFailureStage,
    message: string,
    diagnostics?: Readonly<Record<string, string | number | boolean | null>>,
  ) {
    super(message);
    this.name = "KtsObservationAdapterError";
    this.code = code;
    this.stage = stage;
    this.diagnostics = diagnostics;
  }
}

export function createKtsObservationFailure(
  code: KtsObservationFailureCode,
  stage: KtsObservationFailureStage,
  message: string,
  context: {
    readonly observationId?: string;
    readonly stateTick?: number;
    readonly diagnostics?: Readonly<Record<string, string | number | boolean | null>>;
  } = {},
): KtsObservationFailureResult {
  const diagnostics =
    context.diagnostics === undefined ? undefined : Object.freeze({ ...context.diagnostics });

  const failure: KtsObservationFailure = {
    code,
    stage,
    message,
    ...(context.observationId === undefined ? {} : { observationId: context.observationId }),
    ...(context.stateTick === undefined ? {} : { stateTick: context.stateTick }),
    ...(diagnostics === undefined ? {} : { diagnostics }),
  };

  return Object.freeze({
    ok: false,
    failure: Object.freeze(failure),
  });
}
