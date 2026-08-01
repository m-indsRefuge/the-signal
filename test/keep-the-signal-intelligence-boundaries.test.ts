import actionSpaceSource from "../app/features/keep-the-signal/intelligence-adapter/action-space.ts?raw";
import eventWindowSource from "../app/features/keep-the-signal/intelligence-adapter/event-window.ts?raw";
import indexSource from "../app/features/keep-the-signal/intelligence-adapter/index.ts?raw";
import observationContractSource from "../app/features/keep-the-signal/intelligence-adapter/observation-contract.ts?raw";
import observationFailuresSource from "../app/features/keep-the-signal/intelligence-adapter/observation-failures.ts?raw";
import observationProjectionSource from "../app/features/keep-the-signal/intelligence-adapter/observation-projection.ts?raw";

import { describe, expect, it } from "vitest";

import {
  ENGINE_CONSTANTS,
  NEUTRAL_TICK_FRAME,
  createInitialGameState,
  stepGame,
  type GameState,
} from "../app/features/keep-the-signal/engine";
import {
  KTS_POWER_SHIFT_VOCABULARY,
  projectKtsActionSpace,
  projectPowerShiftReadiness,
} from "../app/features/keep-the-signal/intelligence-adapter";

const productionSources = Object.freeze([
  observationContractSource,
  observationFailuresSource,
  eventWindowSource,
  actionSpaceSource,
  observationProjectionSource,
  indexSource,
] as const);

function productionText(): string {
  return productionSources.join("\n");
}

describe("KTS-I4-C observation boundaries", () => {
  it("keeps the production file set exact", () => {
    expect(productionSources).toHaveLength(6);
  });

  it("contains no React import", () => {
    expect(productionText()).not.toMatch(/from\s+["']react["']/);
  });

  it("contains no runtime import", () => {
    expect(productionText()).not.toMatch(/keep-the-signal\/runtime/);
  });

  it("contains no presentation import", () => {
    expect(productionText()).not.toMatch(/keep-the-signal\/presentation/);
  });

  it("contains no player import", () => {
    expect(productionText()).not.toMatch(/keep-the-signal\/player/);
  });

  it("contains no route import", () => {
    expect(productionText()).not.toMatch(/app\/routes|from\s+["'][^"']*routes/);
  });

  it("contains no provider import", () => {
    expect(productionText()).not.toMatch(/provider-contract|invocation-coordinator/);
  });

  it("contains no model invocation", () => {
    expect(productionText()).not.toMatch(/\.invoke\s*\(|invokeModel|project.*prompt/i);
  });

  it("contains no call to stepGame", () => {
    expect(productionText()).not.toMatch(/\bstepGame\s*\(/);
  });

  it("contains no call to runSimulation", () => {
    expect(productionText()).not.toMatch(/\brunSimulation\s*\(/);
  });

  it("contains no network APIs", () => {
    expect(productionText()).not.toMatch(/\bfetch\b|XMLHttpRequest|WebSocket/);
  });

  it("contains no storage APIs", () => {
    expect(productionText()).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

  it("contains no environment access", () => {
    expect(productionText()).not.toMatch(/process\.env|Deno\.env|Bun\.env/);
  });

  it("contains no dynamic code execution", () => {
    expect(productionText()).not.toMatch(/\beval\s*\(|new\s+Function/);
  });

  it("contains no wall-clock access", () => {
    expect(productionText()).not.toMatch(/Date\.now|performance\.now/);
  });

  it("contains no randomness API", () => {
    expect(productionText()).not.toMatch(/Math\.random|crypto\.getRandomValues/);
  });

  it("exports exactly six static power-shift directions", () => {
    expect(KTS_POWER_SHIFT_VOCABULARY).toEqual([
      { from: "weapons", to: "defence" },
      { from: "weapons", to: "signal" },
      { from: "defence", to: "weapons" },
      { from: "defence", to: "signal" },
      { from: "signal", to: "weapons" },
      { from: "signal", to: "defence" },
    ]);
  });

  it("matches fire readiness to an accepted engine success", () => {
    const state = createInitialGameState({ seed: 42 });
    const observation = projectKtsActionSpace(state);
    const result = stepGame(state, {
      ...NEUTRAL_TICK_FRAME,
      player: { ...NEUTRAL_TICK_FRAME.player, fire: true },
    });

    expect(observation.readiness.fireReady).toBe(true);
    expect(result.events.some((event) => event.type === "projectile_fired")).toBe(true);
  });

  it("matches fire cooldown blocking to engine rejection", () => {
    const state = createInitialGameState({ seed: 42 });
    state.weapon.fireCooldownTicks = 2;
    const observation = projectKtsActionSpace(state);
    const result = stepGame(state, {
      ...NEUTRAL_TICK_FRAME,
      player: { ...NEUTRAL_TICK_FRAME.player, fire: true },
    });

    expect(observation.readiness.fireReady).toBe(false);
    expect(
      result.events.some(
        (event) =>
          event.type === "action_rejected" &&
          event.action === "fire" &&
          event.reason === "cooldown_active",
      ),
    ).toBe(true);
  });

  it("matches recovery readiness to an accepted engine success", () => {
    const state = createInitialGameState({ seed: 42 });
    state.signal.integrity = 9_000;
    const observation = projectKtsActionSpace(state);
    const result = stepGame(state, {
      ...NEUTRAL_TICK_FRAME,
      player: { ...NEUTRAL_TICK_FRAME.player, recoveryPulse: true },
    });

    expect(observation.readiness.recoveryPulseReady).toBe(true);
    expect(result.events.some((event) => event.type === "recovery_pulse_applied")).toBe(true);
  });

  it("matches power-shift readiness to an accepted engine success", () => {
    const state = createInitialGameState({ seed: 42 });
    const readiness = projectPowerShiftReadiness(state, "weapons", "signal");
    const result = stepGame(state, {
      ...NEUTRAL_TICK_FRAME,
      player: {
        ...NEUTRAL_TICK_FRAME.player,
        powerShift: { from: "weapons", to: "signal" },
      },
    });

    expect(readiness.ready).toBe(true);
    expect(result.events.some((event) => event.type === "power_shift_applied")).toBe(true);
  });

  it("matches power-floor blocking to engine rejection", () => {
    const state = createInitialGameState({ seed: 42 });
    state.power = { weapons: 10, defence: 50, signal: 40, shiftCooldownTicks: 0 };
    const readiness = projectPowerShiftReadiness(state, "weapons", "signal");
    const result = stepGame(state, {
      ...NEUTRAL_TICK_FRAME,
      player: {
        ...NEUTRAL_TICK_FRAME.player,
        powerShift: { from: "weapons", to: "signal" },
      },
    });

    expect(readiness).toMatchObject({ ready: false, blockingReason: "power_floor" });
    expect(
      result.events.some(
        (event) => event.type === "action_rejected" && event.reason === "power_floor",
      ),
    ).toBe(true);
  });

  it("matches power-ceiling blocking to engine rejection", () => {
    const state = createInitialGameState({ seed: 42 });
    state.power = { weapons: 20, defence: 70, signal: 10, shiftCooldownTicks: 0 };
    const readiness = projectPowerShiftReadiness(state, "weapons", "defence");
    const result = stepGame(state, {
      ...NEUTRAL_TICK_FRAME,
      player: {
        ...NEUTRAL_TICK_FRAME.player,
        powerShift: { from: "weapons", to: "defence" },
      },
    });

    expect(readiness).toMatchObject({ ready: false, blockingReason: "power_ceiling" });
    expect(
      result.events.some(
        (event) => event.type === "action_rejected" && event.reason === "power_ceiling",
      ),
    ).toBe(true);
  });

  it("matches power-shift cooldown blocking to engine rejection", () => {
    const state = createInitialGameState({ seed: 42 });
    state.power.shiftCooldownTicks = 2;
    const readiness = projectPowerShiftReadiness(state, "weapons", "signal");
    const result = stepGame(state, {
      ...NEUTRAL_TICK_FRAME,
      player: {
        ...NEUTRAL_TICK_FRAME.player,
        powerShift: { from: "weapons", to: "signal" },
      },
    });

    expect(readiness).toMatchObject({ ready: false, blockingReason: "cooldown_active" });
    expect(
      result.events.some(
        (event) => event.type === "action_rejected" && event.reason === "cooldown_active",
      ),
    ).toBe(true);
  });

  it("projects accepted maximum player-projectile capacity without widening it", () => {
    const state = createInitialGameState({ seed: 42 });
    const observation = projectKtsActionSpace(state);
    expect(observation.constraints.maximumPlayerProjectiles).toBe(
      ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES,
    );
  });

  it("does not mutate action-space source state", () => {
    const state: GameState = createInitialGameState({ seed: 42 });
    const before = structuredClone(state);
    projectKtsActionSpace(state);
    expect(state).toEqual(before);
  });
});
