import { useEffect, useRef } from "react";

const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 320;
const DISPLAY_POINT_COUNT = 320;
const FRAME_INTERVAL_MS = 1000 / 60;
const SOURCE_SAMPLE_RATE = 120;
const SOURCE_SAMPLE_INTERVAL = 1 / SOURCE_SAMPLE_RATE;
const VISIBLE_HISTORY_SECONDS = 10.5;
const HISTORY_SAMPLE_COUNT =
  Math.ceil(VISIBLE_HISTORY_SECONDS * SOURCE_SAMPLE_RATE) + 4;
const MAX_SAMPLES_PER_FRAME = 30;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const ENVELOPE_ATTACK_SECONDS = 0.075;
const ENVELOPE_HOLD_SECONDS = 0.1;
const ENVELOPE_RELEASE_SECONDS = 0.45;
const CYAN_DELAY_SAMPLES = 4;
const PINK_DELAY_SAMPLES = 9;

const EVENT_CYCLE_DURATIONS = [16.4, 18.25, 14.8, 19.1] as const;
const EVENT_APPROACH_DURATION = 2;
const EVENT_BUILD_DURATION = 1.6;
const EVENT_PEAK_DURATION = 0.55;
const EVENT_RELEASE_DURATION = 2.5;
const EVENT_RECOVERY_DURATION = 3.6;
const EVENT_ACTIVE_DURATION =
  EVENT_APPROACH_DURATION +
  EVENT_BUILD_DURATION +
  EVENT_PEAK_DURATION +
  EVENT_RELEASE_DURATION +
  EVENT_RECOVERY_DURATION;
const EVENT_CYCLE_TOTAL = EVENT_CYCLE_DURATIONS.reduce(
  (total, duration) => total + duration,
  0,
);

const COUPLING_CYCLE_DURATIONS = [13.2, 15.6, 14.4, 17.1] as const;
const COUPLING_APPROACH_DURATION = 1.4;
const COUPLING_CONVERGENCE_DURATION = 1.5;
const COUPLING_COHERENCE_DURATION = 1.05;
const COUPLING_RELEASE_DURATION = 2.1;
const COUPLING_RECOVERY_DURATION = 1.35;
const COUPLING_ACTIVE_DURATION =
  COUPLING_APPROACH_DURATION +
  COUPLING_CONVERGENCE_DURATION +
  COUPLING_COHERENCE_DURATION +
  COUPLING_RELEASE_DURATION +
  COUPLING_RECOVERY_DURATION;
const COUPLING_CYCLE_TOTAL = COUPLING_CYCLE_DURATIONS.reduce(
  (total, duration) => total + duration,
  0,
);

const MONITOR_BANDS = [
  {
    frequencyHz: 0.38,
    baseAmplitude: 13,
    variation: 4.4,
    amplitudeRate: 0.24,
    phaseRate: 0.18,
    seed: 101,
  },
  {
    frequencyHz: 0.72,
    baseAmplitude: 9.5,
    variation: 3.4,
    amplitudeRate: 0.36,
    phaseRate: 0.27,
    seed: 131,
  },
  {
    frequencyHz: 1.18,
    baseAmplitude: 6.7,
    variation: 2.5,
    amplitudeRate: 0.52,
    phaseRate: 0.39,
    seed: 167,
  },
  {
    frequencyHz: 1.82,
    baseAmplitude: 4.1,
    variation: 1.6,
    amplitudeRate: 0.76,
    phaseRate: 0.58,
    seed: 211,
  },
  {
    frequencyHz: 2.65,
    baseAmplitude: 2.3,
    variation: 0.9,
    amplitudeRate: 1.04,
    phaseRate: 0.81,
    seed: 257,
  },
] as const;

const COMPRESSION_DRIVE = 58;
const COMPRESSION_LIMIT = 67;

const TAU = Math.PI * 2;

const BAND_TRANSFER_WEIGHTS = [-0.18, -0.08, 0.04, 0.12, 0.1] as const;
const BAND_CONVERGENCE_WEIGHTS = [0.28, 0.48, 0.72, 0.52, 0.34] as const;

const COUPLING_PHASE_ANCHORS = [0.42, 1.57, -0.76, 2.24] as const;

const COUPLING_BEAT_CENTER_HZ = 0.91;
const COUPLING_BEAT_SEPARATION_WIDE_HZ = 0.1;
const COUPLING_BEAT_SEPARATION_NARROW_HZ = 0.022;

const CHIRP_START_FREQUENCY_HZ = 1.05;
const CHIRP_END_FREQUENCY_HZ = 2.2;

type SignalSample = {
  value: number;
  energy: number;
};

type SignalPoint = {
  x: number;
  y: number;
  energy: number;
};

type SignalPaths = {
  core: string;
  cyan: string;
  pink: string;
  activity: number;
};

type EnvelopeState = {
  value: number;
  holdUntil: number;
};

type SignalState = {
  history: SignalSample[];
  envelope: EnvelopeState;
};

type MonitorBandState = {
  frequencyHz: number;
  amplitude: number;
  phase: number;
};

type MonitorState = {
  activity: number;
  bands: MonitorBandState[];
};

type CouplingState = {
  packetStrength: number;
  convergence: number;
  chirpStrength: number;
  transfer: number;
  packetProgress: number;
  packetTime: number;
  phaseAnchor: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smootherStep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function hashNoise(index: number, seed: number): number {
  let value = Math.imul(index | 0, 0x45d9f3b) ^ Math.imul(seed, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;

  return ((value >>> 0) / 4294967295) * 2 - 1;
}

function valueNoise(position: number, seed: number): number {
  const left = Math.floor(position);
  const progress = smootherStep(position - left);

  return interpolate(
    hashNoise(left, seed),
    hashNoise(left + 1, seed),
    progress,
  );
}

function fractalNoise(position: number, seed: number): number {
  return (
    valueNoise(position, seed) * 0.55 +
    valueNoise(position * 2.03 + 17, seed + 1) * 0.28 +
    valueNoise(position * 4.01 + 41, seed + 2) * 0.17
  );
}

function getCouplingCyclePosition(timeSeconds: number): {
  cycleDuration: number;
  cycleIndex: number;
  cycleTime: number;
} {
  let cycleTime =
    ((timeSeconds % COUPLING_CYCLE_TOTAL) + COUPLING_CYCLE_TOTAL) %
    COUPLING_CYCLE_TOTAL;

  for (
    let cycleIndex = 0;
    cycleIndex < COUPLING_CYCLE_DURATIONS.length;
    cycleIndex += 1
  ) {
    const cycleDuration =
      COUPLING_CYCLE_DURATIONS[cycleIndex] ?? COUPLING_CYCLE_DURATIONS[0];

    if (cycleTime < cycleDuration) {
      return { cycleDuration, cycleIndex, cycleTime };
    }

    cycleTime -= cycleDuration;
  }

  return {
    cycleDuration: COUPLING_CYCLE_DURATIONS[0],
    cycleIndex: 0,
    cycleTime: 0,
  };
}

function createCouplingState(timeSeconds: number): CouplingState {
  const { cycleDuration, cycleIndex, cycleTime } =
    getCouplingCyclePosition(timeSeconds);
  const idleDuration = cycleDuration - COUPLING_ACTIVE_DURATION;
  const leadInDuration = idleDuration * 0.52;
  const packetTime = cycleTime - leadInDuration;
  const phaseAnchor =
    COUPLING_PHASE_ANCHORS[cycleIndex % COUPLING_PHASE_ANCHORS.length] ??
    COUPLING_PHASE_ANCHORS[0];

  if (packetTime <= 0 || packetTime >= COUPLING_ACTIVE_DURATION) {
    return {
      packetStrength: 0,
      convergence: 0,
      chirpStrength: 0,
      transfer: 0,
      packetProgress: 0,
      packetTime: 0,
      phaseAnchor,
    };
  }

  const packetProgress = packetTime / COUPLING_ACTIVE_DURATION;
  const convergenceStart = COUPLING_APPROACH_DURATION;
  const coherenceStart = convergenceStart + COUPLING_CONVERGENCE_DURATION;
  const releaseStart = coherenceStart + COUPLING_COHERENCE_DURATION;
  const recoveryStart = releaseStart + COUPLING_RELEASE_DURATION;

  let packetStrength = 0;
  let convergence = 0;
  let chirpStrength = 0;

  if (packetTime < convergenceStart) {
    const progress = smootherStep(packetTime / COUPLING_APPROACH_DURATION);
    packetStrength = interpolate(0, 0.42, progress);
    convergence = interpolate(0, 0.18, progress);
  } else if (packetTime < coherenceStart) {
    const progress = smootherStep(
      (packetTime - convergenceStart) / COUPLING_CONVERGENCE_DURATION,
    );
    packetStrength = interpolate(0.42, 1, progress);
    convergence = interpolate(0.18, 1, progress);
    chirpStrength = interpolate(0, 0.72, progress);
  } else if (packetTime < releaseStart) {
    packetStrength = 1;
    convergence = 1;
    chirpStrength =
      0.72 +
      Math.sin(
        ((packetTime - coherenceStart) / COUPLING_COHERENCE_DURATION) * Math.PI,
      ) *
        0.28;
  } else if (packetTime < recoveryStart) {
    const progress = smootherStep(
      (packetTime - releaseStart) / COUPLING_RELEASE_DURATION,
    );
    packetStrength = interpolate(1, 0.34, progress);
    convergence = interpolate(1, 0.12, progress);
    chirpStrength = interpolate(0.72, 0.08, progress);
  } else {
    const progress = smootherStep(
      (packetTime - recoveryStart) / COUPLING_RECOVERY_DURATION,
    );
    packetStrength = interpolate(0.34, 0, progress);
    convergence = interpolate(0.12, 0, progress);
    chirpStrength = interpolate(0.08, 0, progress);
  }

  const transfer =
    Math.sin(packetProgress * Math.PI * 2 - Math.PI * 0.5) * packetStrength;

  return {
    packetStrength,
    convergence,
    chirpStrength,
    transfer,
    packetProgress,
    packetTime,
    phaseAnchor,
  };
}

function createMonitorState(
  timeSeconds: number,
  coupling: CouplingState,
): MonitorState {
  const phraseSource = clamp01(
    (fractalNoise(timeSeconds * 0.18, 19) + 0.62) / 1.24,
  );
  const phraseActivity = 0.16 + smootherStep(phraseSource) * 0.84;
  const syllableSource = clamp01(
    (fractalNoise(timeSeconds * 0.92 + 7, 43) + 1) * 0.5,
  );
  const syllableActivity = 0.62 + smootherStep(syllableSource) * 0.38;
  const articulationSource = clamp01(
    (fractalNoise(timeSeconds * 2.8 + 13, 71) + 0.5) / 1.5,
  );
  const articulationActivity = Math.pow(articulationSource, 3) * 0.18;
  const activity = clamp01(
    phraseActivity * syllableActivity +
      articulationActivity +
      coupling.packetStrength * 0.08,
  );

  const bands = MONITOR_BANDS.map((band, index) => {
    const amplitudeNoise = fractalNoise(
      timeSeconds * band.amplitudeRate + index * 11,
      band.seed,
    );
    const phaseNoise = fractalNoise(
      timeSeconds * band.phaseRate + index * 17,
      band.seed + 7,
    );
    const activityBias = 0.28 + activity * (0.68 + index * 0.035);
    const amplitude = Math.max(
      0.2,
      band.baseAmplitude + amplitudeNoise * band.variation,
    );
    const transferWeight = BAND_TRANSFER_WEIGHTS[index] ?? 0;
    const convergenceWeight = BAND_CONVERGENCE_WEIGHTS[index] ?? 0;
    const transferMultiplier = 1 + coupling.transfer * transferWeight;
    const convergenceAmount = coupling.convergence * convergenceWeight;
    const basePhase = phaseNoise * (0.42 + index * 0.07);
    const phase = interpolate(
      basePhase,
      coupling.phaseAnchor,
      convergenceAmount,
    );

    return {
      frequencyHz: band.frequencyHz,
      amplitude: amplitude * activityBias * transferMultiplier,
      phase,
    };
  });

  return { activity, bands };
}

function getCyclePosition(timeSeconds: number): {
  cycleDuration: number;
  cycleTime: number;
} {
  let cycleTime =
    ((timeSeconds % EVENT_CYCLE_TOTAL) + EVENT_CYCLE_TOTAL) % EVENT_CYCLE_TOTAL;

  for (const cycleDuration of EVENT_CYCLE_DURATIONS) {
    if (cycleTime < cycleDuration) {
      return { cycleDuration, cycleTime };
    }

    cycleTime -= cycleDuration;
  }

  const cycleDuration = EVENT_CYCLE_DURATIONS[0];
  return { cycleDuration, cycleTime: 0 };
}

function createTransientStrength(timeSeconds: number): number {
  const { cycleDuration, cycleTime } = getCyclePosition(timeSeconds);
  const idleDuration = cycleDuration - EVENT_ACTIVE_DURATION;
  const leadInDuration = idleDuration * 0.45;
  const eventTime = cycleTime - leadInDuration;

  if (eventTime <= 0 || eventTime >= EVENT_ACTIVE_DURATION) {
    return 0;
  }

  if (eventTime < EVENT_APPROACH_DURATION) {
    return interpolate(
      0,
      0.28,
      smootherStep(eventTime / EVENT_APPROACH_DURATION),
    );
  }

  const buildStart = EVENT_APPROACH_DURATION;
  const peakStart = buildStart + EVENT_BUILD_DURATION;
  const releaseStart = peakStart + EVENT_PEAK_DURATION;
  const recoveryStart = releaseStart + EVENT_RELEASE_DURATION;

  if (eventTime < peakStart) {
    return interpolate(
      0.28,
      1,
      smootherStep((eventTime - buildStart) / EVENT_BUILD_DURATION),
    );
  }

  if (eventTime < releaseStart) {
    return 1;
  }

  if (eventTime < recoveryStart) {
    return interpolate(
      1,
      0.32,
      smootherStep((eventTime - releaseStart) / EVENT_RELEASE_DURATION),
    );
  }

  return interpolate(
    0.32,
    0,
    smootherStep((eventTime - recoveryStart) / EVENT_RECOVERY_DURATION),
  );
}

function followEnvelope(
  target: number,
  timeSeconds: number,
  deltaSeconds: number,
  state: EnvelopeState,
): number {
  let resolvedTarget = target;
  let timeConstant = ENVELOPE_RELEASE_SECONDS;

  if (target >= state.value) {
    state.holdUntil = timeSeconds + ENVELOPE_HOLD_SECONDS;
    timeConstant = ENVELOPE_ATTACK_SECONDS;
  } else if (timeSeconds < state.holdUntil) {
    resolvedTarget = Math.max(target, state.value * 0.99);
    timeConstant = ENVELOPE_HOLD_SECONDS;
  }

  const interpolation = 1 - Math.exp(-deltaSeconds / timeConstant);
  state.value = clamp01(
    state.value + (resolvedTarget - state.value) * interpolation,
  );

  return state.value;
}

function createCoupledCarrier(
  timeSeconds: number,
  coupling: CouplingState,
): number {
  if (coupling.packetStrength <= 0) {
    return 0;
  }

  const separation = interpolate(
    COUPLING_BEAT_SEPARATION_WIDE_HZ,
    COUPLING_BEAT_SEPARATION_NARROW_HZ,
    coupling.convergence,
  );
  const lowerBeatFrequency = COUPLING_BEAT_CENTER_HZ - separation * 0.5;
  const upperBeatFrequency = COUPLING_BEAT_CENTER_HZ + separation * 0.5;
  const beatPhase = coupling.phaseAnchor * 0.72;
  const beatCarrier =
    (Math.sin(TAU * lowerBeatFrequency * timeSeconds + beatPhase) +
      Math.sin(TAU * upperBeatFrequency * timeSeconds - beatPhase * 0.35)) *
    (1.8 + coupling.packetStrength * 3.6);

  const chirpProgress = smootherStep(coupling.packetProgress);
  const chirpFrequency = interpolate(
    CHIRP_START_FREQUENCY_HZ,
    CHIRP_END_FREQUENCY_HZ,
    chirpProgress,
  );
  const chirpPhase =
    TAU *
      (CHIRP_START_FREQUENCY_HZ * coupling.packetTime +
        0.5 *
          (CHIRP_END_FREQUENCY_HZ - CHIRP_START_FREQUENCY_HZ) *
          coupling.packetTime *
          chirpProgress) +
    coupling.phaseAnchor;
  const chirpCarrier =
    Math.sin(chirpPhase + Math.sin(TAU * 0.13 * timeSeconds) * 0.18) *
    coupling.chirpStrength *
    (3.2 + chirpFrequency * 1.35);

  const coherencePulse =
    Math.sin(TAU * 0.455 * timeSeconds + coupling.phaseAnchor) *
    coupling.convergence *
    4.2;

  return beatCarrier + chirpCarrier + coherencePulse;
}

function createSignalSample(
  timeSeconds: number,
  deltaSeconds: number,
  envelopeState: EnvelopeState,
): SignalSample {
  const coupling = createCouplingState(timeSeconds);
  const monitor = createMonitorState(timeSeconds, coupling);
  const envelope = followEnvelope(
    monitor.activity,
    timeSeconds,
    deltaSeconds,
    envelopeState,
  );
  const transientStrength = createTransientStrength(timeSeconds);
  const structuralPhase = fractalNoise(timeSeconds * 0.12, 307) * 0.42;
  const structuralCarrier =
    Math.sin(TAU * 0.16 * timeSeconds + structuralPhase) * 9.2 +
    Math.sin(TAU * 0.31 * timeSeconds + 1.1) * 4.5 +
    Math.sin(TAU * 0.58 * timeSeconds - 0.45) * 2;

  let monitorCarrier = 0;

  for (const [index, band] of monitor.bands.entries()) {
    const modulationDepth = coupling.packetStrength * (0.055 + index * 0.018);
    const amplitudeModulation =
      1 +
      Math.sin(
        TAU * (0.072 + index * 0.014) * timeSeconds +
          coupling.phaseAnchor +
          index * 0.8,
      ) *
        modulationDepth;
    const phaseModulation =
      Math.sin(TAU * (0.11 + index * 0.017) * timeSeconds + index * 0.64) *
      coupling.chirpStrength *
      (0.08 + index * 0.025);

    monitorCarrier +=
      Math.sin(
        TAU * band.frequencyHz * timeSeconds + band.phase + phaseModulation,
      ) *
      band.amplitude *
      amplitudeModulation;
  }

  const airTexture =
    fractalNoise(timeSeconds * 6.4 + 3, 503) * (0.8 + envelope * 1.8);
  const eventCarrier =
    transientStrength *
    (Math.sin(TAU * 2.8 * timeSeconds + 0.7) * 13 +
      Math.sin(TAU * 4.6 * timeSeconds - 0.9) * 5.5 +
      Math.sin(TAU * 1.55 * timeSeconds + 1.4) * 4);
  const coupledCarrier = createCoupledCarrier(timeSeconds, coupling);
  const phraseGain = 0.2 + envelope * 0.92;
  const uncompressedSignal =
    structuralCarrier * (0.64 + envelope * 0.2) +
    monitorCarrier * phraseGain +
    coupledCarrier +
    airTexture +
    eventCarrier;
  const value =
    Math.tanh(uncompressedSignal / COMPRESSION_DRIVE) * COMPRESSION_LIMIT;
  const energy = clamp01(
    envelope * 0.5 +
      transientStrength * 0.28 +
      coupling.packetStrength * 0.18 +
      coupling.convergence * 0.08 +
      (Math.abs(value) / COMPRESSION_LIMIT) * 0.18,
  );

  return { value, energy };
}

function createInitialSignalState(): SignalState {
  const history: SignalSample[] = [];
  const envelope: EnvelopeState = {
    value: 0.24,
    holdUntil: Number.NEGATIVE_INFINITY,
  };
  const oldestTime = -(HISTORY_SAMPLE_COUNT - 1) * SOURCE_SAMPLE_INTERVAL;

  for (let index = 0; index < HISTORY_SAMPLE_COUNT; index += 1) {
    const sampleTime = oldestTime + index * SOURCE_SAMPLE_INTERVAL;
    history.unshift(
      createSignalSample(sampleTime, SOURCE_SAMPLE_INTERVAL, envelope),
    );
  }

  return { history, envelope };
}

function readHistorySample(
  history: SignalSample[],
  samplePosition: number,
): SignalSample {
  const clampedPosition = Math.min(
    history.length - 1,
    Math.max(0, samplePosition),
  );
  const leftIndex = Math.floor(clampedPosition);
  const rightIndex = Math.min(history.length - 1, leftIndex + 1);
  const progress = clampedPosition - leftIndex;
  const left = history[leftIndex];
  const right = history[rightIndex];

  return {
    value: interpolate(left.value, right.value, progress),
    energy: interpolate(left.energy, right.energy, progress),
  };
}

function createSignalPoints(
  history: SignalSample[],
  timeSeconds: number,
  fractionalAdvance: number,
  delaySamples = 0,
  memoryMix = 0,
  offsetDirection = 0,
): SignalPoint[] {
  const midpoint = VIEWBOX_HEIGHT / 2;
  const visibleHistorySamples = VISIBLE_HISTORY_SECONDS * SOURCE_SAMPLE_RATE;

  return Array.from({ length: DISPLAY_POINT_COUNT + 1 }, (_, index) => {
    const progress = index / DISPLAY_POINT_COUNT;
    const x = progress * VIEWBOX_WIDTH;
    const samplePosition = progress * visibleHistorySamples - fractionalAdvance;
    const current = readHistorySample(history, samplePosition);
    const delayed = readHistorySample(history, samplePosition + delaySamples);
    const rememberedValue = interpolate(
      current.value,
      delayed.value,
      memoryMix,
    );
    const energy = Math.max(current.energy, delayed.energy * memoryMix);
    const chromaticDrift = Math.sin(index * 0.11 - timeSeconds * 0.95) * 0.34;
    const y =
      midpoint +
      rememberedValue +
      offsetDirection * (1.35 + energy * 1.85) +
      chromaticDrift * Math.abs(offsetDirection);

    return { x, y, energy };
  });
}

function createPath(points: SignalPoint[]): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function createSignalPaths(
  history: SignalSample[],
  timeSeconds: number,
  fractionalAdvance: number,
): SignalPaths {
  const corePoints = createSignalPoints(
    history,
    timeSeconds,
    fractionalAdvance,
  );
  const cyanPoints = createSignalPoints(
    history,
    timeSeconds,
    fractionalAdvance,
    CYAN_DELAY_SAMPLES,
    0.22,
    -1,
  );
  const pinkPoints = createSignalPoints(
    history,
    timeSeconds,
    fractionalAdvance,
    PINK_DELAY_SAMPLES,
    0.28,
    1,
  );
  const activityWindow = history.slice(0, Math.round(SOURCE_SAMPLE_RATE * 0.4));
  const activity =
    activityWindow.reduce((total, sample) => total + sample.energy, 0) /
    activityWindow.length;

  return {
    core: createPath(corePoints),
    cyan: createPath(cyanPoints),
    pink: createPath(pinkPoints),
    activity,
  };
}

function cloneSignalState(state: SignalState): SignalState {
  return {
    history: state.history.map((sample) => ({ ...sample })),
    envelope: { ...state.envelope },
  };
}

function pushSignalSample(history: SignalSample[], sample: SignalSample): void {
  history.unshift(sample);

  if (history.length > HISTORY_SAMPLE_COUNT) {
    history.pop();
  }
}

const INITIAL_SIGNAL_STATE = createInitialSignalState();
const INITIAL_PATHS = createSignalPaths(INITIAL_SIGNAL_STATE.history, 0, 0);

export function HeroSignal() {
  const auraRef = useRef<SVGPathElement>(null);
  const spectrumRef = useRef<SVGPathElement>(null);
  const coreRef = useRef<SVGPathElement>(null);
  const cyanRef = useRef<SVGPathElement>(null);
  const pinkRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

    let animationFrameId: number | null = null;
    let animationStart = performance.now();
    let elapsedBeforePause = 0;
    let lastFrame = 0;
    let lastGeneratedTime = 0;
    let signalState = cloneSignalState(INITIAL_SIGNAL_STATE);

    const writePaths = (paths: SignalPaths) => {
      auraRef.current?.setAttribute("d", paths.core);
      spectrumRef.current?.setAttribute("d", paths.core);
      coreRef.current?.setAttribute("d", paths.core);
      cyanRef.current?.setAttribute("d", paths.cyan);
      pinkRef.current?.setAttribute("d", paths.pink);

      if (auraRef.current) {
        auraRef.current.style.opacity = (0.39 + paths.activity * 0.09).toFixed(
          3,
        );
      }

      if (spectrumRef.current) {
        spectrumRef.current.style.opacity = (
          0.67 +
          paths.activity * 0.06
        ).toFixed(3);
      }
    };

    const stopAnimation = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const advanceSignalHistory = (elapsedSeconds: number) => {
      const pendingSamples = Math.floor(
        (elapsedSeconds - lastGeneratedTime) / SOURCE_SAMPLE_INTERVAL,
      );

      if (pendingSamples <= 0) {
        return;
      }

      const sampleCount = Math.min(pendingSamples, MAX_SAMPLES_PER_FRAME);

      if (pendingSamples > MAX_SAMPLES_PER_FRAME) {
        lastGeneratedTime =
          elapsedSeconds - sampleCount * SOURCE_SAMPLE_INTERVAL;
      }

      for (let index = 0; index < sampleCount; index += 1) {
        lastGeneratedTime += SOURCE_SAMPLE_INTERVAL;
        pushSignalSample(
          signalState.history,
          createSignalSample(
            lastGeneratedTime,
            SOURCE_SAMPLE_INTERVAL,
            signalState.envelope,
          ),
        );
      }
    };

    const renderFrame = (timestamp: number) => {
      if (timestamp - lastFrame >= FRAME_INTERVAL_MS) {
        const elapsedSeconds = (timestamp - animationStart) / 1000;
        elapsedBeforePause = elapsedSeconds;
        advanceSignalHistory(elapsedSeconds);
        const fractionalAdvance = clamp01(
          (elapsedSeconds - lastGeneratedTime) / SOURCE_SAMPLE_INTERVAL,
        );
        writePaths(
          createSignalPaths(
            signalState.history,
            elapsedSeconds,
            fractionalAdvance,
          ),
        );
        lastFrame = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const startAnimation = () => {
      stopAnimation();
      animationStart = performance.now() - elapsedBeforePause * 1000;
      lastFrame = 0;
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const showStaticSignal = () => {
      stopAnimation();
      elapsedBeforePause = 0;
      lastGeneratedTime = 0;
      signalState = cloneSignalState(INITIAL_SIGNAL_STATE);
      writePaths(INITIAL_PATHS);
    };

    const reconcileAnimationState = () => {
      if (mediaQuery.matches) {
        showStaticSignal();
        return;
      }

      if (document.visibilityState === "hidden") {
        stopAnimation();
        return;
      }

      startAnimation();
    };

    mediaQuery.addEventListener("change", reconcileAnimationState);
    document.addEventListener("visibilitychange", reconcileAnimationState);
    reconcileAnimationState();

    return () => {
      stopAnimation();
      mediaQuery.removeEventListener("change", reconcileAnimationState);
      document.removeEventListener("visibilitychange", reconcileAnimationState);
    };
  }, []);

  return (
    <svg
      className="hero-signal__svg"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="signal-spectrum"
          x1="0"
          y1="0"
          x2={VIEWBOX_WIDTH}
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ff2ea6" stopOpacity="0" />
          <stop offset="9%" stopColor="#ff2ea6" stopOpacity="0.42" />
          <stop offset="22%" stopColor="#72ddff" stopOpacity="0.72" />
          <stop offset="38%" stopColor="#fff8ee" stopOpacity="0.94" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="63%" stopColor="#ffd8ef" stopOpacity="0.96" />
          <stop offset="78%" stopColor="#b8a4ff" stopOpacity="0.62" />
          <stop offset="91%" stopColor="#ff2ea6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ff2ea6" stopOpacity="0" />
        </linearGradient>

        <linearGradient
          id="signal-core"
          x1="0"
          y1="0"
          x2={VIEWBOX_WIDTH}
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="16%" stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="84%" stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <filter
          id="signal-soft-glow"
          x="-20%"
          y="-120%"
          width="140%"
          height="340%"
        >
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        ref={auraRef}
        className="hero-signal__aura"
        d={INITIAL_PATHS.core}
        stroke="url(#signal-spectrum)"
        filter="url(#signal-soft-glow)"
      />

      <path
        ref={cyanRef}
        className="hero-signal__refraction hero-signal__refraction--cyan"
        d={INITIAL_PATHS.cyan}
      />

      <path
        ref={pinkRef}
        className="hero-signal__refraction hero-signal__refraction--pink"
        d={INITIAL_PATHS.pink}
      />

      <path
        ref={spectrumRef}
        className="hero-signal__spectrum"
        d={INITIAL_PATHS.core}
        stroke="url(#signal-spectrum)"
      />

      <path
        ref={coreRef}
        className="hero-signal__core"
        d={INITIAL_PATHS.core}
        stroke="url(#signal-core)"
      />
    </svg>
  );
}
