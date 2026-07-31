import { describe, expect, it, vi } from "vitest";

import type { EngineEvent } from "../app/features/keep-the-signal/engine";
import {
  KTS_AUDIO_DEFAULT_MASTER_VOLUME,
  KTS_AUDIO_RECENT_CUE_LIMIT,
  createKtsProceduralAudio,
  deriveKtsAudioCues,
  type KtsAudioCueKind,
} from "../app/features/keep-the-signal/presentation";

class FakeAudioParam {
  readonly setValueAtTime = vi.fn();
  readonly exponentialRampToValueAtTime = vi.fn();
}

class FakeOscillator {
  type: OscillatorType = "sine";
  readonly frequency = new FakeAudioParam();
  readonly connect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeGain {
  readonly gain = new FakeAudioParam();
  readonly connect = vi.fn();
}

class FakeAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 10;
  readonly destination = {} as AudioDestinationNode;
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];
  readonly resume = vi.fn(async (): Promise<void> => {
    this.state = "running";
  });
  readonly suspend = vi.fn(async (): Promise<void> => {
    this.state = "suspended";
  });
  readonly close = vi.fn(async (): Promise<void> => {
    this.state = "closed";
  });

  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  createGain(): GainNode {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }
}

const CUE_CASES: readonly [EngineEvent, KtsAudioCueKind][] = [
  [event("projectile_fired", { projectileId: 1 }), "player-fire"],
  [
    event("enemy_fired", {
      enemyId: 2,
      projectileId: 3,
      projectileKind: "kinetic",
      positionX: 1,
      positionY: 2,
      rawDamage: 400,
    }),
    "enemy-fire",
  ],
  [
    event("player_projectile_hit_enemy", {
      projectileId: 4,
      enemyId: 5,
      rawDamage: 1_000,
      effectiveDamage: 1_000,
    }),
    "impact",
  ],
  [
    event("enemy_destroyed", {
      enemyId: 6,
      archetype: "scout",
      projectileId: 7,
    }),
    "enemy-destroyed",
  ],
  [
    event("power_shift_applied", {
      from: "defence",
      to: "weapons",
      amount: 5,
    }),
    "power-shift",
  ],
  [
    event("action_rejected", {
      action: "power_shift",
      reason: "cooldown_active",
    }),
    "action-rejected",
  ],
  [
    event("recovery_pulse_applied", {
      signalRestored: 1_200,
      defenceRestored: 600,
    }),
    "recovery-pulse",
  ],
  [
    event("defence_damaged", {
      sourceId: "impact:1",
      rawDamage: 400,
      effectiveDamage: 300,
    }),
    "defence-damaged",
  ],
  [
    event("signal_damaged", {
      sourceId: "corruption:1",
      source: "corruption",
      rawDamage: 650,
      effectiveDamage: 500,
    }),
    "signal-damaged",
  ],
  [event("signal_collapse_started"), "collapse-started"],
  [event("signal_collapse_averted"), "collapse-averted"],
  [event("wave_started", { waveNumber: 2, enemiesScheduled: 10 }), "wave-started"],
  [
    event("wave_completed", {
      waveNumber: 2,
      enemiesDefeated: 8,
      enemiesEscaped: 2,
      totalEnemiesDefeated: 14,
      totalEnemiesEscaped: 4,
    }),
    "wave-completed",
  ],
  [
    event("encounter_completed", {
      totalEnemiesDefeated: 52,
      totalEnemiesEscaped: 8,
    }),
    "encounter-completed",
  ],
  [event("game_terminated", { reason: "signal_collapse" }), "terminal"],
];

describe("Keep the Signal KTS-I3 procedural audio", () => {
  it("uses the accepted bounded cue history and default volume", () => {
    expect(KTS_AUDIO_RECENT_CUE_LIMIT).toBe(96);
    expect(KTS_AUDIO_DEFAULT_MASTER_VOLUME).toBe(0.55);
  });

  it.each(CUE_CASES)(
    "maps %s to its procedural cue",
    (sourceEvent: EngineEvent, expectedKind: KtsAudioCueKind) => {
      const cues = deriveKtsAudioCues([sourceEvent]);

      expect(cues).toHaveLength(1);
      expect(cues[0]?.kind).toBe(expectedKind);
      expect(Object.isFrozen(cues[0])).toBe(true);
    },
  );

  it("ignores non-audible bookkeeping events", () => {
    const cues = deriveKtsAudioCues([
      event("score_added", {
        amount: 1,
        integrityTier: 1,
        coherenceMultiplier: 1,
      }),
      event("projectile_expired", { projectileId: 1, reason: "lifetime" }),
      event("defence_recovered", { amount: 10 }),
    ]);

    expect(cues).toHaveLength(0);
  });

  it("ignores ordinary fire cooldown rejection", () => {
    const cues = deriveKtsAudioCues([
      event("action_rejected", {
        action: "fire",
        reason: "cooldown_active",
      }),
    ]);

    expect(cues).toHaveLength(0);
  });

  it("creates stable event-derived cue identities", () => {
    const source = event("projectile_fired", { projectileId: 9 }, 44);
    const first = deriveKtsAudioCues([source]);
    const second = deriveKtsAudioCues([source]);

    expect(first[0]?.id).toBe("44:projectile_fired:9");
    expect(second[0]?.id).toBe(first[0]?.id);
  });

  it("does not create an AudioContext before explicit unlock", () => {
    const factory = vi.fn(() => new FakeAudioContext() as unknown as AudioContext);
    const audio = createKtsProceduralAudio({ contextFactory: factory });

    expect(audio.snapshot().status).toBe("locked");
    expect(audio.snapshot().contextCreated).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });

  it("creates and resumes audio only after explicit unlock", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    const snapshot = await audio.unlock();

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(snapshot.status).toBe("ready");
    expect(snapshot.contextCreated).toBe(true);
  });

  it("reports unavailable when context creation fails", async () => {
    const audio = createKtsProceduralAudio({
      contextFactory: () => {
        throw new Error("blocked");
      },
    });

    expect((await audio.unlock()).status).toBe("unavailable");
  });

  it("accepts cues while locked without playing them", () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    const accepted = audio.consume([event("projectile_fired", { projectileId: 1 })]);

    expect(accepted).toHaveLength(1);
    expect(audio.snapshot().cuesAccepted).toBe(1);
    expect(audio.snapshot().cuesPlayed).toBe(0);
    expect(context.oscillators).toHaveLength(0);
  });

  it("plays deterministic oscillator envelopes after unlock", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    await audio.unlock();
    audio.consume([event("projectile_fired", { projectileId: 1 })]);

    expect(audio.snapshot().cuesPlayed).toBe(1);
    expect(context.oscillators).toHaveLength(1);
    expect(context.gains).toHaveLength(1);
    expect(context.oscillators[0]?.start).toHaveBeenCalledTimes(1);
    expect(context.oscillators[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it("deduplicates cue identities across repeated recent-event windows", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });
    const source = event("projectile_fired", { projectileId: 1 });

    await audio.unlock();
    expect(audio.consume([source])).toHaveLength(1);
    expect(audio.consume([source])).toHaveLength(0);
    expect(audio.snapshot().cuesPlayed).toBe(1);
  });

  it("does not defer muted cues for later playback", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
      muted: true,
    });
    const source = event("projectile_fired", { projectileId: 1 });

    await audio.unlock();
    audio.consume([source]);
    audio.setMuted(false);
    audio.consume([source]);

    expect(audio.snapshot().cuesAccepted).toBe(1);
    expect(audio.snapshot().cuesPlayed).toBe(0);
  });

  it("updates mute state without changing audio readiness", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    await audio.unlock();
    const muted = audio.setMuted(true);

    expect(muted.muted).toBe(true);
    expect(muted.status).toBe("ready");
  });

  it.each([-1, 1.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid master volume %s",
    (volume: number) => {
      expect(() => createKtsProceduralAudio({ masterVolume: volume })).toThrow("between 0 and 1");
    },
  );

  it("accepts master volume endpoints", () => {
    const audio = createKtsProceduralAudio({
      contextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    expect(audio.setMasterVolume(0).masterVolume).toBe(0);
    expect(audio.setMasterVolume(1).masterVolume).toBe(1);
  });

  it("suspends an unlocked running context", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    await audio.unlock();
    const snapshot = await audio.suspend();

    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(snapshot.status).toBe("suspended");
  });

  it("unlocks a previously suspended context again", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    await audio.unlock();
    await audio.suspend();
    await audio.unlock();

    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(audio.snapshot().status).toBe("ready");
  });

  it("swallows ornamental synthesis failures", async () => {
    const context = new FakeAudioContext();
    context.createOscillator = (): OscillatorNode => {
      throw new Error("audio device failed");
    };
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    await audio.unlock();

    expect(() => audio.consume([event("projectile_fired", { projectileId: 1 })])).not.toThrow();
    expect(audio.snapshot().cuesAccepted).toBe(1);
    expect(audio.snapshot().cuesPlayed).toBe(0);
  });

  it("closes its context and becomes disposed", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    await audio.unlock();
    const snapshot = await audio.dispose();

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(snapshot.status).toBe("disposed");
    expect(snapshot.disposed).toBe(true);
  });

  it("disposes idempotently", async () => {
    const context = new FakeAudioContext();
    const audio = createKtsProceduralAudio({
      contextFactory: () => context as unknown as AudioContext,
    });

    await audio.unlock();
    await audio.dispose();
    await audio.dispose();

    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("rejects mutation after disposal", async () => {
    const audio = createKtsProceduralAudio({
      contextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    await audio.dispose();

    expect(() => audio.setMuted(true)).toThrow("disposed");
    expect(() => audio.consume([])).toThrow("disposed");
  });
});

function event(
  type: EngineEvent["type"],
  fields: Record<string, unknown> = {},
  tick = 12,
): EngineEvent {
  return { type, tick, ...fields } as EngineEvent;
}
