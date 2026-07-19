import { useEffect, useRef } from "react";

import { createSyntheticSignalAudio } from "./hero-signal-audio";
import { createLivingSignalRenderer } from "./hero-signal-webgl";
import "./hero-signal.css";

const FRAME_INTERVAL_MS = 1000 / 60;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const STATIC_SIGNAL_TIME_SECONDS = 7.25;

export function HeroSignal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return;
    }

    const renderer = createLivingSignalRenderer(canvas);

    if (!renderer) {
      container.dataset.renderer = "fallback";
      return;
    }

    const audioSource = createSyntheticSignalAudio();
    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const resizeObserver = new ResizeObserver(() => {
      const bounds = container.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height);
    });

    let animationFrameId: number | null = null;
    let animationStart = performance.now();
    let elapsedBeforePause = 0;
    let lastFrame = 0;
    let activationListenersRemoved = false;

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height);
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
        renderer.render(
          elapsedSeconds,
          audioSource.sample(elapsedSeconds),
          1,
        );
        lastFrame = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const startAnimation = () => {
      stopAnimation();
      resize();
      animationStart = performance.now() - elapsedBeforePause * 1000;
      lastFrame = 0;
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const showStaticSignal = () => {
      stopAnimation();
      elapsedBeforePause = 0;
      resize();
      renderer.render(
        STATIC_SIGNAL_TIME_SECONDS,
        audioSource.sample(STATIC_SIGNAL_TIME_SECONDS),
        0,
      );
    };

    const reconcileAnimationState = () => {
      if (motionQuery.matches) {
        showStaticSignal();
        return;
      }

      if (document.visibilityState === "hidden") {
        stopAnimation();
        return;
      }

      startAnimation();
    };

    function removeActivationListeners() {
      if (activationListenersRemoved) {
        return;
      }

      activationListenersRemoved = true;
      window.removeEventListener("pointerdown", activateAudio);
      window.removeEventListener("keydown", activateAudio);
    }

    function activateAudio() {
      removeActivationListeners();
      void audioSource.start().catch(() => undefined);
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      stopAnimation();
      container.dataset.renderer = "fallback";
    };

    resizeObserver.observe(container);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    motionQuery.addEventListener("change", reconcileAnimationState);
    document.addEventListener("visibilitychange", reconcileAnimationState);
    window.addEventListener("pointerdown", activateAudio, { passive: true });
    window.addEventListener("keydown", activateAudio);
    reconcileAnimationState();

    return () => {
      stopAnimation();
      removeActivationListeners();
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      motionQuery.removeEventListener("change", reconcileAnimationState);
      document.removeEventListener("visibilitychange", reconcileAnimationState);
      audioSource.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="hero-signal" data-renderer="webgl">
      <canvas
        ref={canvasRef}
        className="hero-signal__canvas"
        aria-hidden="true"
      />

      <svg
        className="hero-signal__fallback"
        viewBox="0 0 1600 320"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id="signal-fallback-spectrum"
            x1="0"
            y1="0"
            x2="1600"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#ff2ea6" stopOpacity="0" />
            <stop offset="22%" stopColor="#72ddff" stopOpacity="0.66" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="78%" stopColor="#b8a4ff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff2ea6" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          className="hero-signal__fallback-aura"
          d="M 0 160 C 90 158 120 140 178 160 S 274 189 338 158 S 450 120 520 162 S 630 194 702 154 S 830 126 896 163 S 1018 188 1088 156 S 1210 132 1278 162 S 1406 180 1600 160"
        />
        <path
          className="hero-signal__fallback-spectrum"
          d="M 0 160 C 90 158 120 140 178 160 S 274 189 338 158 S 450 120 520 162 S 630 194 702 154 S 830 126 896 163 S 1018 188 1088 156 S 1210 132 1278 162 S 1406 180 1600 160"
        />
        <path
          className="hero-signal__fallback-core"
          d="M 0 160 C 90 158 120 140 178 160 S 274 189 338 158 S 450 120 520 162 S 630 194 702 154 S 830 126 896 163 S 1018 188 1088 156 S 1210 132 1278 162 S 1406 180 1600 160"
        />
      </svg>
    </div>
  );
}
