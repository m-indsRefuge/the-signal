import { describe, expect, it } from "vitest";

import {
  createInitialGameState,
  type EngineEvent,
  type GameState,
} from "../app/features/keep-the-signal/engine";
import type { KtsRuntimeSnapshot } from "../app/features/keep-the-signal/runtime";
import {
  KTS_CANVAS_DPR_CAP,
  clampInterpolationAlpha,
  configureKtsCanvas,
  createCooldown,
  createKtsPresentationFrame,
  createKtsWorldTransform,
  createMeter,
  encounterPhaseLabel,
  interpolateWorldPosition,
  normalizeKtsPresentationViewport,
  projectKtsCanvasGeometry,
  projectKtsHud,
  renderKtsCanvas,
  runtimeLifecycleLabel,
  worldToScreen,
} from "../app/features/keep-the-signal/presentation";

describe("Keep the Signal KTS-I3 presentation projection", () => {
  it("caps rendering DPR at the accepted value", () => {
    expect(
      normalizeKtsPresentationViewport({
        cssWidth: 1280,
        cssHeight: 720,
        devicePixelRatio: 4,
      }).devicePixelRatio,
    ).toBe(KTS_CANVAS_DPR_CAP);
  });

  it.each([
    [0, 720, 1],
    [1280, 0, 1],
    [1280, 720, 0],
    [Number.NaN, 720, 1],
  ])(
    "rejects an invalid viewport %s × %s at DPR %s",
    (cssWidth: number, cssHeight: number, dpr: number) => {
      expect(() =>
        normalizeKtsPresentationViewport({
          cssWidth,
          cssHeight,
          devicePixelRatio: dpr,
        }),
      ).toThrow();
    },
  );

  it("creates a centered square field in a wide viewport", () => {
    const transform = createKtsWorldTransform({
      cssWidth: 1200,
      cssHeight: 700,
      devicePixelRatio: 1,
    });

    expect(transform.fieldSize).toBeLessThan(transform.cssWidth);
    expect(transform.fieldX).toBeGreaterThan(0);
    expect(transform.fieldY).toBeGreaterThanOrEqual(0);
  });

  it("creates a centered square field in a tall viewport", () => {
    const transform = createKtsWorldTransform({
      cssWidth: 500,
      cssHeight: 900,
      devicePixelRatio: 1,
    });

    expect(transform.fieldSize).toBeLessThan(transform.cssHeight);
    expect(transform.fieldY).toBeGreaterThan(0);
    expect(transform.fieldX).toBeGreaterThanOrEqual(0);
  });

  it("projects authoritative world corners onto the field boundary", () => {
    const transform = createKtsWorldTransform({
      cssWidth: 800,
      cssHeight: 800,
      devicePixelRatio: 1,
    });

    expect(worldToScreen(transform, 0, 0)).toEqual({
      x: transform.fieldX,
      y: transform.fieldY,
    });
    expect(worldToScreen(transform, 1_000_000, 1_000_000)).toEqual({
      x: transform.fieldX + transform.fieldSize,
      y: transform.fieldY + transform.fieldSize,
    });
  });

  it.each([
    [-1, 0],
    [0, 0],
    [0.5, 0.5],
    [1, 1],
    [2, 1],
    [Number.NaN, 0],
  ])("clamps interpolation alpha %s to %s", (input: number, expected: number) => {
    expect(clampInterpolationAlpha(input)).toBe(expected);
  });

  it("interpolates only between accepted visible positions", () => {
    expect(interpolateWorldPosition(0, 100, 100, 300, 0.25)).toEqual({
      x: 25,
      y: 150,
    });
  });

  it("creates frozen presentation frames with copied event lists", () => {
    const event: EngineEvent = {
      type: "signal_collapse_started",
      tick: 4,
    };
    const snapshot = createSnapshot({
      recentEvents: [event],
      lastTickEvents: [event],
    });
    const frame = createKtsPresentationFrame(snapshot, defaultViewport(), false);

    expect(Object.isFrozen(frame)).toBe(true);
    expect(Object.isFrozen(frame.recentEvents)).toBe(true);
    expect(frame.recentEvents).not.toBe(snapshot.recentEvents);
  });

  it("projects Signal and Defence integrity ratios", () => {
    const state = createInitialGameState({ seed: 7 });
    state.signal.integrity = 2_500;
    state.defence.integrity = 7_500;

    const hud = projectKtsHud(createFrameFromState(state));

    expect(hud.signal).toMatchObject({ value: 2_500, maximum: 10_000, ratio: 0.25, percent: 25 });
    expect(hud.defence).toMatchObject({ value: 7_500, maximum: 10_000, ratio: 0.75, percent: 75 });
  });

  it("clamps presentation meters without changing authoritative state", () => {
    expect(createMeter(12_000, 10_000)).toMatchObject({ value: 10_000, ratio: 1 });
    expect(createMeter(-20, 10_000)).toMatchObject({ value: 0, ratio: 0 });
  });

  it("projects ready and unavailable cooldown states", () => {
    expect(createCooldown(0, 12, "Power transfer")).toMatchObject({
      ratio: 0,
      ready: true,
      label: "Power transfer ready",
    });
    expect(createCooldown(6, 12, "Power transfer")).toMatchObject({
      ratio: 0.5,
      ready: false,
      label: "Power transfer unavailable for 6 ticks",
    });
  });

  it.each([
    ["active", "Wave active"],
    ["intermission", "Signal recalibration"],
    ["complete", "Encounter complete"],
  ] as const)(
    "labels encounter phase %s",
    (phase: "active" | "intermission" | "complete", expected: string) => {
      expect(encounterPhaseLabel(phase)).toBe(expected);
    },
  );

  it.each([
    ["idle", "Awaiting activation"],
    ["playing", "Signal engaged"],
    ["paused", "Session paused"],
    ["completed", "Encounter complete"],
    ["terminal", "Signal lost"],
    ["replaying", "Replay verification"],
  ] as const)(
    "labels runtime lifecycle %s",
    (
      lifecycle: "idle" | "playing" | "paused" | "completed" | "terminal" | "replaying",
      expected: string,
    ) => {
      expect(runtimeLifecycleLabel(lifecycle)).toBe(expected);
    },
  );

  it("projects encounter counters and total power", () => {
    const state = createInitialGameState({ seed: 9 });
    state.encounter.enemiesSpawned = 6;
    state.encounter.enemiesDefeated = 3;
    state.encounter.enemiesEscaped = 2;
    state.encounter.totalEnemiesDefeated = 11;
    state.encounter.totalEnemiesEscaped = 4;

    const hud = projectKtsHud(createFrameFromState(state));

    expect(hud.encounter).toMatchObject({
      enemiesScheduled: 8,
      enemiesSpawned: 6,
      enemiesDefeated: 3,
      enemiesEscaped: 2,
      enemiesResolved: 5,
      totalDefeated: 11,
      totalEscaped: 4,
    });
    expect(hud.power.total).toBe(100);
  });

  it("projects run identity and final digest visibility", () => {
    const snapshot = createSnapshot({ finalDigest: "58211ef2" });
    const hud = projectKtsHud(createKtsPresentationFrame(snapshot, defaultViewport(), false));

    expect(hud.seed).toBe(snapshot.seed);
    expect(hud.engineVersion).toBe("kts-i2.0.0");
    expect(hud.rulesetVersion).toBe("kts-foundation-0.1");
    expect(hud.finalDigest).toBe("58211ef2");
    expect(hud.accessibleSummary).toContain("Final digest 58211ef2.");
  });

  it("adds timing interruption and replay fault to the accessible summary", () => {
    const snapshot = createSnapshot({
      timingInterrupted: true,
      replayFault: "digest_mismatch",
    });
    const hud = projectKtsHud(createKtsPresentationFrame(snapshot, defaultViewport(), false));

    expect(hud.accessibleSummary).toContain("Timing interruption requires explicit resume.");
    expect(hud.accessibleSummary).toContain("Replay integrity fault: digest_mismatch.");
  });

  it("produces a stable accessible state summary", () => {
    const hud = projectKtsHud(createFrameFromState(createInitialGameState({ seed: 123 })));

    expect(hud.accessibleSummary).toBe(
      "Awaiting activation. Signal 100 percent. Defence 100 percent. Score 0. Coherence 0 ticks, longest 0. Wave 1 of 5, wave active. 0 of 8 current-wave hostiles resolved. Seed 123.",
    );
  });

  it("interpolates the player and matching stable enemy IDs", () => {
    const previous = createInitialGameState({ seed: 1 });
    const current = structuredClone(previous) as GameState;
    previous.player.positionX = 100;
    current.player.positionX = 300;
    previous.enemies.push(createEnemy(1, "scout", 100, 100));
    current.enemies.push(createEnemy(1, "scout", 300, 500));

    const geometry = projectKtsCanvasGeometry(createFrameFromStates(previous, current, 0.5));

    expect(geometry.player.x).toBe(200);
    expect(geometry.enemies[0]).toMatchObject({ x: 200, y: 300 });
  });

  it("renders newly spawned entities at their current position", () => {
    const previous = createInitialGameState({ seed: 1 });
    const current = structuredClone(previous) as GameState;
    current.enemies.push(createEnemy(2, "interceptor", 400, 600));

    expect(
      projectKtsCanvasGeometry(createFrameFromStates(previous, current, 0.25)).enemies[0],
    ).toMatchObject({
      x: 400,
      y: 600,
    });
  });

  it("omits entities removed from current authoritative geometry", () => {
    const previous = createInitialGameState({ seed: 1 });
    const current = structuredClone(previous) as GameState;
    previous.enemies.push(createEnemy(3, "disruptor", 500, 500));

    expect(projectKtsCanvasGeometry(createFrameFromStates(previous, current, 0.5)).enemies).toEqual(
      [],
    );
  });

  it("interpolates both projectile classes by stable ID", () => {
    const previous = createInitialGameState({ seed: 1 });
    const current = structuredClone(previous) as GameState;
    previous.projectiles.push(createProjectile(1, 100, 200));
    current.projectiles.push(createProjectile(1, 300, 400));
    previous.enemyProjectiles.push(createEnemyProjectile(1, "kinetic", 600, 100));
    current.enemyProjectiles.push(createEnemyProjectile(1, "kinetic", 800, 300));

    const geometry = projectKtsCanvasGeometry(createFrameFromStates(previous, current, 0.5));

    expect(geometry.playerProjectiles[0]).toMatchObject({ x: 200, y: 300 });
    expect(geometry.enemyProjectiles[0]).toMatchObject({ x: 700, y: 200, kind: "kinetic" });
  });

  it("configures backing dimensions and CSS dimensions without touching game state", () => {
    const canvas = fakeCanvas();
    const transform = configureKtsCanvas(canvas, {
      cssWidth: 640,
      cssHeight: 360,
      devicePixelRatio: 3,
    });

    expect(canvas.width).toBe(1_280);
    expect(canvas.height).toBe(720);
    expect(canvas.style.width).toBe("640px");
    expect(canvas.style.height).toBe("360px");
    expect(transform.devicePixelRatio).toBe(2);
  });

  it("renders one authoritative player and reports bounded entity counts", () => {
    const state = createInitialGameState({ seed: 11 });
    state.enemies.push(createEnemy(1, "scout", 200_000, 200_000));
    state.projectiles.push(createProjectile(1, 500_000, 400_000));
    state.enemyProjectiles.push(createEnemyProjectile(1, "corruption", 500_000, 300_000));
    const context = fakeContext();

    const summary = renderKtsCanvas(
      context as unknown as CanvasRenderingContext2D,
      createFrameFromState(state),
    );

    expect(summary).toMatchObject({
      playerCount: 1,
      enemyCount: 1,
      playerProjectileCount: 1,
      enemyProjectileCount: 1,
    });
    expect(context.calls).toContain("setTransform");
    expect(context.calls).toContain("strokeRect");
  });
});

function defaultViewport() {
  return { cssWidth: 960, cssHeight: 720, devicePixelRatio: 1 } as const;
}

function createFrameFromState(state: GameState) {
  return createKtsPresentationFrame(
    createSnapshot({ currentState: state, previousState: state }),
    defaultViewport(),
    false,
  );
}

function createFrameFromStates(previousState: GameState, currentState: GameState, alpha: number) {
  return createKtsPresentationFrame(
    createSnapshot({ previousState, currentState, interpolationAlpha: alpha }),
    defaultViewport(),
    false,
  );
}

function createSnapshot(
  overrides: {
    previousState?: GameState;
    currentState?: GameState;
    interpolationAlpha?: number;
    recentEvents?: readonly EngineEvent[];
    lastTickEvents?: readonly EngineEvent[];
    finalDigest?: string | null;
    timingInterrupted?: boolean;
    replayFault?: "digest_mismatch" | null;
  } = {},
): KtsRuntimeSnapshot {
  const currentState = overrides.currentState ?? createInitialGameState({ seed: 123 });
  const previousState = overrides.previousState ?? currentState;
  const finalDigest = overrides.finalDigest ?? null;
  const replayFault = overrides.replayFault ?? null;

  return {
    lifecycle: "idle",
    seed: currentState.seed,
    previousState,
    currentState,
    loop: {
      accumulatorMs: 0,
      interpolationAlpha: overrides.interpolationAlpha ?? 0,
      pendingTicks: 0,
      totalTicksProcessed: 0,
      paused: false,
      pauseReason: null,
      disposed: false,
    },
    input: {
      left: false,
      right: false,
      up: false,
      down: false,
      fire: false,
      recoveryPulseQueued: false,
      queuedPowerShifts: [],
    },
    recentEvents: overrides.recentEvents ?? [],
    lastTickEvents: overrides.lastTickEvents ?? [],
    sessionFrameCount: 0,
    sessionRecord:
      finalDigest === null
        ? null
        : {
            engineVersion: currentState.engineVersion,
            rulesetVersion: currentState.rulesetVersion,
            seed: currentState.seed,
            frames: [],
            finalCanonicalState: "{}",
            finalDigest,
            outcome: "completed",
          },
    replayVerification:
      replayFault === null
        ? null
        : {
            ok: false,
            reason: replayFault,
            processedTicks: 0,
            expected: "expected",
            actual: "actual",
            state: currentState,
          },
    replayFrameIndex: 0,
    replayFrameCount: 0,
    timingInterrupted: overrides.timingInterrupted ?? false,
    resumeLifecycle: null,
    disposed: false,
  };
}

function createEnemy(
  id: number,
  archetype: "scout" | "interceptor" | "disruptor",
  positionX: number,
  positionY: number,
) {
  return {
    id,
    archetype,
    positionX,
    positionY,
    velocityX: 0,
    velocityY: 0,
    radius: 14_000,
    integrity: 1_000,
    maximumIntegrity: 1_000,
    fireCooldownTicks: 0,
    fireIntervalTicks: 0,
    destructionScore: 100,
    escapeDefenceDamage: 0,
    escapeSignalDamage: 0,
  };
}

function createProjectile(id: number, positionX: number, positionY: number) {
  return {
    id,
    positionX,
    positionY,
    velocityX: 0,
    velocityY: -1,
    radius: 4_000,
    remainingTicks: 10,
  };
}

function createEnemyProjectile(
  id: number,
  kind: "kinetic" | "corruption",
  positionX: number,
  positionY: number,
) {
  return {
    id,
    ownerEnemyId: 1,
    kind,
    positionX,
    positionY,
    velocityX: 0,
    velocityY: 1,
    radius: 5_000,
    rawDamage: 100,
    remainingTicks: 10,
  };
}

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: { width: "", height: "" },
  } as unknown as HTMLCanvasElement;
}

function fakeContext() {
  const calls: string[] = [];
  const context: Record<string, unknown> = { calls };
  const methods = [
    "save",
    "restore",
    "setTransform",
    "clearRect",
    "fillRect",
    "strokeRect",
    "beginPath",
    "moveTo",
    "lineTo",
    "closePath",
    "stroke",
    "fill",
    "translate",
    "arc",
    "rect",
  ];

  for (const method of methods) {
    context[method] = (): void => {
      calls.push(method);
    };
  }

  return context as {
    calls: string[];
  } & Record<string, unknown>;
}
