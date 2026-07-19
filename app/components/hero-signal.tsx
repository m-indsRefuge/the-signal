import { useEffect, useRef } from "react";

const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 320;
const SAMPLE_COUNT = 320;
const FRAME_INTERVAL_MS = 1000 / 60;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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
const EVENT_CYCLE_TOTAL = EVENT_CYCLE_DURATIONS.reduce((total, duration) => total + duration, 0);

const BROADBAND_BANDS = [
  {
    spatialFrequency: 0.031,
    temporalSpeed: 2.8,
    baseAmplitude: 12.5,
    variation: 4.6,
    amplitudeRate: 0.72,
    phaseRate: 0.34,
    seed: 101,
  },
  {
    spatialFrequency: 0.067,
    temporalSpeed: 5.1,
    baseAmplitude: 9.5,
    variation: 3.8,
    amplitudeRate: 0.96,
    phaseRate: 0.48,
    seed: 131,
  },
  {
    spatialFrequency: 0.119,
    temporalSpeed: 8.4,
    baseAmplitude: 6.8,
    variation: 2.8,
    amplitudeRate: 1.24,
    phaseRate: 0.71,
    seed: 167,
  },
  {
    spatialFrequency: 0.203,
    temporalSpeed: 12.7,
    baseAmplitude: 4.4,
    variation: 1.9,
    amplitudeRate: 1.67,
    phaseRate: 0.92,
    seed: 211,
  },
  {
    spatialFrequency: 0.337,
    temporalSpeed: 18.6,
    baseAmplitude: 2.7,
    variation: 1.1,
    amplitudeRate: 2.15,
    phaseRate: 1.18,
    seed: 257,
  },
] as const;

const COMPRESSION_DRIVE = 64;
const COMPRESSION_LIMIT = 68;

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

type TransientState = {
  center: number;
  strength: number;
  width: number;
};

type BroadbandBandState = {
  spatialFrequency: number;
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

  return interpolate(hashNoise(left, seed), hashNoise(left + 1, seed), progress);
}

function fractalNoise(position: number, seed: number): number {
  return (
    valueNoise(position, seed) * 0.55 +
    valueNoise(position * 2.03 + 17, seed + 1) * 0.28 +
    valueNoise(position * 4.01 + 41, seed + 2) * 0.17
  );
}

function createBroadbandState(timeSeconds: number): BroadbandState {
  const phraseSource = clamp01((fractalNoise(timeSeconds * 0.46, 19) + 0.58) / 1.16);
  const phraseActivity = 0.12 + smootherStep(phraseSource) * 0.88;
  const syllableSource = clamp01((fractalNoise(timeSeconds * 2.35 + 7, 43) + 1) * 0.5);
  const syllableActivity = 0.56 + smootherStep(syllableSource) * 0.44;
  const consonantSource = clamp01((fractalNoise(timeSeconds * 6.8 + 13, 71) + 0.42) / 1.42);
  const consonantActivity = Math.pow(consonantSource, 3) * 0.22;
  const activity = clamp01(phraseActivity * syllableActivity + consonantActivity);

  const bands = BROADBAND_BANDS.map((band, index) => {
    const amplitudeNoise = fractalNoise(timeSeconds * band.amplitudeRate + index * 11, band.seed);
    const phaseNoise = fractalNoise(timeSeconds * band.phaseRate + index * 17, band.seed + 7);
    const activityBias = 0.32 + activity * (0.74 + index * 0.045);
    const amplitude = Math.max(0.25, band.baseAmplitude + amplitudeNoise * band.variation);

    return {
      spatialFrequency: band.spatialFrequency,
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
  let cycleTime = ((timeSeconds % EVENT_CYCLE_TOTAL) + EVENT_CYCLE_TOTAL) % EVENT_CYCLE_TOTAL;

  for (const cycleDuration of EVENT_CYCLE_DURATIONS) {
    if (cycleTime < cycleDuration) {
      return { cycleDuration, cycleTime };
    }

    cycleTime -= cycleDuration;
  }

  const cycleDuration = EVENT_CYCLE_DURATIONS[0];
  return { cycleDuration, cycleTime: 0 };
}

function createTransientState(timeSeconds: number): TransientState {
  const { cycleDuration, cycleTime } = getCyclePosition(timeSeconds);
  const idleDuration = cycleDuration - EVENT_ACTIVE_DURATION;
  const leadInDuration = idleDuration * 0.45;
  const eventTime = cycleTime - leadInDuration;

  if (eventTime <= 0) {
    return { center: -0.16, strength: 0, width: 0.13 };
  }

  if (eventTime >= EVENT_ACTIVE_DURATION) {
    return { center: 1.16, strength: 0, width: 0.18 };
  }

  const eventProgress = eventTime / EVENT_ACTIVE_DURATION;
  const center = interpolate(-0.16, 1.16, eventProgress);

  if (eventTime < EVENT_APPROACH_DURATION) {
    const progress = smootherStep(eventTime / EVENT_APPROACH_DURATION);
    return {
      center,
      strength: interpolate(0, 0.28, progress),
      width: interpolate(0.13, 0.095, progress),
    };
  }

  const buildStart = EVENT_APPROACH_DURATION;
  const peakStart = buildStart + EVENT_BUILD_DURATION;
  const releaseStart = peakStart + EVENT_PEAK_DURATION;
  const recoveryStart = releaseStart + EVENT_RELEASE_DURATION;

  if (eventTime < peakStart) {
    const progress = smootherStep((eventTime - buildStart) / EVENT_BUILD_DURATION);
    return {
      center,
      strength: interpolate(0.28, 1, progress),
      width: interpolate(0.095, 0.062, progress),
    };
  }

  if (eventTime < releaseStart) {
    return { center, strength: 1, width: 0.062 };
  }

  if (eventTime < recoveryStart) {
    const progress = smootherStep((eventTime - releaseStart) / EVENT_RELEASE_DURATION);
    return {
      center,
      strength: interpolate(1, 0.32, progress),
      width: interpolate(0.062, 0.14, progress),
    };
  }

  const progress = smootherStep((eventTime - recoveryStart) / EVENT_RECOVERY_DURATION);

  return {
    center,
    strength: interpolate(0.32, 0, progress),
    width: interpolate(0.14, 0.18, progress),
  };
}

function createSignalPoints(
  timeSeconds: number,
  transient: TransientState,
  broadband: BroadbandState,
): SignalPoint[] {
  const midpoint = VIEWBOX_HEIGHT / 2;

  return Array.from({ length: SAMPLE_COUNT + 1 }, (_, index) => {
    const progress = index / SAMPLE_COUNT;
    const x = progress * VIEWBOX_WIDTH;

    const longCarrier = Math.sin(x * 0.012 + 0.35 - timeSeconds * 0.72) * 14;
    const primaryAmplitude = 24 + fractalNoise(timeSeconds * 0.38 + progress * 0.42, 283) * 4.2;
    const primaryCarrier =
      Math.sin(
        x * 0.046 -
          timeSeconds * 2.15 +
          fractalNoise(timeSeconds * 0.26 + progress * 0.18, 307) * 0.34,
      ) * primaryAmplitude;
    const harmonicCarrier = Math.sin(x * 0.115 + 1.1 - timeSeconds * 4.6) * 7.4;
    const fineCarrier = Math.sin(x * 0.251 - 0.4 - timeSeconds * 9.4) * 2.4;
    const structuralEnvelope =
      0.66 +
      Math.sin(x * 0.0042 - 0.6 - timeSeconds * 0.31) * 0.13 +
      Math.sin(x * 0.0081 + 1.4 + timeSeconds * 0.24) * 0.07;
    const breathing = Math.sin(progress * Math.PI * 2 - timeSeconds * 0.85) * 1.1;

    const localTexture = 0.82 + fractalNoise(progress * 4.8 - timeSeconds * 1.12, 331) * 0.18;
    const localSpeechSource = clamp01(
      (fractalNoise(progress * 7.2 - timeSeconds * 1.85, 359) + 1) * 0.5,
    );
    const localSpeechEnvelope = 0.58 + smootherStep(localSpeechSource) * 0.42;

    let broadbandCarrier = 0;

    for (const band of broadband.bands) {
      broadbandCarrier +=
        Math.sin(
          x * band.spatialFrequency -
            timeSeconds * band.temporalSpeed +
            band.phase +
            progress * fractalNoise(timeSeconds * 0.92 + band.temporalSpeed, 389) * 0.16,
        ) * band.amplitude;
    }

    broadbandCarrier *= localTexture * localSpeechEnvelope;

    const normalizedDistance = (progress - transient.center) / transient.width;
    const localEventEnvelope = Math.exp(-0.5 * normalizedDistance * normalizedDistance);
    const eventEnergy = transient.strength * localEventEnvelope;
    const transientCarrier = Math.sin(x * 0.205 - timeSeconds * 4.8 + 0.7) * eventEnergy * 13;
    const transientHarmonic = Math.sin(x * 0.39 + timeSeconds * 7.2 - 0.9) * eventEnergy * 4.8;
    const transientAsymmetry = Math.sin(x * 0.073 - timeSeconds * 3.4 + 1.25) * eventEnergy * 3.6;

    const uncompressedSignal =
      longCarrier +
      (primaryCarrier + harmonicCarrier + fineCarrier) * structuralEnvelope +
      broadbandCarrier +
      transientCarrier +
      transientHarmonic +
      transientAsymmetry;
    const compressedSignal = Math.tanh(uncompressedSignal / COMPRESSION_DRIVE) * COMPRESSION_LIMIT;
    const localBroadbandEnergy = clamp01(
      broadband.activity * localSpeechEnvelope * (0.28 + Math.abs(broadbandCarrier) / 42),
    );
    const energy = clamp01(eventEnergy + localBroadbandEnergy * 0.42);
    const y = midpoint + compressedSignal + breathing;

    return { x, y, energy };
  });
}

function createPath(points: SignalPoint[], offset: (point: SignalPoint) => number): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      const y = point.y + offset(point);

      return `${command} ${point.x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function createSignalPaths(timeSeconds: number): SignalPaths {
  const transient = createTransientState(timeSeconds);
  const broadband = createBroadbandState(timeSeconds);
  const points = createSignalPoints(timeSeconds, transient, broadband);
  const activity = clamp01(transient.strength * 0.62 + broadband.activity * 0.38);

  return {
    core: createPath(points, () => 0),
    cyan: createPath(
      points,
      ({ x, energy }) =>
        -1.7 -
        Math.sin(x * 0.018 - timeSeconds * 1.7) * 1.05 -
        energy * (1.65 + Math.sin(x * 0.052 - timeSeconds * 3.4) * 0.65),
    ),
    pink: createPath(
      points,
      ({ x, energy }) =>
        1.9 +
        Math.sin(x * 0.014 - timeSeconds * 1.35 + 1.6) * 1.15 +
        energy * (1.85 + Math.sin(x * 0.047 - timeSeconds * 2.9 + 1.1) * 0.7),
    ),
    activity,
  };
}

const INITIAL_PATHS = createSignalPaths(0);

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
        spectrumRef.current.style.opacity = (0.68 + paths.activity * 0.065).toFixed(3);
      }
    };

    const stopAnimation = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const renderFrame = (timestamp: number) => {
      if (timestamp - lastFrame >= FRAME_INTERVAL_MS) {
        const elapsedSeconds = (timestamp - animationStart) / 1000;
        elapsedBeforePause = elapsedSeconds;
        writePaths(createSignalPaths(elapsedSeconds));
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

        <filter id="signal-soft-glow" x="-20%" y="-120%" width="140%" height="340%">
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
