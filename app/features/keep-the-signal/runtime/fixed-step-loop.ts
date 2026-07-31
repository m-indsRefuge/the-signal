export const FIXED_STEP_LOOP_CONFIG = Object.freeze({
  ticksPerSecond: 60,
  tickDurationMs: 1000 / 60,
  maxTicksPerAdvance: 8,
  backlogPauseTicks: 120,
});

const TIMING_EPSILON_MS = 1e-9;

export type FixedStepPauseReason = "manual" | "hidden" | "backlog" | null;

export interface FixedStepLoopSnapshot {
  readonly accumulatorMs: number;
  readonly interpolationAlpha: number;
  readonly pendingTicks: number;
  readonly totalTicksProcessed: number;
  readonly paused: boolean;
  readonly pauseReason: FixedStepPauseReason;
  readonly disposed: boolean;
}

export interface FixedStepAdvanceResult extends FixedStepLoopSnapshot {
  readonly ticksProcessed: number;
  readonly timingInterrupted: boolean;
}

export interface FixedStepResumeResult extends FixedStepLoopSnapshot {
  readonly discardedAccumulatorMs: number;
}

export type FixedStepTickHandler = (tickNumber: number) => unknown;

export interface FixedStepLoop {
  advance(timestampMs: number): FixedStepAdvanceResult;
  pause(reason?: Exclude<FixedStepPauseReason, null>): FixedStepLoopSnapshot;
  resume(timestampMs?: number): FixedStepResumeResult;
  setHidden(hidden: boolean, timestampMs?: number): FixedStepLoopSnapshot;
  resetTiming(timestampMs?: number): FixedStepLoopSnapshot;
  dispose(): FixedStepLoopSnapshot;
  snapshot(): FixedStepLoopSnapshot;
}

export function createFixedStepLoop(onTick: FixedStepTickHandler): FixedStepLoop {
  if (typeof onTick !== "function") {
    throw new TypeError("onTick must be a function.");
  }

  let accumulatorMs = 0;
  let lastTimestampMs: number | null = null;
  let totalTicksProcessed = 0;
  let paused = false;
  let pauseReason: FixedStepPauseReason = null;
  let disposed = false;

  const pendingTickCount = (): number =>
    Math.floor((accumulatorMs + TIMING_EPSILON_MS) / FIXED_STEP_LOOP_CONFIG.tickDurationMs);

  const interpolationAlpha = (): number =>
    Math.min(1, Math.max(0, accumulatorMs / FIXED_STEP_LOOP_CONFIG.tickDurationMs));

  const snapshot = (): FixedStepLoopSnapshot =>
    Object.freeze({
      accumulatorMs,
      interpolationAlpha: interpolationAlpha(),
      pendingTicks: pendingTickCount(),
      totalTicksProcessed,
      paused,
      pauseReason,
      disposed,
    });

  const advance = (timestampMs: number): FixedStepAdvanceResult => {
    assertTimestamp(timestampMs);

    if (disposed || paused) {
      return Object.freeze({
        ...snapshot(),
        ticksProcessed: 0,
        timingInterrupted: false,
      });
    }

    if (lastTimestampMs === null) {
      lastTimestampMs = timestampMs;

      return Object.freeze({
        ...snapshot(),
        ticksProcessed: 0,
        timingInterrupted: false,
      });
    }

    if (timestampMs < lastTimestampMs) {
      throw new RangeError("timestampMs must not move backwards.");
    }

    accumulatorMs += timestampMs - lastTimestampMs;
    lastTimestampMs = timestampMs;

    if (pendingTickCount() >= FIXED_STEP_LOOP_CONFIG.backlogPauseTicks) {
      paused = true;
      pauseReason = "backlog";
      lastTimestampMs = null;

      return Object.freeze({
        ...snapshot(),
        ticksProcessed: 0,
        timingInterrupted: true,
      });
    }

    const ticksToProcess = Math.min(pendingTickCount(), FIXED_STEP_LOOP_CONFIG.maxTicksPerAdvance);

    let ticksProcessed = 0;

    for (let index = 0; index < ticksToProcess; index += 1) {
      const shouldContinue = onTick(totalTicksProcessed + 1) !== false;
      totalTicksProcessed += 1;
      ticksProcessed += 1;
      accumulatorMs = Math.max(0, accumulatorMs - FIXED_STEP_LOOP_CONFIG.tickDurationMs);

      if (!shouldContinue) {
        break;
      }
    }

    return Object.freeze({
      ...snapshot(),
      ticksProcessed,
      timingInterrupted: false,
    });
  };

  const pause = (reason: Exclude<FixedStepPauseReason, null> = "manual"): FixedStepLoopSnapshot => {
    if (disposed) {
      return snapshot();
    }

    paused = true;
    pauseReason = reason;
    lastTimestampMs = null;

    return snapshot();
  };

  const resume = (timestampMs?: number): FixedStepResumeResult => {
    if (timestampMs !== undefined) {
      assertTimestamp(timestampMs);
    }

    if (disposed) {
      return Object.freeze({
        ...snapshot(),
        discardedAccumulatorMs: 0,
      });
    }

    const discardedAccumulatorMs = pauseReason === "backlog" ? accumulatorMs : 0;

    if (pauseReason === "backlog") {
      accumulatorMs = 0;
    }

    paused = false;
    pauseReason = null;
    lastTimestampMs = timestampMs ?? null;

    return Object.freeze({
      ...snapshot(),
      discardedAccumulatorMs,
    });
  };

  const setHidden = (hidden: boolean, timestampMs?: number): FixedStepLoopSnapshot => {
    if (timestampMs !== undefined) {
      assertTimestamp(timestampMs);
    }

    if (!hidden || disposed || paused) {
      return snapshot();
    }

    return pause("hidden");
  };

  const resetTiming = (timestampMs?: number): FixedStepLoopSnapshot => {
    if (timestampMs !== undefined) {
      assertTimestamp(timestampMs);
    }

    if (disposed) {
      return snapshot();
    }

    accumulatorMs = 0;
    lastTimestampMs = timestampMs ?? null;

    return snapshot();
  };

  const dispose = (): FixedStepLoopSnapshot => {
    disposed = true;
    paused = true;
    pauseReason = null;
    accumulatorMs = 0;
    lastTimestampMs = null;

    return snapshot();
  };

  return Object.freeze({
    advance,
    pause,
    resume,
    setHidden,
    resetTiming,
    dispose,
    snapshot,
  });
}

function assertTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new RangeError("timestampMs must be a finite non-negative number.");
  }
}
