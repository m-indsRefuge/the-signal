import { useEffect, useRef } from "react";

const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 320;
const SAMPLE_COUNT = 320;
const FRAME_INTERVAL_MS = 1000 / 60;
const HISTORY_SAMPLE_RATE = 120;
const HISTORY_SAMPLE_INTERVAL = 1 / HISTORY_SAMPLE_RATE;
const MAX_SAMPLES_PER_FRAME = 18;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const ENVELOPE_ATTACK_SECONDS = 0.035;
const ENVELOPE_HOLD_SECONDS = 0.045;
const ENVELOPE_RELEASE_SECONDS = 0.24;
const CYAN_DELAY_SAMPLES = 1;
const PINK_DELAY_SAMPLES = 3;

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

const BROADBAND_BANDS = [
  {
    temporalSpeed: 7.8,
    baseAmplitude: 12.5,
    variation: 4.6,
    amplitudeRate: 0.72,
    phaseRate: 0.34,
    seed: 101,
  },
  {
    temporalSpeed: 13.6,
    baseAmplitude: 9.5,
    variation: 3.8,
    amplitudeRate: 0.96,
    phaseRate: 0.48,
    seed: 131,
  },
  {
    temporalSpeed: 22.4,
    baseAmplitude: 6.8,
    variation: 2.8,
    amplitudeRate: 1.24,
    phaseRate: 0.71,
    seed: 167,
  },
  {
    temporalSpeed: 35.2,
    baseAmplitude: 4.4,
    variation: 1.9,
    amplitudeRate: 1.67,
    phaseRate: 0.92,
    seed: 211,
  },
  {
    temporalSpeed: 52.8,
    baseAmplitude: 2.7,
    variation: 1.1,
    amplitudeRate: 2.15,
    phaseRate: 1.18,
    seed: 257,
  },
] as const;

const COMPRESSION_DRIVE = 58;
const COMPRESSION_LIMIT = 68;

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

type BroadbandBandState = {
  temporalSpeed: number;
  amplitude: number;
  phase: number;
};

type BroadbandState = {
  activity: number;
  bands: BroadbandBandState[];
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

function createBroadbandState(timeSeconds: number): BroadbandState {
  const phraseSource = clamp01(
    (fractalNoise(timeSeconds * 0.46, 19) + 0.58) / 1.16,
  );
  const phraseActivity = 0.12 + smootherStep(phraseSource) * 0.88;
  const syllableSource = clamp01(
    (fractalNoise(timeSeconds * 2.35 + 7, 43) + 1) * 0.5,
  );
  const syllableActivity = 0.56 + smootherStep(syllableSource) * 0.44;
  const consonantSource = clamp01(
    (fractalNoise(timeSeconds * 6.8 + 13, 71) + 0.42) / 1.42,
  );
  const consonantActivity = Math.pow(consonantSource, 3) * 0.22;
  const activity = clamp01(
    phraseActivity * syllableActivity + consonantActivity,
  );

  const bands = BROADBAND_BANDS.map((band, index) => {
    const amplitudeNoise = fractalNoise(
      timeSeconds * band.amplitudeRate + index * 11,
      band.seed,
    );
    const phaseNoise = fractalNoise(
      timeSeconds * band.phaseRate + index * 17,
      band.seed + 7,
    );
    const activityBias = 0.32 + activity * (0.74 + index * 0.045);
    const amplitude = Math.max(
      0.25,
      band.baseAmplitude + amplitudeNoise * band.variation,
    );

    return {
      temporalSpeed: band.temporalSpeed,
      amplitude: amplitude * activityBias,
      phase: phaseNoise * (0.48 + index * 0.08),
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
    resolvedTarget = Math.max(target, state.value * 0.985);
    timeConstant = ENVELOPE_HOLD_SECONDS;
  }

  const interpolation = 1 - Math.exp(-deltaSeconds / timeConstant);
  state.value = clamp01(
    state.value + (resolvedTarget - state.value) * interpolation,
  );

  return state.value;
}

function createSignalSample(
  timeSeconds: number,
  deltaSeconds: number,
  envelopeState: EnvelopeState,
): SignalSample {
  const broadband = createBroadbandState(timeSeconds);
  const envelope = followEnvelope(
    broadband.activity,
    timeSeconds,
    deltaSeconds,
    envelopeState,
  );
  const transientStrength = createTransientStrength(timeSeconds);

  const structuralPhase = fractalNoise(timeSeconds * 0.31, 307) * 0.38;
  const structuralCarrier =
    Math.sin(timeSeconds * 2.4 + structuralPhase) * 8.5 +
    Math.sin(timeSeconds * 5.3 + 1.1) * 4.2 +
    Math.sin(timeSeconds * 9.1 - 0.45) * 1.8;

  let broadbandCarrier = 0;

  for (const band of broadband.bands) {
    broadbandCarrier +=
      Math.sin(timeSeconds * band.temporalSpeed + band.phase) * band.amplitude;
  }

  const airTexture =
    fractalNoise(timeSeconds * 18.5 + 3, 503) * (1.4 + envelope * 2.6);
  const eventCarrier =
    transientStrength *
    (Math.sin(timeSeconds * 31 + 0.7) * 16 +
      Math.sin(timeSeconds * 53 - 0.9) * 7 +
      Math.sin(timeSeconds * 17.5 + 1.4) * 4.5);
  const phraseGain = 0.18 + envelope * 0.98;
  const uncompressedSignal =
    structuralCarrier * (0.62 + envelope * 0.2) +
    broadbandCarrier * phraseGain +
    airTexture +
    eventCarrier;
  const value =
    Math.tanh(uncompressedSignal / COMPRESSION_DRIVE) * COMPRESSION_LIMIT;
  const energy = clamp01(
    envelope * 0.56 +
      transientStrength * 0.34 +
      (Math.abs(value) / COMPRESSION_LIMIT) * 0.22,
  );

  return { value, energy };
}

function createInitialSignalState(): SignalState {
  const history: SignalSample[] = [];
  const envelope: EnvelopeState = {
    value: 0.24,
    holdUntil: Number.NEGATIVE_INFINITY,
  };
  const oldestTime = -SAMPLE_COUNT * HISTORY_SAMPLE_INTERVAL;

  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const sampleTime = oldestTime + index * HISTORY_SAMPLE_INTERVAL;
    history.unshift(
      createSignalSample(sampleTime, HISTORY_SAMPLE_INTERVAL, envelope),
    );
  }

  return { history, envelope };
}

function createSignalPoints(
  history: SignalSample[],
  timeSeconds: number,
  delaySamples = 0,
  memoryMix = 0,
  offsetDirection = 0,
): SignalPoint[] {
  const midpoint = VIEWBOX_HEIGHT / 2;

  return Array.from({ length: SAMPLE_COUNT + 1 }, (_, index) => {
    const progress = index / SAMPLE_COUNT;
    const x = progress * VIEWBOX_WIDTH;
    const current = history[Math.min(index, history.length - 1)];
    const delayed = history[Math.min(index + delaySamples, history.length - 1)];
    const rememberedValue = interpolate(
      current.value,
      delayed.value,
      memoryMix,
    );
    const energy = Math.max(current.energy, delayed.energy * memoryMix);
    const chromaticDrift = Math.sin(index * 0.14 - timeSeconds * 3.2) * 0.48;
    const y =
      midpoint +
      rememberedValue +
      offsetDirection * (1.45 + energy * 2.1) +
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
): SignalPaths {
  const corePoints = createSignalPoints(history, timeSeconds);
  const cyanPoints = createSignalPoints(
    history,
    timeSeconds,
    CYAN_DELAY_SAMPLES,
    0.2,
    -1,
  );
  const pinkPoints = createSignalPoints(
    history,
    timeSeconds,
    PINK_DELAY_SAMPLES,
    0.3,
    1,
  );
  const activityWindow = history.slice(0, 24);
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

  if (history.length > SAMPLE_COUNT + 1) {
    history.pop();
  }
}

const INITIAL_SIGNAL_STATE = createInitialSignalState();
const INITIAL_PATHS = createSignalPaths(INITIAL_SIGNAL_STATE.history, 0);

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
        auraRef.current.style.opacity = (0.4 + paths.activity * 0.1).toFixed(3);
      }

      if (spectrumRef.current) {
        spectrumRef.current.style.opacity = (
          0.68 +
          paths.activity * 0.065
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
        (elapsedSeconds - lastGeneratedTime) / HISTORY_SAMPLE_INTERVAL,
      );

      if (pendingSamples <= 0) {
        return;
      }

      const sampleCount = Math.min(pendingSamples, MAX_SAMPLES_PER_FRAME);

      if (pendingSamples > MAX_SAMPLES_PER_FRAME) {
        lastGeneratedTime =
          elapsedSeconds - sampleCount * HISTORY_SAMPLE_INTERVAL;
      }

      for (let index = 0; index < sampleCount; index += 1) {
        lastGeneratedTime += HISTORY_SAMPLE_INTERVAL;
        const sample = createSignalSample(
          lastGeneratedTime,
          HISTORY_SAMPLE_INTERVAL,
          signalState.envelope,
        );
        pushSignalSample(signalState.history, sample);
      }
    };

    const renderFrame = (timestamp: number) => {
      if (timestamp - lastFrame >= FRAME_INTERVAL_MS) {
        const elapsedSeconds = (timestamp - animationStart) / 1000;
        elapsedBeforePause = elapsedSeconds;
        advanceSignalHistory(elapsedSeconds);
        writePaths(createSignalPaths(signalState.history, elapsedSeconds));
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
