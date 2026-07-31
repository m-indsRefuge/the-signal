import { describe, expect, it, vi } from "vitest";

import {
  ENGINE_CONSTANTS,
  createStateDigest,
  serializeCanonicalState,
  stepGame,
  type EngineEvent,
  type GameState,
  type StepResult,
} from "../app/features/keep-the-signal/engine";
import {
  FIXED_STEP_LOOP_CONFIG,
  KTS_RUNTIME_RECENT_EVENT_LIMIT,
  createKtsSessionController,
} from "../app/features/keep-the-signal/runtime";

const TICK_MS = FIXED_STEP_LOOP_CONFIG.tickDurationMs;

describe("Keep the Signal KTS-I3 browser session controller", () => {
  it("begins idle with an explicit normalized seed and no recorded frames", () => {
    const controller = createKtsSessionController({ seed: 0 });
    const snapshot = controller.snapshot();

    expect(snapshot.lifecycle).toBe("idle");
    expect(snapshot.seed).toBe(snapshot.currentState.seed);
    expect(snapshot.currentState.tick).toBe(0);
    expect(snapshot.sessionFrameCount).toBe(0);
    expect(snapshot.sessionRecord).toBeNull();
  });

  it("uses the accepted recent-event bound by default", () => {
    expect(KTS_RUNTIME_RECENT_EVENT_LIMIT).toBe(12);
  });

  it.each([0, -1, 1.5, 13, Number.NaN])(
    "rejects an invalid recent-event limit: %s",
    (recentEventLimit: number) => {
      expect(() => createKtsSessionController({ seed: 1, recentEventLimit })).toThrow(
        "between 1 and 12",
      );
    },
  );

  it("returns frozen browser-session snapshots", () => {
    const controller = createKtsSessionController({ seed: 1 });
    const snapshot = controller.snapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.recentEvents)).toBe(true);
    expect(Object.isFrozen(snapshot.lastTickEvents)).toBe(true);
  });

  it("starts only from idle", () => {
    const controller = createKtsSessionController({ seed: 1 });

    expect(controller.start(0).lifecycle).toBe("playing");
    expect(() => controller.start(0)).toThrow("only from the idle lifecycle");
  });

  it("advances one authoritative state and records one frame per fixed tick", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    const snapshot = controller.advance(TICK_MS);

    expect(snapshot.currentState.tick).toBe(1);
    expect(snapshot.previousState.tick).toBe(0);
    expect(snapshot.sessionFrameCount).toBe(1);
  });

  it("respects the eight-tick per-callback cap", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    const snapshot = controller.advance(TICK_MS * 20);

    expect(snapshot.currentState.tick).toBe(8);
    expect(snapshot.sessionFrameCount).toBe(8);
    expect(snapshot.loop.pendingTicks).toBe(12);
  });

  it("publishes one snapshot after a controller advance", () => {
    const controller = createKtsSessionController({ seed: 1 });
    const subscriber = vi.fn();
    const unsubscribe = controller.subscribe(subscriber);

    controller.start(0);
    subscriber.mockClear();
    controller.advance(TICK_MS);

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber.mock.calls[0]?.[0].currentState.tick).toBe(1);

    unsubscribe();
    controller.advance(TICK_MS * 2);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-function subscriber", () => {
    const controller = createKtsSessionController({ seed: 1 });

    expect(() => controller.subscribe(null as never)).toThrow("subscriber must be a function");
  });

  it("pauses manually, clears input, and prevents authoritative advancement", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    controller.pressHeld("left", "pointer:left");
    controller.queueRecoveryPulse();
    const paused = controller.pause();

    expect(paused.lifecycle).toBe("paused");
    expect(paused.resumeLifecycle).toBe("playing");
    expect(paused.loop.pauseReason).toBe("manual");
    expect(paused.input.left).toBe(false);
    expect(paused.input.recoveryPulseQueued).toBe(false);
    expect(controller.advance(10_000).currentState.tick).toBe(0);
  });

  it("resumes a manually paused live session explicitly", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    controller.pause();
    const resumed = controller.resume(1_000);

    expect(resumed.lifecycle).toBe("playing");
    expect(resumed.resumeLifecycle).toBeNull();
    expect(controller.advance(1_000 + TICK_MS).currentState.tick).toBe(1);
  });

  it("rejects resume outside a paused active lifecycle", () => {
    const controller = createKtsSessionController({ seed: 1 });

    expect(() => controller.resume()).toThrow("Only a paused active session");
  });

  it("automatically pauses when hidden and never auto-resumes when visible", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    const hidden = controller.setHidden(true);
    const visible = controller.setHidden(false, 5_000);

    expect(hidden.lifecycle).toBe("paused");
    expect(hidden.loop.pauseReason).toBe("hidden");
    expect(hidden.resumeLifecycle).toBe("playing");
    expect(visible.lifecycle).toBe("paused");
    expect(controller.advance(10_000).currentState.tick).toBe(0);
  });

  it("clears held and queued input on blur without forcing a visible session pause", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    controller.pressHeld("fire", "pointer:fire");
    controller.queuePowerShift({ from: "defence", to: "weapons" });
    const snapshot = controller.handleBlur();

    expect(snapshot.lifecycle).toBe("playing");
    expect(snapshot.input.fire).toBe(false);
    expect(snapshot.input.queuedPowerShifts).toHaveLength(0);
  });

  it("turns a 120-tick backlog into an explicit timing-interruption pause", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    const snapshot = controller.advance(TICK_MS * FIXED_STEP_LOOP_CONFIG.backlogPauseTicks);

    expect(snapshot.lifecycle).toBe("paused");
    expect(snapshot.resumeLifecycle).toBe("playing");
    expect(snapshot.loop.pauseReason).toBe("backlog");
    expect(snapshot.timingInterrupted).toBe(true);
    expect(snapshot.currentState.tick).toBe(0);
  });

  it("clears the timing-interruption notice only after explicit resume", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    controller.advance(TICK_MS * 120);
    const resumed = controller.resume(5_000);

    expect(resumed.lifecycle).toBe("playing");
    expect(resumed.timingInterrupted).toBe(false);
    expect(resumed.loop.pendingTicks).toBe(0);
  });

  it("toggles pause through the accepted Escape command", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    const first = controller.handleKeyDown({ code: "Escape" });
    const paused = controller.snapshot();
    const second = controller.handleKeyDown({ code: "Escape" }, 1_000);

    expect(first.command).toBe("toggle_pause");
    expect(paused.lifecycle).toBe("paused");
    expect(second.command).toBe("toggle_pause");
    expect(controller.snapshot().lifecycle).toBe("playing");
  });

  it("ignores pause keys while no active session can pause or resume", () => {
    const controller = createKtsSessionController({ seed: 1 });

    expect(controller.handleKeyDown({ code: "Escape" }).handled).toBe(false);
    expect(controller.snapshot().lifecycle).toBe("idle");
  });

  it("records held and one-shot input only during live play", () => {
    const controller = createKtsSessionController({ seed: 1 });

    expect(controller.pressHeld("fire", "pointer:fire")).toBe(false);
    expect(controller.queueRecoveryPulse()).toBe(false);

    controller.start(0);
    expect(controller.pressHeld("fire", "pointer:fire")).toBe(true);
    expect(controller.queueRecoveryPulse()).toBe(true);

    const snapshot = controller.advance(TICK_MS);
    expect(snapshot.currentState.weapon.nextProjectileId).toBe(2);
    expect(snapshot.sessionFrameCount).toBe(1);
  });

  it("restarts immediately with the same seed and clears session evidence", () => {
    const controller = createKtsSessionController({ seed: 123 });

    controller.start(0);
    controller.advance(TICK_MS);
    const restarted = controller.restartSameSeed(1_000);

    expect(restarted.lifecycle).toBe("playing");
    expect(restarted.seed).toBe(123);
    expect(restarted.currentState.tick).toBe(0);
    expect(restarted.sessionFrameCount).toBe(0);
    expect(restarted.recentEvents).toHaveLength(0);
  });

  it("accepts an injected new seed for restart", () => {
    const controller = createKtsSessionController({ seed: 123 });

    controller.start(0);
    const restarted = controller.restartWithSeed(456, 1_000);

    expect(restarted.seed).toBe(456);
    expect(restarted.currentState.seed).toBe(456);
    expect(restarted.lifecycle).toBe("playing");
  });

  it("bounds recent meaningful events and ignores ordinary score ticks", () => {
    let eventId = 0;
    const controller = createKtsSessionController({
      seed: 1,
      recentEventLimit: 3,
      step(previousState, frame): StepResult {
        const base = stepGame(previousState, frame);
        eventId += 1;
        return {
          state: base.state,
          events: [
            ...base.events,
            {
              type: "action_rejected",
              tick: previousState.tick,
              action: "fire",
              reason: "cooldown_active",
              sourceId: `event-${eventId}`,
            },
          ],
        };
      },
    });

    controller.start(0);
    controller.advance(TICK_MS * 4);
    const snapshot = controller.snapshot();

    expect(snapshot.recentEvents).toHaveLength(3);
    expect(snapshot.recentEvents.every((event) => event.type !== "score_added")).toBe(true);
    expect(snapshot.lastTickEvents.some((event) => event.type === "score_added")).toBe(true);
  });

  it("freezes copied engine events before exposing them", () => {
    const controller = createKtsSessionController({ seed: 1 });

    controller.start(0);
    const snapshot = controller.advance(TICK_MS);

    expect(snapshot.lastTickEvents.length).toBeGreaterThan(0);
    expect(Object.isFrozen(snapshot.lastTickEvents[0])).toBe(true);
  });

  it("enters completed, finalizes evidence, and exposes the final digest", () => {
    const controller = createKtsSessionController({ seed: 1, step: completeOnFirstTick });

    controller.start(0);
    const snapshot = controller.advance(TICK_MS);

    expect(snapshot.lifecycle).toBe("completed");
    expect(snapshot.sessionFrameCount).toBe(1);
    expect(snapshot.sessionRecord?.outcome).toBe("completed");
    expect(snapshot.sessionRecord?.finalDigest).toBe(createStateDigest(snapshot.currentState));
  });

  it("enters terminal before considering encounter completion", () => {
    const controller = createKtsSessionController({ seed: 1, step: terminalOnFirstTick });

    controller.start(0);
    const snapshot = controller.advance(TICK_MS);

    expect(snapshot.lifecycle).toBe("terminal");
    expect(snapshot.sessionRecord?.outcome).toBe("terminal");
  });

  it("stops the callback immediately after completion without fabricating later ticks", () => {
    const step = vi.fn(completeOnFirstTick);
    const controller = createKtsSessionController({ seed: 1, step });

    controller.start(0);
    const snapshot = controller.advance(TICK_MS * 8);

    expect(step).toHaveBeenCalledTimes(1);
    expect(snapshot.currentState.tick).toBe(1);
    expect(snapshot.sessionFrameCount).toBe(1);
    expect(snapshot.loop.totalTicksProcessed).toBe(1);
  });

  it("rejects replay before a live record is finalized", () => {
    const controller = createKtsSessionController({ seed: 1 });

    expect(() => controller.startReplay()).toThrow("finalized live session");
  });

  it("replays a completed record frame by frame with exact canonical evidence", () => {
    const controller = createKtsSessionController({ seed: 1, step: completeOnFirstTick });

    controller.start(0);
    const completed = controller.advance(TICK_MS);
    controller.startReplay(1_000);
    const replayed = controller.advance(1_000 + TICK_MS);

    expect(replayed.lifecycle).toBe("completed");
    expect(replayed.replayFrameIndex).toBe(1);
    expect(replayed.replayFrameCount).toBe(1);
    expect(replayed.replayVerification?.ok).toBe(true);
    expect(serializeCanonicalState(replayed.currentState)).toBe(
      completed.sessionRecord?.finalCanonicalState,
    );
  });

  it("disables live movement input during replay while preserving pause", () => {
    const controller = createKtsSessionController({ seed: 1, step: completeOnFirstTick });

    controller.start(0);
    controller.advance(TICK_MS);
    controller.startReplay(1_000);

    expect(controller.handleKeyDown({ code: "KeyA" }).handled).toBe(false);
    expect(controller.snapshot().input.left).toBe(false);
    expect(controller.handleKeyDown({ code: "KeyP" }).command).toBe("toggle_pause");
    expect(controller.snapshot().lifecycle).toBe("paused");
    expect(controller.snapshot().resumeLifecycle).toBe("replaying");
  });

  it("surfaces a replay mismatch as a paused deterministic-integrity fault", () => {
    let calls = 0;
    const controller = createKtsSessionController({
      seed: 1,
      step(previousState): StepResult {
        calls += 1;
        const result = completeOnFirstTick(previousState);

        if (calls > 1) {
          result.state.score += 1;
        }

        return result;
      },
    });

    controller.start(0);
    controller.advance(TICK_MS);
    controller.startReplay(1_000);
    const fault = controller.advance(1_000 + TICK_MS);

    expect(fault.lifecycle).toBe("paused");
    expect(fault.resumeLifecycle).toBeNull();
    expect(fault.replayVerification).toMatchObject({
      ok: false,
      reason: "canonical_state_mismatch",
    });
    expect(() => controller.resume()).toThrow("Only a paused active session");
  });

  it("exits an active replay and restores the finalized live state", () => {
    const controller = createKtsSessionController({ seed: 1, step: completeOnFirstTick });

    controller.start(0);
    const completed = controller.advance(TICK_MS);
    controller.startReplay(1_000);
    const exited = controller.exitReplay();

    expect(exited.lifecycle).toBe("completed");
    expect(exited.currentState).toBe(completed.currentState);
    expect(exited.replayFrameIndex).toBe(0);
  });

  it("can exit a replay after an integrity fault and restore live evidence", () => {
    let calls = 0;
    const controller = createKtsSessionController({
      seed: 1,
      step(previousState): StepResult {
        calls += 1;
        const result = completeOnFirstTick(previousState);

        if (calls > 1) {
          result.state.score += 1;
        }

        return result;
      },
    });

    controller.start(0);
    const completed = controller.advance(TICK_MS);
    controller.startReplay(1_000);
    controller.advance(1_000 + TICK_MS);
    const exited = controller.exitReplay();

    expect(exited.lifecycle).toBe("completed");
    expect(exited.currentState).toBe(completed.currentState);
    expect(exited.replayVerification).toBeNull();
  });

  it("can restart a fresh live run while replaying", () => {
    const controller = createKtsSessionController({ seed: 1, step: completeOnFirstTick });

    controller.start(0);
    controller.advance(TICK_MS);
    controller.startReplay(1_000);
    const restarted = controller.restartSameSeed(2_000);

    expect(restarted.lifecycle).toBe("playing");
    expect(restarted.currentState.tick).toBe(0);
    expect(restarted.sessionRecord).toBeNull();
    expect(restarted.replayFrameCount).toBe(0);
  });

  it("disposes loop, input, and subscriptions deterministically", () => {
    const controller = createKtsSessionController({ seed: 1 });
    const subscriber = vi.fn();
    controller.subscribe(subscriber);
    controller.start(0);
    subscriber.mockClear();

    const disposed = controller.dispose();

    expect(disposed.disposed).toBe(true);
    expect(disposed.loop.disposed).toBe(true);
    expect(disposed.input.fire).toBe(false);
    expect(() => controller.advance(TICK_MS)).toThrow("has been disposed");
    expect(subscriber).not.toHaveBeenCalled();
  });
});

function completeOnFirstTick(previousState: Readonly<GameState>): StepResult {
  const state = structuredClone(previousState) as GameState;
  state.tick += 1;
  state.encounter = {
    phase: "complete",
    waveNumber: 5,
    phaseTicks: 0,
    spawnCooldownTicks: 0,
    enemiesScheduled: ENGINE_CONSTANTS.WAVE_ENEMY_COUNTS[4],
    enemiesSpawned: ENGINE_CONSTANTS.WAVE_ENEMY_COUNTS[4],
    enemiesDefeated: ENGINE_CONSTANTS.WAVE_ENEMY_COUNTS[4],
    enemiesEscaped: 0,
    totalEnemiesDefeated: ENGINE_CONSTANTS.WAVE_ENEMY_COUNTS[4],
    totalEnemiesEscaped: 0,
    nextEnemyId: ENGINE_CONSTANTS.WAVE_ENEMY_COUNTS[4] + 1,
    nextEnemyProjectileId: 1,
  };
  state.enemies = [];
  state.enemyProjectiles = [];

  const events: EngineEvent[] = [
    {
      type: "encounter_completed",
      tick: previousState.tick,
      totalEnemiesDefeated: state.encounter.totalEnemiesDefeated,
      totalEnemiesEscaped: 0,
    },
  ];

  return { state, events };
}

function terminalOnFirstTick(previousState: Readonly<GameState>): StepResult {
  const result = completeOnFirstTick(previousState);
  result.state.status = "terminal";
  result.state.terminalReason = "signal_collapse";
  result.state.signal.integrity = 0;
  result.state.signal.collapseTicks = ENGINE_CONSTANTS.SIGNAL_COLLAPSE_GRACE_TICKS;
  result.state.currentCoherenceTicks = 0;

  return {
    state: result.state,
    events: [
      ...result.events,
      {
        type: "game_terminated",
        tick: previousState.tick,
        reason: "signal_collapse",
      },
    ],
  };
}
