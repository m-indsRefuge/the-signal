import { describe, expect, it } from "vitest";

import {
  ENGINE_CONSTANTS,
  NEUTRAL_TICK_FRAME,
  createInitialGameState,
  createStateDigest,
  nextUint32,
  runSimulation,
  serializeCanonicalState,
  stepGame,
  validateGameState,
  type EngineEvent,
  type EnvironmentEvent,
  type GameState,
  type PowerShiftAction,
  type ProjectileState,
  type TickFrame,
} from "../app/features/keep-the-signal/engine";

const CANONICAL_FIXTURE_SEED = 1_987_041_211;
const CANONICAL_FIXTURE_TICKS = 2_400;

function createCanonicalFixtureFrames(): TickFrame[] {
  return Array.from({ length: CANONICAL_FIXTURE_TICKS }, (_, tick): TickFrame => {
    let moveX: -1 | 0 | 1 = 0;
    let moveY: -1 | 0 | 1 = 0;

    if (tick < 120) {
      moveY = -1;
    } else if (tick < 240) {
      moveX = 1;
    } else if (tick < 360) {
      moveY = 1;
    } else if (tick < 480) {
      moveX = -1;
    } else if (tick < 600) {
      moveX = 1;
      moveY = -1;
    }

    let powerShift: PowerShiftAction | undefined;

    if (tick === 50) {
      powerShift = {
        from: "weapons",
        to: "signal",
      };
    } else if (tick === 100) {
      powerShift = {
        from: "defence",
        to: "weapons",
      };
    } else if (tick === 150) {
      powerShift = {
        from: "signal",
        to: "defence",
      };
    } else if (tick === 151) {
      powerShift = {
        from: "signal",
        to: "weapons",
      };
    }

    const environmentEvents: EnvironmentEvent[] = [];

    if (tick === 300) {
      environmentEvents.push({
        id: "fixture-interference-high",
        sequence: 0,
        type: "set_interference_load",
        load: 60,
      });
    }

    if (tick === 500) {
      environmentEvents.push({
        id: "fixture-interference-low",
        sequence: 0,
        type: "set_interference_load",
        load: 20,
      });
    }

    if (tick === 600) {
      environmentEvents.push({
        id: "fixture-critical-corruption",
        sequence: 0,
        type: "signal_corruption",
        rawDamage: 10_000,
      });
    }

    if (tick === 700) {
      environmentEvents.push({
        id: "fixture-impact",
        sequence: 0,
        type: "impact",
        rawDamage: 1_000,
      });
    }

    return {
      player: {
        moveX,
        moveY,
        fire: tick < 300,
        recoveryPulse: tick === 650,
        ...(powerShift === undefined ? {} : { powerShift }),
      },
      environmentEvents,
    };
  });
}

interface FixtureTimelineResult {
  readonly finalState: GameState;
  readonly events: EngineEvent[];
  readonly minimumSignalIntegrity: number;
  readonly enteredCriticalState: boolean;
  readonly recoveredFromCriticalState: boolean;
}

function runCanonicalFixtureTimeline(): FixtureTimelineResult {
  const frames = createCanonicalFixtureFrames();
  const events: EngineEvent[] = [];

  let state = createInitialGameState({
    seed: CANONICAL_FIXTURE_SEED,
  });

  let minimumSignalIntegrity = state.signal.integrity;
  let enteredCriticalState = false;
  let recoveredFromCriticalState = false;

  for (const frame of frames) {
    const result = stepGame(state, frame);

    state = result.state;
    events.push(...result.events);

    minimumSignalIntegrity = Math.min(minimumSignalIntegrity, state.signal.integrity);

    if (state.signal.integrity > 0 && state.signal.integrity < 4_000) {
      enteredCriticalState = true;
    }

    if (enteredCriticalState && state.signal.integrity >= 4_000) {
      recoveredFromCriticalState = true;
    }
  }

  return {
    finalState: state,
    events,
    minimumSignalIntegrity,
    enteredCriticalState,
    recoveredFromCriticalState,
  };
}

function createCapacityProjectiles(): ProjectileState[] {
  return Array.from(
    {
      length: ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES,
    },
    (_, index): ProjectileState => ({
      id: index + 1,
      positionX: 500_000,
      positionY: 500_000,
      velocityX: 0,
      velocityY: -1,
      radius: ENGINE_CONSTANTS.PROJECTILE_RADIUS,
      remainingTicks: ENGINE_CONSTANTS.PROJECTILE_LIFETIME_TICKS,
    }),
  );
}

describe("Keep the Signal deterministic state representation", () => {
  it("reproduces canonical state across repeated independent creation", () => {
    const createEvidence = () => {
      const state = createInitialGameState({
        seed: CANONICAL_FIXTURE_SEED,
      });

      return {
        serialized: serializeCanonicalState(state),
        digest: createStateDigest(state),
      };
    };

    expect(createEvidence()).toEqual(createEvidence());
  });

  it("does not mutate state while validating or serializing", () => {
    const state = createInitialGameState({ seed: 42 });
    const before = structuredClone(state);

    validateGameState(state);
    serializeCanonicalState(state);
    createStateDigest(state);

    expect(state).toEqual(before);
  });

  it("rejects terminal state without the collapse boundary", () => {
    const state = createInitialGameState({ seed: 42 });

    state.status = "terminal";
    state.terminalReason = "signal_collapse";
    state.signal.integrity = 0;
    state.signal.collapseTicks = 179;

    expect(() => validateGameState(state)).toThrow(
      "A terminal state must be at the collapse grace boundary.",
    );
  });

  it("accepts a structurally valid terminal state", () => {
    const state = createInitialGameState({ seed: 42 });

    state.status = "terminal";
    state.terminalReason = "signal_collapse";
    state.signal.integrity = 0;
    state.signal.collapseTicks = 180;

    expect(validateGameState(state)).toEqual({ valid: true });
  });

  it("rejects a power shift below the minimum channel floor", () => {
    const state = createInitialGameState({ seed: 1 });

    state.power.weapons = 10;
    state.power.defence = 45;
    state.power.signal = 45;

    const result = stepGame(state, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
        powerShift: {
          from: "weapons",
          to: "signal",
        },
      },
      environmentEvents: [],
    });

    expect(result.state.power).toEqual({
      weapons: 10,
      defence: 45,
      signal: 45,
      shiftCooldownTicks: 0,
    });

    expect(result.events).toContainEqual({
      type: "action_rejected",
      tick: 0,
      action: "power_shift",
      reason: "power_floor",
    });
  });

  it("rejects a power shift above the maximum channel ceiling", () => {
    const state = createInitialGameState({ seed: 1 });

    state.power.weapons = 15;
    state.power.defence = 15;
    state.power.signal = 70;

    const result = stepGame(state, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
        powerShift: {
          from: "weapons",
          to: "signal",
        },
      },
      environmentEvents: [],
    });

    expect(result.state.power).toEqual({
      weapons: 15,
      defence: 15,
      signal: 70,
      shiftCooldownTicks: 0,
    });

    expect(result.events).toContainEqual({
      type: "action_rejected",
      tick: 0,
      action: "power_shift",
      reason: "power_ceiling",
    });
  });

  it("uses a new power allocation in later calculations during the same tick", () => {
    const state = createInitialGameState({ seed: 1 });

    const result = stepGame(state, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
        powerShift: {
          from: "weapons",
          to: "signal",
        },
      },
      environmentEvents: [
        {
          id: "same-tick-load",
          sequence: 0,
          type: "set_interference_load",
          load: 41,
        },
      ],
    });

    expect(result.state.power.signal).toBe(38);
    expect(result.state.signal.integrity).toBe(10_000);
    expect(result.state.signal.interferenceDamageRemainder).toBe(24);
  });

  it("assigns monotonically increasing projectile identifiers", () => {
    let state = createInitialGameState({ seed: 1 });

    state = stepGame(state, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    }).state;

    for (let tick = 0; tick < 13; tick += 1) {
      state = stepGame(state, NEUTRAL_TICK_FRAME).state;
    }

    state = stepGame(state, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    }).state;

    expect(state.projectiles.map((projectile) => projectile.id)).toEqual([1, 2]);
    expect(state.weapon.nextProjectileId).toBe(3);
  });

  it("rejects firing when projectile capacity is reached", () => {
    const state = createInitialGameState({ seed: 1 });

    state.projectiles = createCapacityProjectiles();
    state.weapon.nextProjectileId = ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES + 1;

    const result = stepGame(state, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });

    expect(result.state.projectiles).toHaveLength(ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES);

    expect(result.events).toContainEqual({
      type: "action_rejected",
      tick: 0,
      action: "fire",
      reason: "projectile_capacity",
    });
  });

  it("clamps Defence damage at zero integrity", () => {
    const state = createInitialGameState({ seed: 1 });

    state.defence.integrity = 100;

    const result = stepGame(state, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: "overwhelming-impact",
          sequence: 0,
          type: "impact",
          rawDamage: 10_000,
        },
      ],
    });

    expect(result.state.defence.integrity).toBe(0);

    expect(result.events).toContainEqual({
      type: "defence_damaged",
      tick: 0,
      sourceId: "overwhelming-impact",
      rawDamage: 10_000,
      effectiveDamage: 100,
    });
  });

  it("permits passive Defence recovery from zero integrity", () => {
    const state = createInitialGameState({ seed: 1 });

    state.defence.integrity = 0;
    state.defence.ticksSinceDamage = 119;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.defence.integrity).toBe(1);
    expect(result.state.defence.ticksSinceDamage).toBe(120);
    expect(result.state.defence.recoveryRemainder).toBe(29);
  });

  it("suppresses passive Signal recovery while interference exceeds Signal power", () => {
    const state = createInitialGameState({ seed: 1 });

    state.signal.integrity = 9_000;
    state.signal.ticksSinceDamage = 89;
    state.interference.load = 34;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.signal.integrity).toBe(9_000);
    expect(result.state.signal.recoveryRemainder).toBe(0);
    expect(result.state.signal.interferenceDamageRemainder).toBe(8);
  });

  it("stops score and resets current coherence while Signal is collapsed", () => {
    const state = createInitialGameState({ seed: 1 });

    state.signal.integrity = 0;
    state.score = 100;
    state.currentCoherenceTicks = 10;
    state.longestCoherenceTicks = 10;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.score).toBe(100);
    expect(result.state.currentCoherenceTicks).toBe(0);
    expect(result.state.longestCoherenceTicks).toBe(10);
  });

  it("remains recoverable through collapse tick 179", () => {
    const state = createInitialGameState({ seed: 1 });

    state.signal.integrity = 0;
    state.signal.collapseTicks = 178;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.status).toBe("running");
    expect(result.state.terminalReason).toBeNull();
    expect(result.state.signal.collapseTicks).toBe(179);
  });

  it("terminates only when collapse reaches tick 180", () => {
    const state = createInitialGameState({ seed: 1 });

    state.signal.integrity = 0;
    state.signal.collapseTicks = 179;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.status).toBe("terminal");
    expect(result.state.terminalReason).toBe("signal_collapse");
    expect(result.state.signal.collapseTicks).toBe(180);
  });

  it("produces different RNG sequences from different seeds", () => {
    const first = nextUint32(1);
    const second = nextUint32(2);

    expect(first.value).not.toBe(second.value);
    expect(first.nextState).not.toBe(second.nextState);
  });

  it("defines a canonical fixture containing exactly 2,400 frames", () => {
    const frames = createCanonicalFixtureFrames();

    expect(frames).toHaveLength(CANONICAL_FIXTURE_TICKS);
  });

  it("runs the complete canonical regression fixture deterministically", () => {
    const frames = createCanonicalFixtureFrames();

    const first = runSimulation({
      seed: CANONICAL_FIXTURE_SEED,
      frames,
    });

    const second = runSimulation({
      seed: CANONICAL_FIXTURE_SEED,
      frames,
    });

    expect(first).toEqual(second);
    expect(first.processedTicks).toBe(CANONICAL_FIXTURE_TICKS);
    expect(first.finalState.tick).toBe(CANONICAL_FIXTURE_TICKS);
    expect(first.finalState.status).toBe("running");
    expect(first.finalState.terminalReason).toBeNull();
    expect(first.stateDigest).toMatch(/^[0-9a-f]{8}$/);
  });

  it("covers the required canonical fixture actions and events", () => {
    const frames = createCanonicalFixtureFrames();

    const result = runSimulation({
      seed: CANONICAL_FIXTURE_SEED,
      frames,
    });

    const appliedPowerShifts = result.events.filter(
      (event) => event.type === "power_shift_applied",
    );

    const rejectedPowerShifts = result.events.filter(
      (event) => event.type === "action_rejected" && event.action === "power_shift",
    );

    const rejectedShots = result.events.filter(
      (event) => event.type === "action_rejected" && event.action === "fire",
    );

    const interferenceChanges = result.events.filter(
      (event) => event.type === "interference_load_changed",
    );

    const impacts = result.events.filter(
      (event) =>
        event.type === "defence_damaged" &&
        !event.sourceId.startsWith("enemy_projectile:") &&
        !event.sourceId.startsWith("enemy_escape:"),
    );

    const directCorruptions = result.events.filter(
      (event) =>
        event.type === "signal_damaged" &&
        event.source === "corruption" &&
        !event.sourceId.startsWith("enemy_projectile:") &&
        !event.sourceId.startsWith("enemy_escape:"),
    );

    const recoveryPulses = result.events.filter((event) => event.type === "recovery_pulse_applied");

    expect(appliedPowerShifts).toHaveLength(3);
    expect(rejectedPowerShifts.length).toBeGreaterThanOrEqual(1);
    expect(rejectedShots.length).toBeGreaterThanOrEqual(1);
    expect(interferenceChanges).toHaveLength(2);
    expect(impacts).toHaveLength(1);
    expect(directCorruptions).toHaveLength(1);
    expect(recoveryPulses).toHaveLength(1);
  });

  it("drives Signal into Critical state and later restores it", () => {
    const timeline = runCanonicalFixtureTimeline();

    expect(timeline.enteredCriticalState).toBe(true);
    expect(timeline.recoveredFromCriticalState).toBe(true);
    expect(timeline.minimumSignalIntegrity).toBeGreaterThan(0);
    expect(timeline.minimumSignalIntegrity).toBeLessThan(4_000);
    expect(timeline.finalState.signal.integrity).toBeGreaterThanOrEqual(4_000);
    expect(timeline.finalState.status).toBe("running");
  });

  it("matches direct fixture stepping with the simulation runner", () => {
    const frames = createCanonicalFixtureFrames();
    const timeline = runCanonicalFixtureTimeline();

    const simulation = runSimulation({
      seed: CANONICAL_FIXTURE_SEED,
      frames,
    });

    expect(simulation.finalState).toEqual(timeline.finalState);
    expect(simulation.events).toEqual(timeline.events);
    expect(simulation.canonicalState).toBe(serializeCanonicalState(timeline.finalState));
    expect(simulation.stateDigest).toBe(createStateDigest(timeline.finalState));
  });
});
