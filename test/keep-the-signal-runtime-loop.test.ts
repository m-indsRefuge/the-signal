import { describe, expect, it, vi } from "vitest";

import {
  FIXED_STEP_LOOP_CONFIG,
  createFixedStepLoop,
} from "../app/features/keep-the-signal/runtime";

describe("Keep the Signal KTS-I3 fixed-step runtime loop", () => {
  it("uses the accepted 60 Hz fixed-step configuration", () => {
    expect(FIXED_STEP_LOOP_CONFIG).toEqual({
      ticksPerSecond: 60,
      tickDurationMs: 1000 / 60,
      maxTicksPerAdvance: 8,
      backlogPauseTicks: 120,
    });
    expect(Object.isFrozen(FIXED_STEP_LOOP_CONFIG)).toBe(true);
  });

  it("rejects a non-function tick handler", () => {
    expect(() => createFixedStepLoop(null as never)).toThrow("onTick must be a function");
  });

  it("establishes a timing baseline without advancing a tick", () => {
    const onTick = vi.fn();
    const loop = createFixedStepLoop(onTick);

    const result = loop.advance(100);

    expect(result.ticksProcessed).toBe(0);
    expect(result.totalTicksProcessed).toBe(0);
    expect(onTick).not.toHaveBeenCalled();
  });

  it("does not advance before one complete fixed interval", () => {
    const onTick = vi.fn();
    const loop = createFixedStepLoop(onTick);

    loop.advance(0);
    const result = loop.advance(FIXED_STEP_LOOP_CONFIG.tickDurationMs - 0.01);

    expect(result.ticksProcessed).toBe(0);
    expect(result.interpolationAlpha).toBeGreaterThan(0);
    expect(result.interpolationAlpha).toBeLessThan(1);
  });

  it("advances exactly one tick at one complete interval", () => {
    const calls: number[] = [];
    const loop = createFixedStepLoop((tickNumber) => calls.push(tickNumber));

    loop.advance(0);
    const result = loop.advance(FIXED_STEP_LOOP_CONFIG.tickDurationMs);

    expect(result.ticksProcessed).toBe(1);
    expect(result.totalTicksProcessed).toBe(1);
    expect(calls).toEqual([1]);
    expect(result.accumulatorMs).toBeCloseTo(0, 8);
  });

  it("processes multiple accumulated ticks in order", () => {
    const calls: number[] = [];
    const loop = createFixedStepLoop((tickNumber) => calls.push(tickNumber));

    loop.advance(10);
    const result = loop.advance(10 + FIXED_STEP_LOOP_CONFIG.tickDurationMs * 3.5);

    expect(result.ticksProcessed).toBe(3);
    expect(calls).toEqual([1, 2, 3]);
    expect(result.interpolationAlpha).toBeCloseTo(0.5, 8);
  });

  it("caps one callback at eight authoritative ticks", () => {
    const onTick = vi.fn();
    const loop = createFixedStepLoop(onTick);

    loop.advance(0);
    const result = loop.advance(FIXED_STEP_LOOP_CONFIG.tickDurationMs * 20);

    expect(result.ticksProcessed).toBe(8);
    expect(onTick).toHaveBeenCalledTimes(8);
    expect(result.pendingTicks).toBe(12);
    expect(result.interpolationAlpha).toBe(1);
  });

  it("retains unprocessed accumulator time after the callback cap", () => {
    const onTick = vi.fn();
    const loop = createFixedStepLoop(onTick);

    loop.advance(0);
    const first = loop.advance(FIXED_STEP_LOOP_CONFIG.tickDurationMs * 10);
    const second = loop.advance(FIXED_STEP_LOOP_CONFIG.tickDurationMs * 10);

    expect(first.ticksProcessed).toBe(8);
    expect(first.pendingTicks).toBe(2);
    expect(second.ticksProcessed).toBe(2);
    expect(second.pendingTicks).toBe(0);
    expect(onTick).toHaveBeenCalledTimes(10);
  });

  it("pauses before processing when backlog reaches 120 ticks", () => {
    const onTick = vi.fn();
    const loop = createFixedStepLoop(onTick);

    loop.advance(0);
    const result = loop.advance(
      FIXED_STEP_LOOP_CONFIG.tickDurationMs * FIXED_STEP_LOOP_CONFIG.backlogPauseTicks,
    );

    expect(result.timingInterrupted).toBe(true);
    expect(result.paused).toBe(true);
    expect(result.pauseReason).toBe("backlog");
    expect(result.ticksProcessed).toBe(0);
    expect(result.pendingTicks).toBe(120);
    expect(onTick).not.toHaveBeenCalled();
  });

  it("explicitly discards interrupted backlog when resumed", () => {
    const loop = createFixedStepLoop(() => undefined);

    loop.advance(0);
    loop.advance(FIXED_STEP_LOOP_CONFIG.tickDurationMs * 120);
    const result = loop.resume(5_000);

    expect(result.discardedAccumulatorMs).toBeCloseTo(
      FIXED_STEP_LOOP_CONFIG.tickDurationMs * 120,
      8,
    );
    expect(result.paused).toBe(false);
    expect(result.pendingTicks).toBe(0);
    expect(loop.advance(5_000).ticksProcessed).toBe(0);
  });

  it("does not advance while manually paused", () => {
    const onTick = vi.fn();
    const loop = createFixedStepLoop(onTick);

    loop.advance(0);
    loop.pause();
    const result = loop.advance(1_000);

    expect(result.ticksProcessed).toBe(0);
    expect(result.pauseReason).toBe("manual");
    expect(onTick).not.toHaveBeenCalled();
  });

  it("requires an explicit resume after the document returns from hidden", () => {
    const onTick = vi.fn();
    const loop = createFixedStepLoop(onTick);

    loop.advance(0);
    loop.setHidden(true);
    expect(loop.advance(10_000).ticksProcessed).toBe(0);

    const visible = loop.setHidden(false, 10_000);
    expect(visible.paused).toBe(true);
    expect(visible.pauseReason).toBe("hidden");

    loop.resume(10_000);
    expect(loop.advance(10_000 + FIXED_STEP_LOOP_CONFIG.tickDurationMs).ticksProcessed).toBe(1);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("preserves a manual pause across visibility changes", () => {
    const loop = createFixedStepLoop(() => undefined);

    loop.pause("manual");
    loop.setHidden(true);
    const visible = loop.setHidden(false);

    expect(visible.paused).toBe(true);
    expect(visible.pauseReason).toBe("manual");
  });

  it("rejects invalid or backwards timestamps", () => {
    const loop = createFixedStepLoop(() => undefined);

    expect(() => loop.advance(Number.NaN)).toThrow("finite non-negative");
    expect(() => loop.advance(-1)).toThrow("finite non-negative");

    loop.advance(100);
    expect(() => loop.advance(99)).toThrow("must not move backwards");
  });

  it("resets timing without resetting the authoritative tick count", () => {
    const loop = createFixedStepLoop(() => undefined);

    loop.advance(0);
    loop.advance(FIXED_STEP_LOOP_CONFIG.tickDurationMs * 2);
    const reset = loop.resetTiming(1_000);

    expect(reset.totalTicksProcessed).toBe(2);
    expect(reset.accumulatorMs).toBe(0);
    expect(loop.advance(1_000 + FIXED_STEP_LOOP_CONFIG.tickDurationMs).totalTicksProcessed).toBe(3);
  });

  it("disposes cleanly and becomes a no-op", () => {
    const onTick = vi.fn();
    const loop = createFixedStepLoop(onTick);

    loop.advance(0);
    const disposed = loop.dispose();
    const afterDispose = loop.advance(100_000);

    expect(disposed.disposed).toBe(true);
    expect(disposed.paused).toBe(true);
    expect(afterDispose.ticksProcessed).toBe(0);
    expect(afterDispose.disposed).toBe(true);
    expect(onTick).not.toHaveBeenCalled();
  });
});
