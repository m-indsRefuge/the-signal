import { describe, expect, it } from "vitest";

import {
  ENGINE_CONSTANTS,
  EngineInvariantError,
  NEUTRAL_TICK_FRAME,
  ZERO_SEED_FALLBACK,
  calculateCoherenceMultiplier,
  calculateIntegrityTier,
  calculateTickScore,
  createInitialGameState,
  createStateDigest,
  nextInt,
  nextUint32,
  normalizeSeed,
  serializeCanonicalState,
  validateGameState,
} from "../app/features/keep-the-signal/engine";

describe("Keep the Signal engine foundation", () => {
  it("exports the accepted deterministic constants", () => {
    expect(ENGINE_CONSTANTS.TICKS_PER_SECOND).toBe(60);
    expect(ENGINE_CONSTANTS.WORLD_MIN).toBe(0);
    expect(ENGINE_CONSTANTS.WORLD_MAX).toBe(1_000_000);
    expect(ENGINE_CONSTANTS.TOTAL_POWER).toBe(100);
    expect(ENGINE_CONSTANTS.SIGNAL_COLLAPSE_GRACE_TICKS).toBe(180);
  });

  it("freezes the default constants object", () => {
    expect(Object.isFrozen(ENGINE_CONSTANTS)).toBe(true);
  });

  it("creates the accepted initial game state", () => {
    const state = createInitialGameState({ seed: 1_987_041_211 });

    expect(state).toMatchObject({
      engineVersion: "kts-i1.0.0",
      rulesetVersion: "kts-foundation-0.1",
      seed: 1_987_041_211,
      rngState: 1_987_041_211,
      tick: 0,
      status: "running",
      terminalReason: null,
      score: 0,
      currentCoherenceTicks: 0,
      longestCoherenceTicks: 0,
    });
  });

  it("places the player at the accepted starting position", () => {
    const state = createInitialGameState({ seed: 123 });

    expect(state.player).toEqual({
      positionX: 500_000,
      positionY: 800_000,
      velocityX: 0,
      velocityY: 0,
      radius: 18_000,
    });
  });

  it("creates the accepted initial power allocation", () => {
    const state = createInitialGameState({ seed: 123 });

    expect(state.power).toEqual({
      weapons: 34,
      defence: 33,
      signal: 33,
      shiftCooldownTicks: 0,
    });

    expect(state.power.weapons + state.power.defence + state.power.signal).toBe(100);
  });

  it("creates full initial Defence and Signal integrity", () => {
    const state = createInitialGameState({ seed: 123 });

    expect(state.defence).toEqual({
      integrity: 10_000,
      ticksSinceDamage: 0,
      recoveryRemainder: 0,
    });

    expect(state.signal).toEqual({
      integrity: 10_000,
      ticksSinceDamage: 0,
      collapseTicks: 0,
      recoveryRemainder: 0,
      interferenceDamageRemainder: 0,
    });
  });

  it("normalizes a zero seed to the accepted fallback", () => {
    expect(normalizeSeed(0)).toBe(ZERO_SEED_FALLBACK);

    const state = createInitialGameState({ seed: 0 });

    expect(state.seed).toBe(ZERO_SEED_FALLBACK);
    expect(state.rngState).toBe(ZERO_SEED_FALLBACK);
  });

  it.each([-1, 1.5, 0x1_0000_0000, Number.NaN])("rejects an invalid unsigned seed: %s", (seed) => {
    expect(() => normalizeSeed(seed)).toThrow("Seed must be an unsigned 32-bit integer.");
  });

  it("creates independent initial-state object graphs", () => {
    const first = createInitialGameState({ seed: 1 });
    const second = createInitialGameState({ seed: 1 });

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.player).not.toBe(second.player);
    expect(first.power).not.toBe(second.power);
    expect(first.projectiles).not.toBe(second.projectiles);
  });

  it("provides a neutral immutable tick frame", () => {
    expect(NEUTRAL_TICK_FRAME).toEqual({
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });

    expect(Object.isFrozen(NEUTRAL_TICK_FRAME)).toBe(true);
    expect(Object.isFrozen(NEUTRAL_TICK_FRAME.player)).toBe(true);
    expect(Object.isFrozen(NEUTRAL_TICK_FRAME.environmentEvents)).toBe(true);
  });

  it("produces the exact accepted xorshift32 sequence", () => {
    const expected = [270_369, 67_634_689, 2_647_435_461, 307_599_695, 2_398_689_233];

    const actual: number[] = [];
    let state = 1;

    for (let index = 0; index < expected.length; index += 1) {
      const result = nextUint32(state);
      actual.push(result.value);
      state = result.nextState;
    }

    expect(actual).toEqual(expected);
  });

  it("normalizes zero before advancing xorshift32", () => {
    expect(nextUint32(0)).toEqual(nextUint32(ZERO_SEED_FALLBACK));
  });

  it("reproduces the canonical fixture seed sequence", () => {
    const expected = [528_928_535, 183_355_525, 3_428_523_547, 1_553_797_943, 562_693_386];

    const actual: number[] = [];
    let state = 1_987_041_211;

    for (let index = 0; index < expected.length; index += 1) {
      const result = nextUint32(state);
      actual.push(result.value);
      state = result.nextState;
    }

    expect(actual).toEqual(expected);
  });

  it("returns deterministic bounded integers", () => {
    const result = nextInt(1, 10);

    expect(result).toEqual({
      value: 9,
      nextState: 270_369,
    });
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects an invalid maxExclusive value: %s", (maxExclusive) => {
    expect(() => nextInt(1, maxExclusive)).toThrow("maxExclusive must be a positive safe integer.");
  });

  it("does not leak random state across repeated sequences", () => {
    const generateSequence = (): number[] => {
      const sequence: number[] = [];
      let state = 42;

      for (let index = 0; index < 20; index += 1) {
        const result = nextUint32(state);
        sequence.push(result.value);
        state = result.nextState;
      }

      return sequence;
    };

    expect(generateSequence()).toEqual(generateSequence());
  });

  it("validates an accepted initial state", () => {
    const state = createInitialGameState({ seed: 123 });

    expect(validateGameState(state)).toEqual({ valid: true });
  });

  it("rejects a state whose power does not total 100", () => {
    const state = createInitialGameState({ seed: 123 });
    state.power.weapons = 35;

    expect(() => validateGameState(state)).toThrow(EngineInvariantError);
    expect(() => validateGameState(state)).toThrow("Power must total 100.");
  });

  it("rejects out-of-range Signal integrity", () => {
    const state = createInitialGameState({ seed: 123 });
    state.signal.integrity = 10_001;

    expect(() => validateGameState(state)).toThrow("signal.integrity must be between 0 and 10000.");
  });

  it("rejects duplicate or unordered projectile IDs", () => {
    const state = createInitialGameState({ seed: 123 });

    state.weapon.nextProjectileId = 3;
    state.projectiles = [
      {
        id: 2,
        positionX: 500_000,
        positionY: 500_000,
        velocityX: 0,
        velocityY: -11_000,
        radius: 4_000,
        remainingTicks: 90,
      },
      {
        id: 2,
        positionX: 500_000,
        positionY: 489_000,
        velocityX: 0,
        velocityY: -11_000,
        radius: 4_000,
        remainingTicks: 89,
      },
    ];

    expect(() => validateGameState(state)).toThrow(
      "Projectile IDs must be unique and ordered in ascending order.",
    );
  });

  it("calculates the accepted Signal-integrity tiers", () => {
    expect(calculateIntegrityTier(0)).toBe(0);
    expect(calculateIntegrityTier(1)).toBe(1);
    expect(calculateIntegrityTier(1_999)).toBe(1);
    expect(calculateIntegrityTier(2_000)).toBe(2);
    expect(calculateIntegrityTier(9_999)).toBe(5);
    expect(calculateIntegrityTier(10_000)).toBe(6);
  });

  it("calculates and caps the coherence multiplier", () => {
    expect(calculateCoherenceMultiplier(0)).toBe(1);
    expect(calculateCoherenceMultiplier(1_799)).toBe(1);
    expect(calculateCoherenceMultiplier(1_800)).toBe(2);
    expect(calculateCoherenceMultiplier(7_200)).toBe(5);
    expect(calculateCoherenceMultiplier(100_000)).toBe(5);
  });

  it("calculates zero score when Signal integrity is zero", () => {
    expect(calculateTickScore(0, 10_000)).toEqual({
      amount: 0,
      integrityTier: 0,
      coherenceMultiplier: 5,
    });
  });

  it("calculates accepted integrity and coherence scoring", () => {
    expect(calculateTickScore(10_000, 1_800)).toEqual({
      amount: 12,
      integrityTier: 6,
      coherenceMultiplier: 2,
    });
  });

  it("serializes equivalent state values identically", () => {
    const first = createInitialGameState({ seed: 123 });
    const second = createInitialGameState({ seed: 123 });

    expect(serializeCanonicalState(first)).toBe(serializeCanonicalState(second));
  });

  it("serializes state using the documented top-level order", () => {
    const state = createInitialGameState({ seed: 123 });
    const serialized = serializeCanonicalState(state);

    expect(serialized.startsWith('{"engineVersion":"kts-i1.0.0","rulesetVersion"')).toBe(true);

    expect(serialized.endsWith('"projectiles":[]}')).toBe(true);
  });

  it("produces stable eight-character lowercase state digests", () => {
    const state = createInitialGameState({ seed: 123 });
    const digest = createStateDigest(state);

    expect(digest).toMatch(/^[0-9a-f]{8}$/);
    expect(createStateDigest(state)).toBe(digest);
  });

  it("changes the state digest when authoritative state changes", () => {
    const first = createInitialGameState({ seed: 123 });
    const second = createInitialGameState({ seed: 123 });

    second.tick = 1;

    expect(createStateDigest(first)).not.toBe(createStateDigest(second));
  });
});
