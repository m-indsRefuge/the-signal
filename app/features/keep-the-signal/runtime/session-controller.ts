import {
  createInitialGameState,
  createStateDigest,
  serializeCanonicalState,
  stepGame,
  type EngineEvent,
  type GameState,
  type PowerShiftAction,
  type StepResult,
} from "../engine";
import {
  createFixedStepLoop,
  type FixedStepLoop,
  type FixedStepLoopSnapshot,
  type FixedStepPauseReason,
} from "./fixed-step-loop";
import {
  createInputController,
  type HeldInputControl,
  type InputControllerSnapshot,
  type KeyboardInputLike,
  type KeyboardInputResult,
  type KtsInputController,
} from "./input-controller";
import {
  KtsSessionRecorder,
  deriveSessionOutcome,
  type KtsSessionRecord,
  type ReplayVerificationFailure,
  type ReplayVerificationFailureReason,
  type ReplayVerificationResult,
  type ReplayVerificationSuccess,
} from "./session-record";

export const KTS_RUNTIME_RECENT_EVENT_LIMIT = 12;

export type KtsRuntimeLifecycle =
  "idle" | "playing" | "paused" | "completed" | "terminal" | "replaying";

export type KtsActiveRuntimeLifecycle = "playing" | "replaying";

export interface KtsRuntimeSnapshot {
  readonly lifecycle: KtsRuntimeLifecycle;
  readonly seed: number;
  readonly previousState: Readonly<GameState>;
  readonly currentState: Readonly<GameState>;
  readonly loop: FixedStepLoopSnapshot;
  readonly input: InputControllerSnapshot;
  readonly recentEvents: readonly Readonly<EngineEvent>[];
  readonly lastTickEvents: readonly Readonly<EngineEvent>[];
  readonly sessionFrameCount: number;
  readonly sessionRecord: KtsSessionRecord | null;
  readonly replayVerification: ReplayVerificationResult | null;
  readonly replayFrameIndex: number;
  readonly replayFrameCount: number;
  readonly timingInterrupted: boolean;
  readonly resumeLifecycle: KtsActiveRuntimeLifecycle | null;
  readonly disposed: boolean;
}

export type KtsRuntimeSubscriber = (snapshot: KtsRuntimeSnapshot) => void;
export type KtsRuntimeStep = (
  previousState: Readonly<GameState>,
  frame: Parameters<typeof stepGame>[1],
) => StepResult;

export interface CreateKtsSessionControllerOptions {
  readonly seed: number;
  readonly recentEventLimit?: number;
  readonly step?: KtsRuntimeStep;
}

export interface KtsSessionController {
  start(timestampMs?: number): KtsRuntimeSnapshot;
  advance(timestampMs: number): KtsRuntimeSnapshot;
  pause(reason?: Exclude<FixedStepPauseReason, null>): KtsRuntimeSnapshot;
  resume(timestampMs?: number): KtsRuntimeSnapshot;
  togglePause(timestampMs?: number): KtsRuntimeSnapshot;
  setHidden(hidden: boolean, timestampMs?: number): KtsRuntimeSnapshot;
  handleBlur(): KtsRuntimeSnapshot;
  handleKeyDown(event: KeyboardInputLike, timestampMs?: number): KeyboardInputResult;
  handleKeyUp(event: KeyboardInputLike): KeyboardInputResult;
  pressHeld(control: HeldInputControl, sourceId: string): boolean;
  releaseHeld(control: HeldInputControl, sourceId: string): boolean;
  releaseSource(sourceId: string): boolean;
  queueRecoveryPulse(): boolean;
  queuePowerShift(powerShift: Readonly<PowerShiftAction>): boolean;
  restartSameSeed(timestampMs?: number): KtsRuntimeSnapshot;
  restartWithSeed(seed: number, timestampMs?: number): KtsRuntimeSnapshot;
  startReplay(timestampMs?: number): KtsRuntimeSnapshot;
  exitReplay(): KtsRuntimeSnapshot;
  subscribe(subscriber: KtsRuntimeSubscriber): () => void;
  dispose(): KtsRuntimeSnapshot;
  snapshot(): KtsRuntimeSnapshot;
}

const IGNORED_KEYBOARD_RESULT: KeyboardInputResult = Object.freeze({
  handled: false,
  preventDefault: false,
  queued: false,
  command: null,
});

export function createKtsSessionController(
  options: CreateKtsSessionControllerOptions,
): KtsSessionController {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("Session controller options must be an object.");
  }

  const recentEventLimit = options.recentEventLimit ?? KTS_RUNTIME_RECENT_EVENT_LIMIT;

  if (
    !Number.isSafeInteger(recentEventLimit) ||
    recentEventLimit < 1 ||
    recentEventLimit > KTS_RUNTIME_RECENT_EVENT_LIMIT
  ) {
    throw new RangeError(
      `recentEventLimit must be a safe integer between 1 and ${KTS_RUNTIME_RECENT_EVENT_LIMIT}.`,
    );
  }

  const engineStep = options.step ?? stepGame;

  if (typeof engineStep !== "function") {
    throw new TypeError("step must be a function.");
  }

  const input: KtsInputController = createInputController();
  const subscribers = new Set<KtsRuntimeSubscriber>();

  let currentState = createInitialGameState({ seed: options.seed });
  let previousState: Readonly<GameState> = currentState;
  let recorder = new KtsSessionRecorder(currentState);
  let finalizedRecord: KtsSessionRecord | null = null;
  let finalLiveState: Readonly<GameState> | null = null;
  let lifecycle: KtsRuntimeLifecycle = "idle";
  let resumeLifecycle: KtsActiveRuntimeLifecycle | null = null;
  let recentEvents: readonly Readonly<EngineEvent>[] = Object.freeze([]);
  let lastTickEvents: readonly Readonly<EngineEvent>[] = Object.freeze([]);
  let replayVerification: ReplayVerificationResult | null = null;
  let replayFrameIndex = 0;
  let timingInterrupted = false;
  let disposed = false;
  const processLiveTick = (): boolean => {
    const frame = input.sampleTickFrame();
    recorder.recordAcceptedFrame(frame);

    previousState = currentState;
    const result = engineStep(currentState, frame);
    currentState = result.state;
    acceptEvents(result.events);

    const outcome = deriveSessionOutcome(currentState);

    if (outcome === null) {
      return true;
    }

    finalizedRecord = recorder.finalize(currentState);
    finalLiveState = currentState;
    lifecycle = outcome;
    resumeLifecycle = null;
    loop.pause("manual");
    return false;
  };

  const processReplayTick = (): boolean => {
    if (finalizedRecord === null) {
      replayVerification = replayFailure(
        "record_not_finalized",
        replayFrameIndex,
        "finalized record",
        null,
        currentState,
      );
      lifecycle = "paused";
      resumeLifecycle = null;
      loop.pause("manual");
      return false;
    }

    const frame = finalizedRecord.frames[replayFrameIndex];

    if (frame === undefined) {
      finalizeReplay();
      return false;
    }

    previousState = currentState;
    const result = engineStep(currentState, frame);
    currentState = result.state;
    replayFrameIndex += 1;
    acceptEvents(result.events);

    if (replayFrameIndex >= finalizedRecord.frames.length) {
      finalizeReplay();
      return false;
    }

    return true;
  };

  const processTick = (): boolean => {
    if (lifecycle === "playing") {
      return processLiveTick();
    }

    if (lifecycle === "replaying") {
      return processReplayTick();
    }

    return false;
  };

  const loop: FixedStepLoop = createFixedStepLoop(processTick);

  const snapshot = (): KtsRuntimeSnapshot =>
    Object.freeze({
      lifecycle,
      seed: currentState.seed,
      previousState,
      currentState,
      loop: loop.snapshot(),
      input: input.snapshot(),
      recentEvents,
      lastTickEvents,
      sessionFrameCount: recorder.frameCount,
      sessionRecord: finalizedRecord,
      replayVerification,
      replayFrameIndex,
      replayFrameCount: finalizedRecord?.frames.length ?? 0,
      timingInterrupted,
      resumeLifecycle,
      disposed,
    });

  const notify = (): KtsRuntimeSnapshot => {
    const nextSnapshot = snapshot();

    for (const subscriber of subscribers) {
      subscriber(nextSnapshot);
    }

    return nextSnapshot;
  };

  const start = (timestampMs?: number): KtsRuntimeSnapshot => {
    assertNotDisposed();
    assertOptionalTimestamp(timestampMs);

    if (lifecycle !== "idle") {
      throw new Error("A session may start only from the idle lifecycle.");
    }

    loop.resetTiming(timestampMs);
    input.clearAllInputs();
    timingInterrupted = false;
    lifecycle = "playing";
    resumeLifecycle = null;
    return notify();
  };

  const advance = (timestampMs: number): KtsRuntimeSnapshot => {
    assertNotDisposed();

    if (lifecycle !== "playing" && lifecycle !== "replaying") {
      return snapshot();
    }

    const activeLifecycle = lifecycle;
    const result = loop.advance(timestampMs);

    if (result.timingInterrupted) {
      lifecycle = "paused";
      resumeLifecycle = activeLifecycle;
      timingInterrupted = true;
      input.clearAllInputs();
    }

    return notify();
  };

  const pause = (reason: Exclude<FixedStepPauseReason, null> = "manual"): KtsRuntimeSnapshot => {
    assertNotDisposed();

    if (lifecycle !== "playing" && lifecycle !== "replaying") {
      return snapshot();
    }

    resumeLifecycle = lifecycle;
    lifecycle = "paused";
    input.clearAllInputs();
    loop.pause(reason);
    return notify();
  };

  const resume = (timestampMs?: number): KtsRuntimeSnapshot => {
    assertNotDisposed();
    assertOptionalTimestamp(timestampMs);

    if (lifecycle !== "paused" || resumeLifecycle === null) {
      throw new Error("Only a paused active session may resume.");
    }

    const nextLifecycle = resumeLifecycle;
    input.clearAllInputs();
    loop.resume(timestampMs);
    lifecycle = nextLifecycle;
    resumeLifecycle = null;
    timingInterrupted = false;
    return notify();
  };

  const togglePause = (timestampMs?: number): KtsRuntimeSnapshot => {
    if (lifecycle === "playing" || lifecycle === "replaying") {
      return pause("manual");
    }

    if (lifecycle === "paused" && resumeLifecycle !== null) {
      return resume(timestampMs);
    }

    return snapshot();
  };

  const setHidden = (hidden: boolean, timestampMs?: number): KtsRuntimeSnapshot => {
    assertNotDisposed();
    assertOptionalTimestamp(timestampMs);

    if (!hidden) {
      loop.setHidden(false, timestampMs);
      return snapshot();
    }

    input.clearAllInputs();

    if (lifecycle !== "playing" && lifecycle !== "replaying") {
      return notify();
    }

    resumeLifecycle = lifecycle;
    lifecycle = "paused";
    loop.setHidden(true, timestampMs);
    return notify();
  };

  const handleBlur = (): KtsRuntimeSnapshot => {
    assertNotDisposed();
    input.clearAllInputs();
    return notify();
  };

  const handleKeyDown = (event: KeyboardInputLike, timestampMs?: number): KeyboardInputResult => {
    assertNotDisposed();

    const pauseKey = event.code === "Escape" || event.code === "KeyP";
    const pauseAvailable =
      lifecycle === "playing" ||
      lifecycle === "replaying" ||
      (lifecycle === "paused" && resumeLifecycle !== null);

    if (lifecycle !== "playing" && (!pauseKey || !pauseAvailable)) {
      return IGNORED_KEYBOARD_RESULT;
    }

    if (lifecycle === "replaying" && !pauseKey) {
      return IGNORED_KEYBOARD_RESULT;
    }

    const result = input.handleKeyDown(event);

    if (result.command === "toggle_pause") {
      togglePause(timestampMs);
    } else if (result.handled) {
      notify();
    }

    return result;
  };

  const handleKeyUp = (event: KeyboardInputLike): KeyboardInputResult => {
    assertNotDisposed();

    if (lifecycle !== "playing") {
      return IGNORED_KEYBOARD_RESULT;
    }

    const result = input.handleKeyUp(event);

    if (result.handled) {
      notify();
    }

    return result;
  };

  const pressHeld = (control: HeldInputControl, sourceId: string): boolean => {
    assertNotDisposed();

    if (lifecycle !== "playing") {
      return false;
    }

    input.pressHeld(control, sourceId);
    notify();
    return true;
  };

  const releaseHeld = (control: HeldInputControl, sourceId: string): boolean => {
    assertNotDisposed();

    if (lifecycle !== "playing") {
      return false;
    }

    input.releaseHeld(control, sourceId);
    notify();
    return true;
  };

  const releaseSource = (sourceId: string): boolean => {
    assertNotDisposed();

    if (lifecycle !== "playing") {
      return false;
    }

    input.releaseSource(sourceId);
    notify();
    return true;
  };

  const queueRecoveryPulse = (): boolean => {
    assertNotDisposed();

    if (lifecycle !== "playing") {
      return false;
    }

    const queued = input.queueRecoveryPulse();

    if (queued) {
      notify();
    }

    return queued;
  };

  const queuePowerShift = (powerShift: Readonly<PowerShiftAction>): boolean => {
    assertNotDisposed();

    if (lifecycle !== "playing") {
      return false;
    }

    const queued = input.queuePowerShift(powerShift);

    if (queued) {
      notify();
    }

    return queued;
  };

  const restartSameSeed = (timestampMs?: number): KtsRuntimeSnapshot =>
    restartWithSeed(currentState.seed, timestampMs);

  const restartWithSeed = (seed: number, timestampMs?: number): KtsRuntimeSnapshot => {
    assertNotDisposed();
    assertOptionalTimestamp(timestampMs);

    currentState = createInitialGameState({ seed });
    previousState = currentState;
    recorder = new KtsSessionRecorder(currentState);
    finalizedRecord = null;
    finalLiveState = null;
    lifecycle = "playing";
    resumeLifecycle = null;
    recentEvents = Object.freeze([]);
    lastTickEvents = Object.freeze([]);
    replayVerification = null;
    replayFrameIndex = 0;
    timingInterrupted = false;
    input.clearAllInputs();
    loop.resume(timestampMs);
    loop.resetTiming(timestampMs);
    return notify();
  };

  const startReplay = (timestampMs?: number): KtsRuntimeSnapshot => {
    assertNotDisposed();
    assertOptionalTimestamp(timestampMs);

    if (finalizedRecord === null || finalLiveState === null) {
      throw new Error("A finalized live session is required before replay can begin.");
    }

    currentState = createInitialGameState({ seed: finalizedRecord.seed });
    previousState = currentState;
    lifecycle = "replaying";
    resumeLifecycle = null;
    recentEvents = Object.freeze([]);
    lastTickEvents = Object.freeze([]);
    replayVerification = null;
    replayFrameIndex = 0;
    timingInterrupted = false;
    input.clearAllInputs();
    loop.resume(timestampMs);
    loop.resetTiming(timestampMs);

    const metadataFailure = verifyReplayMetadata(finalizedRecord, currentState);

    if (metadataFailure !== null) {
      replayVerification = metadataFailure;
      lifecycle = "paused";
      loop.pause("manual");
    }

    return notify();
  };

  const exitReplay = (): KtsRuntimeSnapshot => {
    assertNotDisposed();

    const replayIsActive =
      lifecycle === "replaying" ||
      (lifecycle === "paused" &&
        (resumeLifecycle === "replaying" || replayVerification !== null)) ||
      replayVerification?.ok === true;

    if (!replayIsActive || finalizedRecord === null || finalLiveState === null) {
      throw new Error("Replay is not active.");
    }

    currentState = finalLiveState;
    previousState = finalLiveState;
    lifecycle = finalizedRecord.outcome ?? "completed";
    resumeLifecycle = null;
    replayVerification = null;
    replayFrameIndex = 0;
    timingInterrupted = false;
    input.clearAllInputs();
    loop.pause("manual");
    return notify();
  };

  const subscribe = (subscriber: KtsRuntimeSubscriber): (() => void) => {
    assertNotDisposed();

    if (typeof subscriber !== "function") {
      throw new TypeError("subscriber must be a function.");
    }

    subscribers.add(subscriber);
    let subscribed = true;

    return (): void => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      subscribers.delete(subscriber);
    };
  };

  const dispose = (): KtsRuntimeSnapshot => {
    if (disposed) {
      return snapshot();
    }

    input.clearAllInputs();
    loop.dispose();
    disposed = true;
    subscribers.clear();
    return snapshot();
  };

  function acceptEvents(events: readonly Readonly<EngineEvent>[]): void {
    lastTickEvents = Object.freeze(events.map(freezeEngineEvent));

    const meaningful = lastTickEvents.filter((event) => event.type !== "score_added");

    if (meaningful.length === 0) {
      return;
    }

    recentEvents = Object.freeze([...recentEvents, ...meaningful].slice(-recentEventLimit));
  }

  function finalizeReplay(): void {
    if (finalizedRecord === null) {
      replayVerification = replayFailure(
        "record_not_finalized",
        replayFrameIndex,
        "finalized record",
        null,
        currentState,
      );
      lifecycle = "paused";
      resumeLifecycle = null;
      loop.pause("manual");
      return;
    }

    replayVerification = verifyReplayFinalState(finalizedRecord, currentState, replayFrameIndex);

    if (!replayVerification.ok) {
      lifecycle = "paused";
      resumeLifecycle = null;
      loop.pause("manual");
      return;
    }

    lifecycle = replayVerification.outcome;
    resumeLifecycle = null;
    loop.pause("manual");
  }

  function assertNotDisposed(): void {
    if (disposed) {
      throw new Error("The session controller has been disposed.");
    }
  }

  function assertOptionalTimestamp(timestampMs?: number): void {
    if (timestampMs !== undefined && (!Number.isFinite(timestampMs) || timestampMs < 0)) {
      throw new RangeError("timestampMs must be a finite non-negative number.");
    }
  }

  return Object.freeze({
    start,
    advance,
    pause,
    resume,
    togglePause,
    setHidden,
    handleBlur,
    handleKeyDown,
    handleKeyUp,
    pressHeld,
    releaseHeld,
    releaseSource,
    queueRecoveryPulse,
    queuePowerShift,
    restartSameSeed,
    restartWithSeed,
    startReplay,
    exitReplay,
    subscribe,
    dispose,
    snapshot,
  });
}

function freezeEngineEvent(event: Readonly<EngineEvent>): Readonly<EngineEvent> {
  return Object.freeze({ ...event }) as Readonly<EngineEvent>;
}

function verifyReplayMetadata(
  record: Readonly<KtsSessionRecord>,
  state: Readonly<GameState>,
): ReplayVerificationFailure | null {
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

  return null;
}

function verifyReplayFinalState(
  record: Readonly<KtsSessionRecord>,
  state: Readonly<GameState>,
  processedTicks: number,
): ReplayVerificationResult {
  if (
    record.finalCanonicalState === null ||
    record.finalDigest === null ||
    record.outcome === null
  ) {
    return replayFailure("record_not_finalized", processedTicks, "finalized record", null, state);
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
  }) satisfies ReplayVerificationSuccess;
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
