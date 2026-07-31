import { describe, expect, it } from "vitest";

import {
  ENGINE_CONSTANTS,
  NEUTRAL_TICK_FRAME,
  createInitialGameState,
  runSimulation,
  stepGame,
  type GameState,
  type TickFrame,
} from "../app/features/keep-the-signal/engine";

const neutralFrame = (): TickFrame => ({
  player: {
    moveX: 0,
    moveY: 0,
    fire: false,
    recoveryPulse: false,
  },
  environmentEvents: [],
});

const stepNeutral = (state: GameState) => stepGame(state, NEUTRAL_TICK_FRAME);

describe("Keep the Signal fixed-step dynamics", () => {
  it("advances one authoritative tick", () => {
    const initial = createInitialGameState({ seed: 1 });
    const result = stepNeutral(initial);

    expect(result.state.tick).toBe(1);
    expect(initial.tick).toBe(0);
  });

  it("applies cardinal acceleration and position integration", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 1,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });

    expect(result.state.player.velocityX).toBe(360);
    expect(result.state.player.velocityY).toBe(0);
    expect(result.state.player.positionX).toBe(500_360);
  });

  it("applies normalized diagonal acceleration", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 1,
        moveY: -1,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });

    expect(result.state.player.velocityX).toBe(255);
    expect(result.state.player.velocityY).toBe(-255);
    expect(result.state.player.positionX).toBe(500_255);
    expect(result.state.player.positionY).toBe(799_745);
  });

  it("applies drag without overshooting zero", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.player.velocityX = 100;
    initial.player.velocityY = -500;

    const result = stepNeutral(initial);

    expect(result.state.player.velocityX).toBe(0);
    expect(result.state.player.velocityY).toBe(-280);
  });

  it("clamps total movement speed", () => {
    let state = createInitialGameState({ seed: 1 });

    for (let index = 0; index < 100; index += 1) {
      state = stepGame(state, {
        player: {
          moveX: 1,
          moveY: 1,
          fire: false,
          recoveryPulse: false,
        },
        environmentEvents: [],
      }).state;
    }

    const magnitude = Math.sqrt(state.player.velocityX ** 2 + state.player.velocityY ** 2);

    expect(magnitude).toBeLessThanOrEqual(ENGINE_CONSTANTS.PLAYER_MAX_SPEED_PER_TICK);
  });

  it("clamps the craft inside the arena and clears outward velocity", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.player.positionX = ENGINE_CONSTANTS.WORLD_MAX - ENGINE_CONSTANTS.PLAYER_RADIUS - 1;
    initial.player.velocityX = 7_000;

    const result = stepNeutral(initial);

    expect(result.state.player.positionX).toBe(
      ENGINE_CONSTANTS.WORLD_MAX - ENGINE_CONSTANTS.PLAYER_RADIUS,
    );
    expect(result.state.player.velocityX).toBe(0);
  });

  it("applies a successful five-unit power shift", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
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
      weapons: 29,
      defence: 33,
      signal: 38,
      shiftCooldownTicks: 12,
    });

    expect(
      result.state.power.weapons + result.state.power.defence + result.state.power.signal,
    ).toBe(100);

    expect(result.events).toContainEqual({
      type: "power_shift_applied",
      tick: 0,
      from: "weapons",
      to: "signal",
      amount: 5,
    });
  });

  it("rejects a power shift while cooldown is active", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.power.shiftCooldownTicks = 2;

    const result = stepGame(initial, {
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

    expect(result.state.power.weapons).toBe(34);
    expect(result.state.power.signal).toBe(33);
    expect(result.state.power.shiftCooldownTicks).toBe(1);

    expect(result.events).toContainEqual({
      type: "action_rejected",
      tick: 0,
      action: "power_shift",
      reason: "cooldown_active",
    });
  });

  it("rejects a same-channel power shift", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
        powerShift: {
          from: "signal",
          to: "signal",
        },
      },
      environmentEvents: [],
    });

    expect(result.events).toContainEqual({
      type: "action_rejected",
      tick: 0,
      action: "power_shift",
      reason: "same_power_channel",
    });
  });

  it("creates and moves a projectile during a firing tick", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });

    expect(result.state.weapon.fireCooldownTicks).toBe(14);
    expect(result.state.weapon.nextProjectileId).toBe(2);
    expect(result.state.projectiles).toEqual([
      {
        id: 1,
        positionX: 500_000,
        positionY: 767_000,
        velocityX: 0,
        velocityY: -11_000,
        radius: 4_000,
        remainingTicks: 89,
      },
    ]);
  });

  it("rejects firing while the weapon cooldown is active", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.weapon.fireCooldownTicks = 2;

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });

    expect(result.state.weapon.fireCooldownTicks).toBe(1);
    expect(result.state.projectiles).toHaveLength(0);
    expect(result.events).toContainEqual({
      type: "action_rejected",
      tick: 0,
      action: "fire",
      reason: "cooldown_active",
    });
  });

  it("uses Weapons power to reduce the firing cooldown", () => {
    const lowPower = createInitialGameState({ seed: 1 });
    const highPower = createInitialGameState({ seed: 1 });

    lowPower.power.weapons = 10;
    lowPower.power.defence = 45;
    lowPower.power.signal = 45;

    highPower.power.weapons = 70;
    highPower.power.defence = 15;
    highPower.power.signal = 15;

    const lowResult = stepGame(lowPower, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });

    const highResult = stepGame(highPower, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });

    expect(lowResult.state.weapon.fireCooldownTicks).toBe(18);
    expect(highResult.state.weapon.fireCooldownTicks).toBe(6);
  });

  it("expires a projectile at the lifetime boundary", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.weapon.nextProjectileId = 2;
    initial.projectiles = [
      {
        id: 1,
        positionX: 500_000,
        positionY: 500_000,
        velocityX: 0,
        velocityY: -11_000,
        radius: 4_000,
        remainingTicks: 1,
      },
    ];

    const result = stepNeutral(initial);

    expect(result.state.projectiles).toHaveLength(0);
    expect(result.events).toContainEqual({
      type: "projectile_expired",
      tick: 0,
      projectileId: 1,
      reason: "lifetime",
    });
  });

  it("expires a projectile after its complete boundary leaves the world", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.weapon.nextProjectileId = 2;
    initial.projectiles = [
      {
        id: 1,
        positionX: 500_000,
        positionY: 5_000,
        velocityX: 0,
        velocityY: -11_000,
        radius: 4_000,
        remainingTicks: 90,
      },
    ];

    const result = stepNeutral(initial);

    expect(result.state.projectiles).toHaveLength(0);
    expect(result.events).toContainEqual({
      type: "projectile_expired",
      tick: 0,
      projectileId: 1,
      reason: "world_boundary",
    });
  });

  it("applies Defence mitigation to impact damage", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: "impact-1",
          sequence: 0,
          type: "impact",
          rawDamage: 1_000,
        },
      ],
    });

    expect(result.state.defence.integrity).toBe(9_170);
    expect(result.state.defence.ticksSinceDamage).toBe(0);
    expect(result.events).toContainEqual({
      type: "defence_damaged",
      tick: 0,
      sourceId: "impact-1",
      rawDamage: 1_000,
      effectiveDamage: 830,
    });
  });

  it("begins Defence recovery at the exact delay boundary", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.defence.integrity = 9_000;
    initial.defence.ticksSinceDamage = 119;

    const result = stepNeutral(initial);

    expect(result.state.defence.ticksSinceDamage).toBe(120);
    expect(result.state.defence.integrity).toBe(9_001);
    expect(result.state.defence.recoveryRemainder).toBe(29);
  });

  it("applies direct Signal corruption with power-dependent resistance", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: "corruption-1",
          sequence: 0,
          type: "signal_corruption",
          rawDamage: 1_000,
        },
      ],
    });

    expect(result.state.signal.integrity).toBe(9_150);
    expect(result.state.signal.ticksSinceDamage).toBe(0);
    expect(result.events).toContainEqual({
      type: "signal_damaged",
      tick: 0,
      sourceId: "corruption-1",
      source: "corruption",
      rawDamage: 1_000,
      effectiveDamage: 850,
    });
  });

  it("applies continuous interference with integer remainder accumulation", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: "load-1",
          sequence: 0,
          type: "set_interference_load",
          load: 50,
        },
      ],
    });

    expect(result.state.interference.load).toBe(50);
    expect(result.state.signal.integrity).toBe(9_998);
    expect(result.state.signal.interferenceDamageRemainder).toBe(16);
    expect(result.state.signal.ticksSinceDamage).toBe(0);
  });

  it("applies no interference damage when Signal power meets the load", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: "load-1",
          sequence: 0,
          type: "set_interference_load",
          load: 30,
        },
      ],
    });

    expect(result.state.signal.integrity).toBe(10_000);
    expect(result.state.signal.interferenceDamageRemainder).toBe(0);
  });

  it("begins Signal recovery at the exact delay boundary", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.signal.integrity = 9_000;
    initial.signal.ticksSinceDamage = 89;

    const result = stepNeutral(initial);

    expect(result.state.signal.ticksSinceDamage).toBe(90);
    expect(result.state.signal.integrity).toBe(9_002);
    expect(result.state.signal.recoveryRemainder).toBe(2);
  });

  it("does not passively revive collapsed Signal integrity", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.signal.integrity = 0;
    initial.signal.ticksSinceDamage = 500;

    const result = stepNeutral(initial);

    expect(result.state.signal.integrity).toBe(0);
    expect(result.state.signal.collapseTicks).toBe(1);
  });

  it("uses the recovery pulse to revive Signal during collapse grace", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.signal.integrity = 0;
    initial.signal.collapseTicks = 10;
    initial.defence.integrity = 9_000;

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: true,
      },
      environmentEvents: [],
    });

    expect(result.state.signal.integrity).toBe(1_200);
    expect(result.state.defence.integrity).toBe(9_600);
    expect(result.state.signal.collapseTicks).toBe(0);
    expect(result.state.recoveryPulse.cooldownTicks).toBe(900);
    expect(result.state.currentCoherenceTicks).toBe(1);
    expect(result.state.score).toBe(1);
  });

  it("terminates at the exact collapse-grace boundary", () => {
    const initial = createInitialGameState({ seed: 1 });

    initial.signal.integrity = 0;
    initial.signal.collapseTicks = 179;

    const result = stepNeutral(initial);

    expect(result.state.status).toBe("terminal");
    expect(result.state.terminalReason).toBe("signal_collapse");
    expect(result.state.signal.collapseTicks).toBe(180);
    expect(result.events).toContainEqual({
      type: "game_terminated",
      tick: 0,
      reason: "signal_collapse",
    });
  });

  it("treats terminal-state steps as complete no-ops", () => {
    const terminal = createInitialGameState({ seed: 1 });

    terminal.status = "terminal";
    terminal.terminalReason = "signal_collapse";
    terminal.signal.integrity = 0;
    terminal.signal.collapseTicks = 180;

    const before = structuredClone(terminal);
    const result = stepGame(terminal, {
      player: {
        moveX: 1,
        moveY: 1,
        fire: true,
        recoveryPulse: true,
      },
      environmentEvents: [],
    });

    expect(result.state).toEqual(before);
    expect(result.state).not.toBe(terminal);
    expect(result.events).toEqual([]);
  });

  it("processes environment events in canonical sequence and ID order", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: "b",
          sequence: 2,
          type: "set_interference_load",
          load: 40,
        },
        {
          id: "a",
          sequence: 1,
          type: "set_interference_load",
          load: 60,
        },
      ],
    });

    expect(result.state.interference.load).toBe(40);

    expect(
      result.events
        .filter((event) => event.type === "interference_load_changed")
        .map((event) => (event.type === "interference_load_changed" ? event.sourceId : null)),
    ).toEqual(["a", "b"]);
  });

  it("rejects every environment event sharing a duplicate ID", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: "duplicate",
          sequence: 0,
          type: "set_interference_load",
          load: 40,
        },
        {
          id: "duplicate",
          sequence: 1,
          type: "set_interference_load",
          load: 60,
        },
      ],
    });

    expect(result.state.interference.load).toBe(0);

    expect(
      result.events.filter(
        (event) =>
          event.type === "action_rejected" && event.reason === "duplicate_environment_event_id",
      ),
    ).toHaveLength(2);
  });

  it("rejects an invalid environment event without modifying pressure", () => {
    const initial = createInitialGameState({ seed: 1 });

    const result = stepGame(initial, {
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [
        {
          id: "invalid-load",
          sequence: 0,
          type: "set_interference_load",
          load: 101,
        },
      ],
    });

    expect(result.state.interference.load).toBe(0);
    expect(result.events).toContainEqual({
      type: "action_rejected",
      tick: 0,
      action: "environment_event",
      reason: "invalid_environment_event",
      sourceId: "invalid-load",
    });
  });

  it("does not mutate the previous state or input frame", () => {
    const initial = createInitialGameState({ seed: 1 });
    const frame: TickFrame = {
      player: {
        moveX: 1,
        moveY: 0,
        fire: true,
        recoveryPulse: false,
      },
      environmentEvents: [],
    };

    const stateBefore = structuredClone(initial);
    const frameBefore = structuredClone(frame);

    stepGame(initial, frame);

    expect(initial).toEqual(stateBefore);
    expect(frame).toEqual(frameBefore);
  });

  it("awards coherent transmission score monotonically", () => {
    let state = createInitialGameState({ seed: 1 });

    for (let index = 0; index < 10; index += 1) {
      const previousScore = state.score;
      state = stepNeutral(state).state;

      expect(state.score).toBeGreaterThan(previousScore);
    }

    expect(state.score).toBe(60);
    expect(state.currentCoherenceTicks).toBe(10);
    expect(state.longestCoherenceTicks).toBe(10);
  });

  it("runs a deterministic bounded simulation", () => {
    const frames = Array.from({ length: 10 }, neutralFrame);

    const first = runSimulation({
      seed: 1_987_041_211,
      frames,
    });

    const second = runSimulation({
      seed: 1_987_041_211,
      frames,
    });

    expect(first).toEqual(second);
    expect(first.processedTicks).toBe(10);
    expect(first.finalState.tick).toBe(10);
    expect(first.finalState.score).toBe(60);
    expect(first.stateDigest).toMatch(/^[0-9a-f]{8}$/);
  });

  it("honours a zero simulation tick limit", () => {
    const result = runSimulation({
      seed: 1,
      frames: [neutralFrame()],
      maximumTickCount: 0,
    });

    expect(result.processedTicks).toBe(0);
    expect(result.finalState.tick).toBe(0);
    expect(result.events).toEqual([]);
  });

  it.each([-1, 1.5, Number.NaN])(
    "rejects an invalid simulation tick limit: %s",
    (maximumTickCount) => {
      expect(() =>
        runSimulation({
          seed: 1,
          frames: [],
          maximumTickCount,
        }),
      ).toThrow("maximumTickCount must be a non-negative safe integer.");
    },
  );
});
