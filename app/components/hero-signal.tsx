import { useEffect, useRef } from "react";

const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 320;
const SAMPLE_COUNT = 320;
const FRAME_INTERVAL_MS = 1000 / 30;
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

type SignalPoint = {
  x: number;
  y: number;
  energy: number;
};

type SignalPaths = {
  core: string;
  cyan: string;
  pink: string;
  eventStrength: number;
};

type TransientState = {
  center: number;
  strength: number;
  width: number;
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

function createSignalPoints(timeSeconds: number, transient: TransientState): SignalPoint[] {
  const midpoint = VIEWBOX_HEIGHT / 2;

  return Array.from({ length: SAMPLE_COUNT + 1 }, (_, index) => {
    const progress = index / SAMPLE_COUNT;
    const x = progress * VIEWBOX_WIDTH;

    const longCarrier = Math.sin(x * 0.015 + 0.35 - timeSeconds * 0.18) * 23;

    const primaryAmplitude = 32 + Math.sin(timeSeconds * 0.17 + progress * Math.PI) * 2.4;

    const primaryCarrier =
      Math.sin(x * 0.047 - timeSeconds * 0.54 + Math.sin(timeSeconds * 0.11) * 0.18) *
      primaryAmplitude;

    const harmonicCarrier = Math.sin(x * 0.121 + 1.1 - timeSeconds * 0.92) * 10.5;

    const fineCarrier = Math.sin(x * 0.267 - 0.4 - timeSeconds * 1.35) * 3.2;

    const envelope =
      0.58 +
      Math.sin(x * 0.0042 - 0.6 - timeSeconds * 0.08) * 0.15 +
      Math.sin(x * 0.0081 + 1.4 + timeSeconds * 0.06) * 0.08;

    const breathing = Math.sin(progress * Math.PI * 2 - timeSeconds * 0.22) * 1.4;

    const normalizedDistance = (progress - transient.center) / transient.width;
    const localEnvelope = Math.exp(-0.5 * normalizedDistance * normalizedDistance);
    const energy = transient.strength * localEnvelope;

    const transientCarrier = Math.sin(x * 0.205 - timeSeconds * 2.2 + 0.7) * energy * 16;

    const transientHarmonic = Math.sin(x * 0.39 + timeSeconds * 3.1 - 0.9) * energy * 5.8;

    const transientAsymmetry = Math.sin(x * 0.073 - timeSeconds * 1.4 + 1.25) * energy * 4.2;

    const y =
      midpoint +
      longCarrier +
      (primaryCarrier + harmonicCarrier + fineCarrier) * envelope +
      breathing +
      transientCarrier +
      transientHarmonic +
      transientAsymmetry;

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
  const points = createSignalPoints(timeSeconds, transient);

  return {
    core: createPath(points, () => 0),
    cyan: createPath(
      points,
      ({ x, energy }) =>
        -1.7 -
        Math.sin(x * 0.018 - timeSeconds * 0.42) * 1.05 -
        energy * (1.65 + Math.sin(x * 0.052 - timeSeconds * 0.85) * 0.65),
    ),
    pink: createPath(
      points,
      ({ x, energy }) =>
        1.9 +
        Math.sin(x * 0.014 - timeSeconds * 0.31 + 1.6) * 1.15 +
        energy * (1.85 + Math.sin(x * 0.047 - timeSeconds * 0.72 + 1.1) * 0.7),
    ),
    eventStrength: transient.strength,
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
        auraRef.current.style.opacity = (0.4 + paths.eventStrength * 0.08).toFixed(3);
      }

      if (spectrumRef.current) {
        spectrumRef.current.style.opacity = (0.68 + paths.eventStrength * 0.05).toFixed(3);
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
