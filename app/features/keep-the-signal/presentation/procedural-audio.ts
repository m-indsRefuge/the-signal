import type { EngineEvent } from "../engine";

export const KTS_AUDIO_RECENT_CUE_LIMIT = 96;
export const KTS_AUDIO_DEFAULT_MASTER_VOLUME = 0.55;

const MIN_GAIN = 0.0001;

export type KtsAudioStatus = "locked" | "ready" | "suspended" | "unavailable" | "disposed";

export type KtsAudioCueKind =
  | "player-fire"
  | "enemy-fire"
  | "impact"
  | "enemy-destroyed"
  | "power-shift"
  | "action-rejected"
  | "recovery-pulse"
  | "defence-damaged"
  | "signal-damaged"
  | "collapse-started"
  | "collapse-averted"
  | "wave-started"
  | "wave-completed"
  | "encounter-completed"
  | "terminal";

export interface KtsAudioCue {
  readonly id: string;
  readonly kind: KtsAudioCueKind;
  readonly tick: number;
  readonly priority: "ordinary" | "important" | "critical";
}

export interface KtsAudioSnapshot {
  readonly status: KtsAudioStatus;
  readonly muted: boolean;
  readonly masterVolume: number;
  readonly contextCreated: boolean;
  readonly cuesAccepted: number;
  readonly cuesPlayed: number;
  readonly lastCue: KtsAudioCue | null;
  readonly disposed: boolean;
}

export interface KtsProceduralAudio {
  unlock(): Promise<KtsAudioSnapshot>;
  suspend(): Promise<KtsAudioSnapshot>;
  setMuted(muted: boolean): KtsAudioSnapshot;
  setMasterVolume(volume: number): KtsAudioSnapshot;
  consume(events: readonly Readonly<EngineEvent>[]): readonly KtsAudioCue[];
  dispose(): Promise<KtsAudioSnapshot>;
  snapshot(): KtsAudioSnapshot;
}

export interface CreateKtsProceduralAudioOptions {
  readonly contextFactory?: () => AudioContext;
  readonly masterVolume?: number;
  readonly muted?: boolean;
}

interface ToneDefinition {
  readonly wave: OscillatorType;
  readonly startFrequency: number;
  readonly endFrequency: number;
  readonly durationSeconds: number;
  readonly attackSeconds: number;
  readonly gain: number;
  readonly delaySeconds: number;
}

export function deriveKtsAudioCues(
  events: readonly Readonly<EngineEvent>[],
): readonly KtsAudioCue[] {
  if (!Array.isArray(events)) {
    throw new TypeError("events must be an array.");
  }

  const cues: KtsAudioCue[] = [];

  for (const event of events) {
    const cue = audioCueFromEvent(event);

    if (cue !== null) {
      cues.push(cue);
    }
  }

  return Object.freeze(cues);
}

export function createKtsProceduralAudio(
  options: CreateKtsProceduralAudioOptions = {},
): KtsProceduralAudio {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("Audio options must be an object.");
  }

  const initialVolume = options.masterVolume ?? KTS_AUDIO_DEFAULT_MASTER_VOLUME;
  assertVolume(initialVolume);

  if (options.muted !== undefined && typeof options.muted !== "boolean") {
    throw new TypeError("muted must be a boolean.");
  }

  if (options.contextFactory !== undefined && typeof options.contextFactory !== "function") {
    throw new TypeError("contextFactory must be a function.");
  }

  const nativeFactory = defaultAudioContextFactory();
  const contextFactory = options.contextFactory ?? nativeFactory;

  let context: AudioContext | null = null;
  let status: KtsAudioStatus = contextFactory === null ? "unavailable" : "locked";
  let muted = options.muted ?? false;
  let masterVolume = initialVolume;
  let cuesAccepted = 0;
  let cuesPlayed = 0;
  let lastCue: KtsAudioCue | null = null;
  let disposed = false;
  const consumedCueIds: string[] = [];
  const consumedCueIdSet = new Set<string>();

  const snapshot = (): KtsAudioSnapshot =>
    Object.freeze({
      status,
      muted,
      masterVolume,
      contextCreated: context !== null,
      cuesAccepted,
      cuesPlayed,
      lastCue,
      disposed,
    });

  const unlock = async (): Promise<KtsAudioSnapshot> => {
    assertNotDisposed();

    if (contextFactory === null) {
      status = "unavailable";
      return snapshot();
    }

    try {
      if (context === null) {
        context = contextFactory();
      }

      if (context.state === "suspended") {
        await context.resume();
      }

      status = context.state === "running" ? "ready" : "suspended";
    } catch {
      status = "unavailable";
      context = null;
    }

    return snapshot();
  };

  const suspend = async (): Promise<KtsAudioSnapshot> => {
    assertNotDisposed();

    if (context === null || status === "unavailable") {
      return snapshot();
    }

    try {
      if (context.state === "running") {
        await context.suspend();
      }

      status = context.state === "running" ? "ready" : "suspended";
    } catch {
      status = "suspended";
    }

    return snapshot();
  };

  const setMuted = (nextMuted: boolean): KtsAudioSnapshot => {
    assertNotDisposed();

    if (typeof nextMuted !== "boolean") {
      throw new TypeError("muted must be a boolean.");
    }

    muted = nextMuted;
    return snapshot();
  };

  const setMasterVolume = (nextVolume: number): KtsAudioSnapshot => {
    assertNotDisposed();
    assertVolume(nextVolume);
    masterVolume = nextVolume;
    return snapshot();
  };

  const consume = (events: readonly Readonly<EngineEvent>[]): readonly KtsAudioCue[] => {
    assertNotDisposed();

    const cues = deriveKtsAudioCues(events);
    const accepted: KtsAudioCue[] = [];

    for (const cue of cues) {
      if (consumedCueIdSet.has(cue.id)) {
        continue;
      }

      rememberCueId(cue.id);
      cuesAccepted += 1;
      lastCue = cue;
      accepted.push(cue);

      if (status !== "ready" || muted || context === null) {
        continue;
      }

      try {
        playCue(context, cue, masterVolume);
        cuesPlayed += 1;
      } catch {
        // Audio is ornamental and must never interrupt deterministic runtime execution.
      }
    }

    return Object.freeze(accepted);
  };

  const dispose = async (): Promise<KtsAudioSnapshot> => {
    if (disposed) {
      return snapshot();
    }

    disposed = true;
    status = "disposed";

    if (context !== null) {
      try {
        await context.close();
      } catch {
        // Disposal remains deterministic even if the browser rejects context closure.
      }
    }

    context = null;
    consumedCueIds.length = 0;
    consumedCueIdSet.clear();
    return snapshot();
  };

  function rememberCueId(cueId: string): void {
    consumedCueIds.push(cueId);
    consumedCueIdSet.add(cueId);

    while (consumedCueIds.length > KTS_AUDIO_RECENT_CUE_LIMIT) {
      const removed = consumedCueIds.shift();

      if (removed !== undefined) {
        consumedCueIdSet.delete(removed);
      }
    }
  }

  function assertNotDisposed(): void {
    if (disposed) {
      throw new Error("The procedural audio controller has been disposed.");
    }
  }

  return Object.freeze({
    unlock,
    suspend,
    setMuted,
    setMasterVolume,
    consume,
    dispose,
    snapshot,
  });
}

function audioCueFromEvent(event: Readonly<EngineEvent>): KtsAudioCue | null {
  switch (event.type) {
    case "projectile_fired":
      return createCue(event, "player-fire", "ordinary", String(event.projectileId));
    case "enemy_fired":
      return createCue(event, "enemy-fire", "ordinary", `${event.enemyId}:${event.projectileId}`);
    case "player_projectile_hit_enemy":
      return createCue(event, "impact", "ordinary", `${event.projectileId}:${event.enemyId}`);
    case "enemy_destroyed":
      return createCue(event, "enemy-destroyed", "important", String(event.enemyId));
    case "power_shift_applied":
      return createCue(event, "power-shift", "ordinary", `${event.from}:${event.to}`);
    case "action_rejected":
      return event.action === "power_shift" || event.action === "recovery_pulse"
        ? createCue(event, "action-rejected", "ordinary", `${event.action}:${event.reason}`)
        : null;
    case "recovery_pulse_applied":
      return createCue(event, "recovery-pulse", "important", "global");
    case "defence_damaged":
      return createCue(event, "defence-damaged", "important", event.sourceId);
    case "signal_damaged":
      return createCue(event, "signal-damaged", "important", event.sourceId);
    case "signal_collapse_started":
      return createCue(event, "collapse-started", "critical", "global");
    case "signal_collapse_averted":
      return createCue(event, "collapse-averted", "critical", "global");
    case "wave_started":
      return createCue(event, "wave-started", "important", String(event.waveNumber));
    case "wave_completed":
      return createCue(event, "wave-completed", "important", String(event.waveNumber));
    case "encounter_completed":
      return createCue(event, "encounter-completed", "critical", "global");
    case "game_terminated":
      return createCue(event, "terminal", "critical", event.reason);
    default:
      return null;
  }
}

function createCue(
  event: Readonly<EngineEvent>,
  kind: KtsAudioCueKind,
  priority: KtsAudioCue["priority"],
  suffix: string,
): KtsAudioCue {
  return Object.freeze({
    id: `${event.tick}:${event.type}:${suffix}`,
    kind,
    tick: event.tick,
    priority,
  });
}

function playCue(context: AudioContext, cue: Readonly<KtsAudioCue>, volume: number): void {
  const startTime = context.currentTime + 0.005;

  for (const tone of toneDefinitions(cue.kind)) {
    scheduleTone(context, tone, startTime, volume);
  }
}

function scheduleTone(
  context: AudioContext,
  tone: Readonly<ToneDefinition>,
  cueStartTime: number,
  masterVolume: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = cueStartTime + tone.delaySeconds;
  const attackEnd = start + tone.attackSeconds;
  const end = start + tone.durationSeconds;
  const peakGain = Math.max(MIN_GAIN, Math.min(1, tone.gain * masterVolume));

  oscillator.type = tone.wave;
  oscillator.frequency.setValueAtTime(tone.startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency), end);

  gain.gain.setValueAtTime(MIN_GAIN, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, attackEnd);
  gain.gain.exponentialRampToValueAtTime(MIN_GAIN, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.01);
}

function toneDefinitions(kind: KtsAudioCueKind): readonly ToneDefinition[] {
  switch (kind) {
    case "player-fire":
      return tones(tone("square", 760, 420, 0.07, 0.006, 0.16));
    case "enemy-fire":
      return tones(tone("sawtooth", 220, 145, 0.11, 0.008, 0.13));
    case "impact":
      return tones(tone("triangle", 180, 75, 0.12, 0.005, 0.2));
    case "enemy-destroyed":
      return tones(
        tone("sawtooth", 240, 70, 0.24, 0.008, 0.2),
        tone("triangle", 480, 120, 0.2, 0.006, 0.12, 0.025),
      );
    case "power-shift":
      return tones(
        tone("sine", 310, 465, 0.1, 0.012, 0.13),
        tone("sine", 465, 620, 0.1, 0.012, 0.1, 0.055),
      );
    case "action-rejected":
      return tones(
        tone("square", 170, 145, 0.07, 0.005, 0.1),
        tone("square", 145, 120, 0.07, 0.005, 0.08, 0.085),
      );
    case "recovery-pulse":
      return tones(
        tone("sine", 220, 440, 0.28, 0.02, 0.14),
        tone("sine", 330, 660, 0.3, 0.02, 0.1, 0.035),
      );
    case "defence-damaged":
      return tones(tone("square", 135, 95, 0.16, 0.006, 0.18));
    case "signal-damaged":
      return tones(
        tone("sawtooth", 420, 160, 0.22, 0.005, 0.17),
        tone("square", 84, 62, 0.2, 0.005, 0.08, 0.02),
      );
    case "collapse-started":
      return tones(
        tone("sawtooth", 330, 82, 0.55, 0.012, 0.2),
        tone("square", 165, 55, 0.6, 0.012, 0.1, 0.04),
      );
    case "collapse-averted":
      return tones(
        tone("sine", 196, 392, 0.26, 0.018, 0.14),
        tone("sine", 294, 588, 0.3, 0.018, 0.1, 0.03),
      );
    case "wave-started":
      return tones(
        tone("triangle", 220, 330, 0.18, 0.012, 0.12),
        tone("triangle", 330, 440, 0.2, 0.012, 0.09, 0.055),
      );
    case "wave-completed":
      return tones(
        tone("sine", 330, 495, 0.2, 0.015, 0.12),
        tone("sine", 495, 660, 0.22, 0.015, 0.09, 0.06),
      );
    case "encounter-completed":
      return tones(
        tone("sine", 262, 524, 0.38, 0.02, 0.13),
        tone("sine", 330, 660, 0.4, 0.02, 0.1, 0.04),
        tone("sine", 392, 784, 0.42, 0.02, 0.08, 0.08),
      );
    case "terminal":
      return tones(
        tone("sawtooth", 196, 49, 0.7, 0.015, 0.2),
        tone("square", 98, 36, 0.72, 0.015, 0.1, 0.05),
      );
  }
}

function tone(
  wave: OscillatorType,
  startFrequency: number,
  endFrequency: number,
  durationSeconds: number,
  attackSeconds: number,
  gain: number,
  delaySeconds = 0,
): ToneDefinition {
  return Object.freeze({
    wave,
    startFrequency,
    endFrequency,
    durationSeconds,
    attackSeconds,
    gain,
    delaySeconds,
  });
}

function tones(...definitions: readonly ToneDefinition[]): readonly ToneDefinition[] {
  return Object.freeze(definitions);
}

function defaultAudioContextFactory(): (() => AudioContext) | null {
  const constructors = globalThis as typeof globalThis & {
    readonly webkitAudioContext?: typeof AudioContext;
  };
  const Context = constructors.AudioContext ?? constructors.webkitAudioContext;

  return Context === undefined ? null : () => new Context();
}

function assertVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new RangeError("masterVolume must be a finite number between 0 and 1.");
  }
}
