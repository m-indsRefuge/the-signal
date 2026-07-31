import { describe, expect, it } from "vitest";

import {
  NEUTRAL_TICK_FRAME,
  ZERO_SEED_FALLBACK,
  createInitialGameState,
  stepGame,
  type GameState,
  type TickFrame,
} from "../app/features/keep-the-signal/engine";
import {
  KtsSessionRecorder,
  deriveSessionOutcome,
  formatSeed,
  generateRuntimeSeed,
  readSeedFromSearch,
  replaySessionRecord,
  validateSeedText,
} from "../app/features/keep-the-signal/runtime";

describe("Keep the Signal KTS-I3 runtime seed adapter", () => {
  it("accepts and trims a decimal unsigned 32-bit seed", () => {
    expect(validateSeedText(" 1987041211 ")).toEqual({
      valid: true,
      seed: 1_987_041_211,
      rawValue: 1_987_041_211,
      normalizedFromZero: false,
    });
  });

  it("accepts the maximum unsigned 32-bit seed", () => {
    expect(validateSeedText("4294967295")).toMatchObject({
      valid: true,
      seed: 0xffff_ffff,
      rawValue: 0xffff_ffff,
    });
  });

  it("normalizes a visible zero seed through the accepted engine fallback", () => {
    expect(validateSeedText("0")).toEqual({
      valid: true,
      seed: ZERO_SEED_FALLBACK,
      rawValue: 0,
      normalizedFromZero: true,
    });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["-1", "invalid_format"],
    ["+1", "invalid_format"],
    ["1.5", "invalid_format"],
    ["0x10", "invalid_format"],
    ["4294967296", "out_of_range"],
  ] as const)("rejects invalid seed input %j", (input: string, code: string) => {
    expect(validateSeedText(input)).toMatchObject({ valid: false, code });
  });

  it("accepts leading zeroes while normalizing the numeric seed", () => {
    expect(validateSeedText("0001")).toEqual({
      valid: true,
      seed: 1,
      rawValue: 1,
      normalizedFromZero: false,
    });
  });

  it("reads a valid seed from the route search string", () => {
    expect(readSeedFromSearch("?seed=123&mode=play")).toEqual({
      status: "valid",
      seed: 123,
      rawValue: 123,
      normalizedFromZero: false,
    });
  });

  it("reports an absent seed query without inventing one", () => {
    expect(readSeedFromSearch("?mode=play")).toEqual({ status: "absent" });
  });

  it("rejects duplicate seed query values", () => {
    expect(readSeedFromSearch("?seed=1&seed=2")).toMatchObject({
      status: "invalid",
      code: "duplicate_query_value",
    });
  });

  it("rejects an invalid route seed with an accessible message", () => {
    expect(readSeedFromSearch("seed=not-a-number")).toMatchObject({
      status: "invalid",
      code: "invalid_format",
      rawInput: "not-a-number",
    });
  });

  it("generates a seed through an injected secure random-values provider", () => {
    const seed = generateRuntimeSeed((target) => {
      target[0] = 123_456_789;
      return target;
    });

    expect(seed).toBe(123_456_789);
  });

  it("normalizes a generated zero without using Math.random", () => {
    const seed = generateRuntimeSeed((target) => {
      target[0] = 0;
      return target;
    });

    expect(seed).toBe(ZERO_SEED_FALLBACK);
  });

  it("rejects a random provider that replaces the supplied array", () => {
    expect(() => generateRuntimeSeed(() => new Uint32Array([1]))).toThrow(
      "return the supplied Uint32Array",
    );
  });

  it("formats normalized seeds for display", () => {
    expect(formatSeed(123)).toBe("123");
    expect(formatSeed(0)).toBe(String(ZERO_SEED_FALLBACK));
  });
});

describe("Keep the Signal KTS-I3 immutable session record", () => {
  it("begins from authoritative tick zero", () => {
    const initial = createInitialGameState({ seed: 7 });
    initial.tick = 1;

    expect(() => new KtsSessionRecorder(initial)).toThrow("authoritative tick 0");
  });

  it("creates an immutable empty session snapshot", () => {
    const initial = createInitialGameState({ seed: 7 });
    const recorder = new KtsSessionRecorder(initial);
    const record = recorder.snapshot();

    expect(record).toEqual({
      engineVersion: initial.engineVersion,
      rulesetVersion: initial.rulesetVersion,
      seed: 7,
      frames: [],
      finalCanonicalState: null,
      finalDigest: null,
      outcome: null,
    });
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.frames)).toBe(true);
  });

  it("records exactly one defensive frame copy per accepted tick", () => {
    const initial = createInitialGameState({ seed: 8 });
    const recorder = new KtsSessionRecorder(initial);
    const frame: TickFrame = {
      player: {
        moveX: 1,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    };

    expect(recorder.recordAcceptedFrame(frame)).toBe(1);
    (frame.player as { moveX: number }).moveX = -1;

    const recorded = recorder.snapshot().frames[0];
    expect(recorded?.player.moveX).toBe(1);
    expect(Object.isFrozen(recorded)).toBe(true);
    expect(Object.isFrozen(recorded?.player)).toBe(true);
  });

  it("derives no outcome from an active running state", () => {
    expect(deriveSessionOutcome(createInitialGameState({ seed: 9 }))).toBeNull();
  });

  it("derives completed from a valid completed encounter state", () => {
    expect(deriveSessionOutcome(createCompletedState(9))).toBe("completed");
  });

  it("derives terminal before considering encounter phase", () => {
    const { state } = createTerminalRecord(10);
    expect(deriveSessionOutcome(state)).toBe("terminal");
  });

  it("rejects finalization before a completed or terminal outcome", () => {
    const initial = createInitialGameState({ seed: 11 });
    const recorder = new KtsSessionRecorder(initial);

    expect(() => recorder.finalize(initial)).toThrow("only after encounter completion");
  });

  it("rejects a final tick that does not match recorded frame count", () => {
    const initial = createInitialGameState({ seed: 12 });
    const recorder = new KtsSessionRecorder(initial);
    const completed = createCompletedState(12);
    completed.tick = 1;

    expect(() => recorder.finalize(completed)).toThrow("must equal the number of recorded");
  });

  it("finalizes a structurally valid completed encounter", () => {
    const initial = createInitialGameState({ seed: 13 });
    const recorder = new KtsSessionRecorder(initial);
    const record = recorder.finalize(createCompletedState(13));

    expect(record.outcome).toBe("completed");
    expect(record.finalCanonicalState).toContain('"phase":"complete"');
    expect(record.finalDigest).toMatch(/^[0-9a-f]{8}$/);
    expect(recorder.finalized).toBe(true);
  });

  it("prevents frames from being added after finalization", () => {
    const initial = createInitialGameState({ seed: 14 });
    const recorder = new KtsSessionRecorder(initial);
    recorder.finalize(createCompletedState(14));

    expect(() => recorder.recordAcceptedFrame(NEUTRAL_TICK_FRAME)).toThrow(
      "cannot accept more tick frames",
    );
  });

  it("records and replays a terminal run with exact canonical evidence", () => {
    const { record } = createTerminalRecord(15);
    const replay = replaySessionRecord(record);

    expect(replay.ok).toBe(true);

    if (replay.ok) {
      expect(replay.processedTicks).toBe(record.frames.length);
      expect(replay.outcome).toBe("terminal");
      expect(replay.canonicalState).toBe(record.finalCanonicalState);
      expect(replay.digest).toBe(record.finalDigest);
    }
  });

  it("rejects replay of an unfinished record", () => {
    const recorder = new KtsSessionRecorder(createInitialGameState({ seed: 16 }));

    expect(replaySessionRecord(recorder.snapshot())).toMatchObject({
      ok: false,
      reason: "record_not_finalized",
    });
  });

  it("detects an altered replay outcome", () => {
    const { record } = createTerminalRecord(17);

    expect(replaySessionRecord({ ...record, outcome: "completed" })).toMatchObject({
      ok: false,
      reason: "outcome_mismatch",
    });
  });

  it("detects an altered canonical final state", () => {
    const { record } = createTerminalRecord(18);

    expect(replaySessionRecord({ ...record, finalCanonicalState: "{}" })).toMatchObject({
      ok: false,
      reason: "canonical_state_mismatch",
    });
  });

  it("detects an altered final digest after canonical equality", () => {
    const { record } = createTerminalRecord(19);

    expect(replaySessionRecord({ ...record, finalDigest: "deadbeef" })).toMatchObject({
      ok: false,
      reason: "digest_mismatch",
    });
  });

  it("detects incompatible engine metadata before replaying frames", () => {
    const { record } = createTerminalRecord(20);

    expect(replaySessionRecord({ ...record, engineVersion: "future-engine" })).toMatchObject({
      ok: false,
      reason: "engine_version_mismatch",
      processedTicks: 0,
    });
  });

  it("detects a seed that normalizes to a different authoritative value", () => {
    const { record } = createTerminalRecord(21);

    expect(replaySessionRecord({ ...record, seed: 0 })).toMatchObject({
      ok: false,
      reason: "seed_mismatch",
      processedTicks: 0,
    });
  });
});

function createCompletedState(seed: number): GameState {
  const state = createInitialGameState({ seed });

  state.encounter = {
    phase: "complete",
    waveNumber: 5,
    phaseTicks: 0,
    spawnCooldownTicks: 0,
    enemiesScheduled: 16,
    enemiesSpawned: 16,
    enemiesDefeated: 16,
    enemiesEscaped: 0,
    totalEnemiesDefeated: 60,
    totalEnemiesEscaped: 0,
    nextEnemyId: 61,
    nextEnemyProjectileId: 1,
  };

  return state;
}

function createTerminalRecord(seed: number): {
  readonly state: GameState;
  readonly record: ReturnType<KtsSessionRecorder["snapshot"]>;
} {
  let state = createInitialGameState({ seed });
  const recorder = new KtsSessionRecorder(state);

  for (let index = 0; index < 500 && state.status === "running"; index += 1) {
    const frame: TickFrame = {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: `terminal-corruption-${index}`,
          sequence: index,
          type: "signal_corruption",
          rawDamage: 10_000,
        },
      ],
    };

    state = stepGame(state, frame).state;
    recorder.recordAcceptedFrame(frame);
  }

  expect(state.status).toBe("terminal");

  return {
    state,
    record: recorder.finalize(state),
  };
}
