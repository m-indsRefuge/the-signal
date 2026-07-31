import { describe, expect, it } from "vitest";

import {
  createInitialGameState,
  type EngineEvent,
  type GameState,
} from "../app/features/keep-the-signal/engine";
import type { KtsRuntimeSnapshot } from "../app/features/keep-the-signal/runtime";
import {
  KTS_HUD_EVENT_LIMIT,
  KTS_MAX_VISUAL_EFFECTS,
  createKtsPresentationFrame,
  deriveKtsVisualEffects,
  projectKtsHud,
  projectKtsHudEvent,
  projectKtsHudEvents,
} from "../app/features/keep-the-signal/presentation";

describe("Keep the Signal KTS-I3 presentation events", () => {
  it("ignores ordinary score ticks", () => {
    expect(
      projectKtsHudEvent({
        type: "score_added",
        tick: 1,
        amount: 10,
        integrityTier: 4,
        coherenceMultiplier: 1,
      }),
    ).toBeNull();
  });

  it("bounds the visible event feed at twelve records", () => {
    const events: EngineEvent[] = Array.from({ length: 20 }, (_, index) => ({
      type: "projectile_fired",
      tick: index,
      projectileId: index + 1,
    }));

    const projected = projectKtsHudEvents(events);

    expect(projected).toHaveLength(KTS_HUD_EVENT_LIMIT);
    expect(projected[0].tick).toBe(8);
    expect(projected.at(-1)?.tick).toBe(19);
  });

  it("maps wave start to a critical accessible announcement", () => {
    expect(
      projectKtsHudEvent({
        type: "wave_started",
        tick: 10,
        waveNumber: 3,
        enemiesScheduled: 12,
      }),
    ).toMatchObject({
      tone: "signal",
      critical: true,
      label: "Wave 3 started · 12 hostiles",
      announcement: "Wave 3 started. 12 hostiles scheduled.",
    });
  });

  it("maps wave completion to success", () => {
    expect(
      projectKtsHudEvent({
        type: "wave_completed",
        tick: 20,
        waveNumber: 2,
        enemiesDefeated: 8,
        enemiesEscaped: 2,
        totalEnemiesDefeated: 14,
        totalEnemiesEscaped: 4,
      }),
    ).toMatchObject({ tone: "success", critical: true, label: "Wave 2 complete" });
  });

  it("maps enemy escape to danger", () => {
    expect(
      projectKtsHudEvent({
        type: "enemy_escaped",
        tick: 30,
        enemyId: 7,
        archetype: "interceptor",
        positionY: 1_010_000,
        defenceRawDamage: 500,
        signalRawDamage: 200,
      }),
    ).toMatchObject({
      tone: "danger",
      critical: true,
      announcement: "Hostile 7 escaped the field.",
    });
  });

  it("maps recovery pulse restoration values", () => {
    expect(
      projectKtsHudEvent({
        type: "recovery_pulse_applied",
        tick: 40,
        signalRestored: 1_200,
        defenceRestored: 600,
      }),
    ).toMatchObject({
      tone: "signal",
      label: "Recovery pulse · +1200 Signal · +600 Defence",
      critical: true,
    });
  });

  it("announces rejected power transfers but not ordinary fire cooldown rejection", () => {
    const transfer = projectKtsHudEvent({
      type: "action_rejected",
      tick: 50,
      action: "power_shift",
      reason: "cooldown_active",
    });
    const fire = projectKtsHudEvent({
      type: "action_rejected",
      tick: 51,
      action: "fire",
      reason: "cooldown_active",
    });

    expect(transfer).toMatchObject({ critical: true, tone: "warning" });
    expect(transfer?.announcement).toContain("Power transfer rejected");
    expect(fire).toMatchObject({ critical: false, tone: "neutral", announcement: null });
  });

  it.each([
    ["signal_collapse_started", "Warning. Signal collapse sequence started.", "danger"],
    ["signal_collapse_averted", "Signal collapse averted.", "success"],
  ] as const)(
    "maps %s to a critical announcement",
    (
      type: "signal_collapse_started" | "signal_collapse_averted",
      announcement: string,
      tone: string,
    ) => {
      expect(projectKtsHudEvent({ type, tick: 60 } as EngineEvent)).toMatchObject({
        announcement,
        tone,
        critical: true,
      });
    },
  );

  it("maps encounter completion totals", () => {
    expect(
      projectKtsHudEvent({
        type: "encounter_completed",
        tick: 70,
        totalEnemiesDefeated: 52,
        totalEnemiesEscaped: 8,
      }),
    ).toMatchObject({
      announcement: "Encounter complete. 52 hostiles defeated and 8 escaped.",
      tone: "success",
    });
  });

  it("maps terminal failure to the strongest danger announcement", () => {
    expect(
      projectKtsHudEvent({
        type: "game_terminated",
        tick: 80,
        reason: "signal_collapse",
      }),
    ).toMatchObject({
      label: "Signal lost",
      announcement: "Signal lost. Session terminated.",
      tone: "danger",
      critical: true,
    });
  });

  it("selects the newest available announcement", () => {
    const events: EngineEvent[] = [
      { type: "wave_started", tick: 1, waveNumber: 1, enemiesScheduled: 8 },
      { type: "projectile_fired", tick: 2, projectileId: 1 },
      { type: "signal_collapse_started", tick: 3 },
    ];
    const hud = projectKtsHud(createFrame(events));

    expect(hud.latestAnnouncement).toBe("Warning. Signal collapse sequence started.");
  });

  it.each([
    ["projectile_fired", "player-fire"],
    ["player_projectile_hit_enemy", "impact-ring"],
    ["enemy_projectile_hit_player", "impact-ring"],
    ["enemy_destroyed", "enemy-destruction"],
    ["defence_damaged", "defence-hit"],
    ["signal_damaged", "signal-hit"],
    ["signal_collapse_started", "collapse-warning"],
    ["wave_started", "wave-transmission"],
    ["wave_completed", "wave-sweep"],
    ["encounter_completed", "encounter-convergence"],
  ] as const)("maps %s to visual effect %s", (eventType: string, effectKind: string) => {
    const event = eventForType(eventType, 100);
    const frame = createFrame([event], { tick: 100 });

    expect(deriveKtsVisualEffects(frame)[0]).toMatchObject({
      kind: effectKind,
      sourceTick: 100,
    });
  });

  it("expires visual effects after their bounded lifetime", () => {
    const frame = createFrame([{ type: "projectile_fired", tick: 1, projectileId: 1 }], {
      tick: 20,
    });

    expect(deriveKtsVisualEffects(frame)).toEqual([]);
  });

  it("suppresses ornamental effects under reduced motion", () => {
    const event: EngineEvent = {
      type: "enemy_destroyed",
      tick: 10,
      enemyId: 3,
      archetype: "disruptor",
      projectileId: 2,
    };

    expect(deriveKtsVisualEffects(createFrame([event], { tick: 10 }, true))).toEqual([]);
  });

  it("retains simplified critical warning effects under reduced motion", () => {
    const event: EngineEvent = { type: "signal_collapse_started", tick: 10 };
    const effects = deriveKtsVisualEffects(createFrame([event], { tick: 10 }, true));

    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ kind: "collapse-warning", simplified: true });
  });

  it("bounds visual effects even when more events are supplied", () => {
    const events: EngineEvent[] = Array.from({ length: 40 }, (_, index) => ({
      type: "projectile_fired",
      tick: 100,
      projectileId: index + 1,
    }));

    expect(deriveKtsVisualEffects(createFrame(events, { tick: 100 }))).toHaveLength(
      KTS_MAX_VISUAL_EFFECTS,
    );
  });

  it("positions destruction effects from the previous authoritative enemy", () => {
    const previous = createInitialGameState({ seed: 1 });
    const current = structuredClone(previous) as GameState;
    previous.tick = 4;
    current.tick = 5;
    previous.enemies.push(createEnemy(9, 222_000, 333_000));
    const event: EngineEvent = {
      type: "enemy_destroyed",
      tick: 5,
      enemyId: 9,
      archetype: "scout",
      projectileId: 1,
    };

    const effect = deriveKtsVisualEffects(
      createFrame([event], { previousState: previous, currentState: current }),
    )[0];

    expect(effect).toMatchObject({ x: 222_000, y: 333_000 });
  });

  it("positions player damage effects at the current player", () => {
    const state = createInitialGameState({ seed: 1 });
    state.tick = 12;
    state.player.positionX = 444_000;
    state.player.positionY = 777_000;
    const event: EngineEvent = {
      type: "defence_damaged",
      tick: 12,
      sourceId: "impact",
      rawDamage: 100,
      effectiveDamage: 80,
    };

    expect(deriveKtsVisualEffects(createFrame([event], { currentState: state }))[0]).toMatchObject({
      x: 444_000,
      y: 777_000,
    });
  });

  it("creates stable event identities from ticks and entity identifiers", () => {
    const event: EngineEvent = {
      type: "enemy_destroyed",
      tick: 15,
      enemyId: 6,
      archetype: "scout",
      projectileId: 2,
    };

    expect(projectKtsHudEvent(event)?.id).toBe("15:enemy_destroyed:6");
    expect(deriveKtsVisualEffects(createFrame([event], { tick: 15 }))[0].id).toBe(
      "15:enemy_destroyed:6",
    );
  });

  it("does not derive effects from nonvisual bookkeeping events", () => {
    const event: EngineEvent = {
      type: "power_shift_applied",
      tick: 1,
      from: "weapons",
      to: "signal",
      amount: 5,
    };

    expect(deriveKtsVisualEffects(createFrame([event], { tick: 1 }))).toEqual([]);
  });
});

function createFrame(
  recentEvents: readonly EngineEvent[],
  options: {
    tick?: number;
    previousState?: GameState;
    currentState?: GameState;
  } = {},
  reducedMotion = false,
) {
  const currentState = options.currentState ?? createInitialGameState({ seed: 123 });
  currentState.tick = options.tick ?? currentState.tick;
  const previousState = options.previousState ?? currentState;

  return createKtsPresentationFrame(
    createSnapshot(previousState, currentState, recentEvents),
    { cssWidth: 960, cssHeight: 720, devicePixelRatio: 1 },
    reducedMotion,
  );
}

function createSnapshot(
  previousState: GameState,
  currentState: GameState,
  recentEvents: readonly EngineEvent[],
): KtsRuntimeSnapshot {
  return {
    lifecycle: "playing",
    seed: currentState.seed,
    previousState,
    currentState,
    loop: {
      accumulatorMs: 0,
      interpolationAlpha: 0,
      pendingTicks: 0,
      totalTicksProcessed: currentState.tick,
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
    recentEvents,
    lastTickEvents: recentEvents,
    sessionFrameCount: currentState.tick,
    sessionRecord: null,
    replayVerification: null,
    replayFrameIndex: 0,
    replayFrameCount: 0,
    timingInterrupted: false,
    resumeLifecycle: null,
    disposed: false,
  };
}

function eventForType(type: string, tick: number): EngineEvent {
  switch (type) {
    case "projectile_fired":
      return { type, tick, projectileId: 1 };
    case "player_projectile_hit_enemy":
      return { type, tick, projectileId: 1, enemyId: 1, rawDamage: 1_000, effectiveDamage: 1_000 };
    case "enemy_projectile_hit_player":
      return {
        type,
        tick,
        projectileId: 2,
        ownerEnemyId: 1,
        projectileKind: "kinetic",
        target: "defence",
        rawDamage: 400,
      };
    case "enemy_destroyed":
      return { type, tick, enemyId: 1, archetype: "scout", projectileId: 1 };
    case "defence_damaged":
      return { type, tick, sourceId: "impact", rawDamage: 100, effectiveDamage: 80 };
    case "signal_damaged":
      return {
        type,
        tick,
        sourceId: "corruption",
        source: "corruption",
        rawDamage: 100,
        effectiveDamage: 80,
      };
    case "signal_collapse_started":
      return { type, tick };
    case "wave_started":
      return { type, tick, waveNumber: 2, enemiesScheduled: 10 };
    case "wave_completed":
      return {
        type,
        tick,
        waveNumber: 2,
        enemiesDefeated: 8,
        enemiesEscaped: 2,
        totalEnemiesDefeated: 14,
        totalEnemiesEscaped: 4,
      };
    case "encounter_completed":
      return { type, tick, totalEnemiesDefeated: 52, totalEnemiesEscaped: 8 };
    default:
      throw new Error(`Unsupported event type ${type}`);
  }
}

function createEnemy(id: number, positionX: number, positionY: number) {
  return {
    id,
    archetype: "scout" as const,
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
