import {
  createInitialGameState,
  createStateDigest,
  serializeCanonicalState,
  stepGame,
  validateGameState,
  type EnvironmentEvent,
  type GameState,
  type TickFrame,
} from "../engine";

export type KtsSessionOutcome = "completed" | "terminal";

export interface KtsSessionRecord {
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly seed: number;
  readonly frames: readonly Readonly<TickFrame>[];
  readonly finalCanonicalState: string | null;
  readonly finalDigest: string | null;
  readonly outcome: KtsSessionOutcome | null;
}

export type ReplayVerificationFailureReason =
  | "record_not_finalized"
  | "engine_version_mismatch"
  | "ruleset_version_mismatch"
  | "seed_mismatch"
  | "outcome_mismatch"
  | "canonical_state_mismatch"
  | "digest_mismatch";

export interface ReplayVerificationSuccess {
  readonly ok: true;
  readonly processedTicks: number;
  readonly outcome: KtsSessionOutcome;
  readonly canonicalState: string;
  readonly digest: string;
  readonly state: Readonly<GameState>;
}

export interface ReplayVerificationFailure {
  readonly ok: false;
  readonly reason: ReplayVerificationFailureReason;
  readonly processedTicks: number;
  readonly expected: string | number | null;
  readonly actual: string | number | null;
  readonly state: Readonly<GameState> | null;
}

export type ReplayVerificationResult = ReplayVerificationSuccess | ReplayVerificationFailure;

export class KtsSessionRecorder {
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly seed: number;

  private readonly frames: Readonly<TickFrame>[] = [];
  private finalizedRecord: KtsSessionRecord | null = null;

  constructor(initialState: Readonly<GameState>) {
    validateGameState(initialState);

    if (initialState.tick !== 0) {
      throw new Error("A session recorder must begin from authoritative tick 0.");
    }

    this.engineVersion = initialState.engineVersion;
    this.rulesetVersion = initialState.rulesetVersion;
    this.seed = initialState.seed;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  get finalized(): boolean {
    return this.finalizedRecord !== null;
  }

  recordAcceptedFrame(frame: Readonly<TickFrame>): number {
    if (this.finalizedRecord !== null) {
      throw new Error("A finalized session record cannot accept more tick frames.");
    }

    this.frames.push(freezeTickFrame(frame));
    return this.frames.length;
  }

  snapshot(): KtsSessionRecord {
    if (this.finalizedRecord !== null) {
      return this.finalizedRecord;
    }

    return freezeSessionRecord({
      engineVersion: this.engineVersion,
      rulesetVersion: this.rulesetVersion,
      seed: this.seed,
      frames: this.frames,
      finalCanonicalState: null,
      finalDigest: null,
      outcome: null,
    });
  }

  finalize(finalState: Readonly<GameState>): KtsSessionRecord {
    if (this.finalizedRecord !== null) {
      throw new Error("The session record has already been finalized.");
    }

    validateGameState(finalState);
    assertMatchingSessionState(this, finalState);

    if (finalState.tick !== this.frames.length) {
      throw new Error(
        "Final authoritative tick must equal the number of recorded accepted tick frames.",
      );
    }

    const outcome = deriveSessionOutcome(finalState);

    if (outcome === null) {
      throw new Error("A session may be finalized only after encounter completion or termination.");
    }

    this.finalizedRecord = freezeSessionRecord({
      engineVersion: this.engineVersion,
      rulesetVersion: this.rulesetVersion,
      seed: this.seed,
      frames: this.frames,
      finalCanonicalState: serializeCanonicalState(finalState),
      finalDigest: createStateDigest(finalState),
      outcome,
    });

    return this.finalizedRecord;
  }
}

export function deriveSessionOutcome(state: Readonly<GameState>): KtsSessionOutcome | null {
  if (state.status === "terminal") {
    return "terminal";
  }

  if (state.encounter.phase === "complete") {
    return "completed";
  }

  return null;
}

export function replaySessionRecord(record: Readonly<KtsSessionRecord>): ReplayVerificationResult {
  if (
    record.finalCanonicalState === null ||
    record.finalDigest === null ||
    record.outcome === null
  ) {
    return replayFailure("record_not_finalized", 0, "finalized record", null, null);
  }

  let state = createInitialGameState({ seed: record.seed });

  if (state.engineVersion !== record.engineVersion) {
    return replayFailure(
      "engine_version_mismatch",
      0,
      record.engineVersion,
      state.engineVersion,
      state,
    );
  }

  if (state.rulesetVersion !== record.rulesetVersion) {
    return replayFailure(
      "ruleset_version_mismatch",
      0,
      record.rulesetVersion,
      state.rulesetVersion,
      state,
    );
  }

  if (state.seed !== record.seed) {
    return replayFailure("seed_mismatch", 0, record.seed, state.seed, state);
  }

  let processedTicks = 0;

  for (const frame of record.frames) {
    state = stepGame(state, frame).state;
    processedTicks += 1;
  }

  const outcome = deriveSessionOutcome(state);

  if (outcome !== record.outcome) {
    return replayFailure("outcome_mismatch", processedTicks, record.outcome, outcome, state);
  }

  const canonicalState = serializeCanonicalState(state);

  if (canonicalState !== record.finalCanonicalState) {
    return replayFailure(
      "canonical_state_mismatch",
      processedTicks,
      record.finalCanonicalState,
      canonicalState,
      state,
    );
  }

  const digest = createStateDigest(state);

  if (digest !== record.finalDigest) {
    return replayFailure("digest_mismatch", processedTicks, record.finalDigest, digest, state);
  }

  return Object.freeze({
    ok: true,
    processedTicks,
    outcome,
    canonicalState,
    digest,
    state,
  });
}

export function freezeTickFrame(frame: Readonly<TickFrame>): Readonly<TickFrame> {
  if (typeof frame !== "object" || frame === null) {
    throw new TypeError("Tick frame must be an object.");
  }

  if (typeof frame.player !== "object" || frame.player === null) {
    throw new TypeError("Tick frame player input must be an object.");
  }

  if (!Array.isArray(frame.environmentEvents)) {
    throw new TypeError("Tick frame environment events must be an array.");
  }

  const player = frame.player.powerShift
    ? Object.freeze({
        moveX: frame.player.moveX,
        moveY: frame.player.moveY,
        fire: frame.player.fire,
        recoveryPulse: frame.player.recoveryPulse,
        powerShift: Object.freeze({
          from: frame.player.powerShift.from,
          to: frame.player.powerShift.to,
        }),
      })
    : Object.freeze({
        moveX: frame.player.moveX,
        moveY: frame.player.moveY,
        fire: frame.player.fire,
        recoveryPulse: frame.player.recoveryPulse,
      });

  const environmentEvents = Object.freeze(
    frame.environmentEvents.map((event) => freezeEnvironmentEvent(event)),
  );

  return Object.freeze({
    player,
    environmentEvents,
  });
}

function freezeEnvironmentEvent(event: Readonly<EnvironmentEvent>): Readonly<EnvironmentEvent> {
  if (typeof event !== "object" || event === null) {
    throw new TypeError("Environment event must be an object.");
  }

  return Object.freeze({ ...event }) as Readonly<EnvironmentEvent>;
}

function freezeSessionRecord(record: KtsSessionRecord): KtsSessionRecord {
  return Object.freeze({
    engineVersion: record.engineVersion,
    rulesetVersion: record.rulesetVersion,
    seed: record.seed,
    frames: Object.freeze([...record.frames]),
    finalCanonicalState: record.finalCanonicalState,
    finalDigest: record.finalDigest,
    outcome: record.outcome,
  });
}

function assertMatchingSessionState(
  recorder: Pick<KtsSessionRecorder, "engineVersion" | "rulesetVersion" | "seed">,
  state: Readonly<GameState>,
): void {
  if (state.engineVersion !== recorder.engineVersion) {
    throw new Error("Final state engine version does not match the session record.");
  }

  if (state.rulesetVersion !== recorder.rulesetVersion) {
    throw new Error("Final state ruleset version does not match the session record.");
  }

  if (state.seed !== recorder.seed) {
    throw new Error("Final state seed does not match the session record.");
  }
}

function replayFailure(
  reason: ReplayVerificationFailureReason,
  processedTicks: number,
  expected: string | number | null,
  actual: string | number | null,
  state: Readonly<GameState> | null,
): ReplayVerificationFailure {
  return Object.freeze({
    ok: false,
    reason,
    processedTicks,
    expected,
    actual,
    state,
  });
}
