import { useEffect, useRef } from "react";

const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 320;
const SAMPLE_COUNT = 320;
const FRAME_INTERVAL_MS = 1000 / 30;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type SignalPoint = {
  x: number;
  y: number;
};

type SignalPaths = {
  core: string;
  cyan: string;
  pink: string;
};

function createSignalPoints(timeSeconds: number): SignalPoint[] {
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

    const y =
      midpoint +
      longCarrier +
      (primaryCarrier + harmonicCarrier + fineCarrier) * envelope +
      breathing;

    return { x, y };
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
  const points = createSignalPoints(timeSeconds);

  return {
    core: createPath(points, () => 0),
    cyan: createPath(points, ({ x }) => -1.7 - Math.sin(x * 0.018 - timeSeconds * 0.42) * 1.05),
    pink: createPath(
      points,
      ({ x }) => 1.9 + Math.sin(x * 0.014 - timeSeconds * 0.31 + 1.6) * 1.15,
    ),
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
    let lastFrame = 0;

    const writePaths = (paths: SignalPaths) => {
      auraRef.current?.setAttribute("d", paths.core);
      spectrumRef.current?.setAttribute("d", paths.core);
      coreRef.current?.setAttribute("d", paths.core);
      cyanRef.current?.setAttribute("d", paths.cyan);
      pinkRef.current?.setAttribute("d", paths.pink);
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
        writePaths(createSignalPaths(elapsedSeconds));
        lastFrame = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const startAnimation = () => {
      stopAnimation();
      animationStart = performance.now();
      lastFrame = 0;
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const handleMotionPreference = () => {
      stopAnimation();

      if (mediaQuery.matches) {
        writePaths(INITIAL_PATHS);
        return;
      }

      startAnimation();
    };

    mediaQuery.addEventListener("change", handleMotionPreference);
    handleMotionPreference();

    return () => {
      stopAnimation();
      mediaQuery.removeEventListener("change", handleMotionPreference);
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
