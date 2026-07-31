import { useEffect, useRef } from "react";

import { createSignalAudioSource } from "./hero-signal-audio";
import { createLivingSignalRenderer, type HeroSignalObserverFrame } from "./hero-signal-webgl";
import "./hero-signal.css";

const FRAME_INTERVAL_MS = 1000 / 60;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const STATIC_SIGNAL_TIME_SECONDS = 7.25;
const OBSERVER_FIELD_MARGIN_PX = 180;
const OBSERVER_MAX_VELOCITY = 2.4;
const DRAG_CAPTURE_RADIUS_PX = 110;
const DRAG_MAX_VELOCITY = 3.4;
const DRAG_EDGE_MARGIN = 0.018;

type ObserverTrackingState = {
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  targetInfluence: number;
  influence: number;
  targetVelocityX: number;
  targetVelocityY: number;
  velocityX: number;
  velocityY: number;
  lastPointerTimestamp: number;
  lastMoveTimestamp: number;
  lastFrameTimestamp: number;
  hasPointerSample: boolean;
};

type DragTrackingState = {
  pointerId: number | null;
  active: boolean;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  targetStrength: number;
  strength: number;
  targetVelocityX: number;
  targetVelocityY: number;
  velocityX: number;
  velocityY: number;
  lastPointerTimestamp: number;
  lastFrameTimestamp: number;
};

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

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

    const audioSource = createSignalAudioSource();
    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const resizeObserver = new ResizeObserver(() => {
      const bounds = container.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height);
    });

    let animationFrameId: number | null = null;
    let animationStart = performance.now();
    let elapsedBeforePause = 0;
    let lastFrame = 0;

    const observer: ObserverTrackingState = {
      targetX: 0.5,
      targetY: 0.5,
      x: 0.5,
      y: 0.5,
      targetInfluence: 0,
      influence: 0,
      targetVelocityX: 0,
      targetVelocityY: 0,
      velocityX: 0,
      velocityY: 0,
      lastPointerTimestamp: 0,
      lastMoveTimestamp: 0,
      lastFrameTimestamp: 0,
      hasPointerSample: false,
    };
    const drag: DragTrackingState = {
      pointerId: null,
      active: false,
      targetX: 0.5,
      targetY: 0.5,
      x: 0.5,
      y: 0.5,
      targetStrength: 0,
      strength: 0,
      targetVelocityX: 0,
      targetVelocityY: 0,
      velocityX: 0,
      velocityY: 0,
      lastPointerTimestamp: 0,
      lastFrameTimestamp: 0,
    };
    const observerFrame: HeroSignalObserverFrame = {
      x: 0.5,
      y: 0.5,
      influence: 0,
      velocityX: 0,
      velocityY: 0,
      speed: 0,
      dragX: 0.5,
      dragY: 0.5,
      dragStrength: 0,
      dragVelocityX: 0,
      dragVelocityY: 0,
      dragging: 0,
    };

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

    const deactivateObserver = () => {
      observer.targetInfluence = 0;
      observer.targetVelocityX = 0;
      observer.targetVelocityY = 0;
      observer.hasPointerSample = false;
    };

    const normalizePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();

      if (bounds.width <= 0 || bounds.height <= 0) {
        return null;
      }

      return {
        x: clampNumber(
          (event.clientX - bounds.left) / bounds.width,
          DRAG_EDGE_MARGIN,
          1 - DRAG_EDGE_MARGIN,
        ),
        y: clampNumber(
          1 - (event.clientY - bounds.top) / bounds.height,
          DRAG_EDGE_MARGIN,
          1 - DRAG_EDGE_MARGIN,
        ),
        bounds,
      };
    };

    const releaseDrag = (event?: PointerEvent) => {
      if (event && drag.pointerId !== null && event.pointerId !== drag.pointerId) {
        return;
      }

      if (drag.pointerId !== null && canvas.hasPointerCapture(drag.pointerId)) {
        canvas.releasePointerCapture(drag.pointerId);
      }

      drag.active = false;
      drag.pointerId = null;
      drag.targetStrength = 0;
      drag.targetVelocityX = 0;
      drag.targetVelocityY = 0;
      container.dataset.interaction = "idle";
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" && !drag.active) {
        deactivateObserver();
        return;
      }

      const pointer = normalizePointer(event);

      if (!pointer) {
        deactivateObserver();
        return;
      }

      const now = performance.now();
      const normalizedX = pointer.x;
      const normalizedY = pointer.y;
      const { bounds } = pointer;
      const insideObserverField =
        event.clientX >= bounds.left - OBSERVER_FIELD_MARGIN_PX &&
        event.clientX <= bounds.right + OBSERVER_FIELD_MARGIN_PX &&
        event.clientY >= bounds.top - OBSERVER_FIELD_MARGIN_PX &&
        event.clientY <= bounds.bottom + OBSERVER_FIELD_MARGIN_PX;

      if (observer.hasPointerSample) {
        const deltaSeconds = clampNumber(
          (now - observer.lastPointerTimestamp) / 1000,
          1 / 240,
          0.05,
        );
        const rawVelocityX = (normalizedX - observer.targetX) / deltaSeconds;
        const rawVelocityY = (normalizedY - observer.targetY) / deltaSeconds;

        observer.targetVelocityX = clampNumber(
          rawVelocityX,
          -OBSERVER_MAX_VELOCITY,
          OBSERVER_MAX_VELOCITY,
        );
        observer.targetVelocityY = clampNumber(
          rawVelocityY,
          -OBSERVER_MAX_VELOCITY,
          OBSERVER_MAX_VELOCITY,
        );
      }

      observer.targetX = clampNumber(normalizedX, -0.35, 1.35);
      observer.targetY = clampNumber(normalizedY, -0.35, 1.35);
      observer.targetInfluence = insideObserverField ? 1 : 0;
      observer.lastPointerTimestamp = now;
      observer.lastMoveTimestamp = now;
      observer.hasPointerSample = true;

      if (drag.active && drag.pointerId === event.pointerId) {
        const deltaSeconds = clampNumber((now - drag.lastPointerTimestamp) / 1000, 1 / 240, 0.05);
        const rawVelocityX = (normalizedX - drag.targetX) / deltaSeconds;
        const rawVelocityY = (normalizedY - drag.targetY) / deltaSeconds;

        drag.targetVelocityX = clampNumber(rawVelocityX, -DRAG_MAX_VELOCITY, DRAG_MAX_VELOCITY);
        drag.targetVelocityY = clampNumber(rawVelocityY, -DRAG_MAX_VELOCITY, DRAG_MAX_VELOCITY);
        drag.targetX = normalizedX;
        drag.targetY = normalizedY;
        drag.lastPointerTimestamp = now;
        event.preventDefault();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch" || motionQuery.matches) {
        return;
      }

      const pointer = normalizePointer(event);

      if (!pointer) {
        return;
      }

      const signalY = renderer.locateSignalY(pointer.x, pointer.y, DRAG_CAPTURE_RADIUS_PX);

      if (signalY === null) {
        return;
      }

      drag.pointerId = event.pointerId;
      drag.active = true;
      drag.targetX = pointer.x;
      drag.targetY = pointer.y;
      drag.x = pointer.x;
      drag.y = signalY;
      drag.targetStrength = 1;
      drag.strength = Math.max(drag.strength, 0.86);
      drag.targetVelocityX = observer.targetVelocityX;
      drag.targetVelocityY = observer.targetVelocityY;
      drag.velocityX = observer.velocityX;
      drag.velocityY = observer.velocityY;
      drag.lastPointerTimestamp = performance.now();
      drag.lastFrameTimestamp = 0;

      observer.targetX = pointer.x;
      observer.targetY = pointer.y;
      observer.targetInfluence = 1;
      observer.influence = Math.max(observer.influence, 0.82);

      canvas.setPointerCapture(event.pointerId);
      container.dataset.interaction = "dragging";
      event.preventDefault();
    };

    const updateObserverFrame = (timestamp: number) => {
      const deltaSeconds =
        observer.lastFrameTimestamp === 0
          ? 0
          : clampNumber((timestamp - observer.lastFrameTimestamp) / 1000, 0, 0.05);
      observer.lastFrameTimestamp = timestamp;

      const positionResponse = 1 - Math.exp(-18 * deltaSeconds);
      const velocityResponse = 1 - Math.exp(-22 * deltaSeconds);
      const influenceRate = observer.targetInfluence > observer.influence ? 12 : 4.5;
      const influenceResponse = 1 - Math.exp(-influenceRate * deltaSeconds);

      observer.x += (observer.targetX - observer.x) * positionResponse;
      observer.y += (observer.targetY - observer.y) * positionResponse;
      observer.velocityX += (observer.targetVelocityX - observer.velocityX) * velocityResponse;
      observer.velocityY += (observer.targetVelocityY - observer.velocityY) * velocityResponse;
      observer.influence += (observer.targetInfluence - observer.influence) * influenceResponse;

      if (timestamp - observer.lastMoveTimestamp > 72) {
        const velocityDecay = Math.exp(-8.5 * deltaSeconds);
        observer.targetVelocityX *= velocityDecay;
        observer.targetVelocityY *= velocityDecay;
      }

      const speed = clampNumber(
        Math.hypot(observer.velocityX, observer.velocityY) / OBSERVER_MAX_VELOCITY,
        0,
        1,
      );

      const dragDeltaSeconds =
        drag.lastFrameTimestamp === 0
          ? 0
          : clampNumber((timestamp - drag.lastFrameTimestamp) / 1000, 0, 0.05);
      drag.lastFrameTimestamp = timestamp;

      if (drag.active) {
        const dragPositionResponse = 1 - Math.exp(-46 * dragDeltaSeconds);
        const dragVelocityResponse = 1 - Math.exp(-28 * dragDeltaSeconds);
        const dragStrengthResponse = 1 - Math.exp(-32 * dragDeltaSeconds);

        drag.x += (drag.targetX - drag.x) * dragPositionResponse;
        drag.y += (drag.targetY - drag.y) * dragPositionResponse;
        drag.velocityX += (drag.targetVelocityX - drag.velocityX) * dragVelocityResponse;
        drag.velocityY += (drag.targetVelocityY - drag.velocityY) * dragVelocityResponse;
        drag.strength += (drag.targetStrength - drag.strength) * dragStrengthResponse;
      } else {
        const springAccelerationY = (0.5 - drag.y) * 34 - drag.velocityY * 7.5;
        drag.velocityY += springAccelerationY * dragDeltaSeconds;
        drag.velocityX *= Math.exp(-5.5 * dragDeltaSeconds);
        drag.y += drag.velocityY * dragDeltaSeconds;
        drag.x = clampNumber(
          drag.x + drag.velocityX * dragDeltaSeconds * 0.04,
          DRAG_EDGE_MARGIN,
          1 - DRAG_EDGE_MARGIN,
        );
        drag.strength *= Math.exp(-3.4 * dragDeltaSeconds);

        if (drag.strength < 0.001) {
          drag.strength = 0;
          drag.velocityX = 0;
          drag.velocityY = 0;
        }
      }

      observerFrame.x = observer.x;
      observerFrame.y = observer.y;
      observerFrame.influence = observer.influence;
      observerFrame.velocityX = observer.velocityX;
      observerFrame.velocityY = observer.velocityY;
      observerFrame.speed = speed;
      observerFrame.dragX = drag.x;
      observerFrame.dragY = drag.y;
      observerFrame.dragStrength = drag.strength;
      observerFrame.dragVelocityX = drag.velocityX;
      observerFrame.dragVelocityY = drag.velocityY;
      observerFrame.dragging = drag.active ? 1 : 0;
    };

    const renderFrame = (timestamp: number) => {
      if (timestamp - lastFrame >= FRAME_INTERVAL_MS) {
        const elapsedSeconds = (timestamp - animationStart) / 1000;
        elapsedBeforePause = elapsedSeconds;
        updateObserverFrame(timestamp);
        renderer.render(elapsedSeconds, audioSource.sample(elapsedSeconds), 1, observerFrame);
        lastFrame = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const startAnimation = () => {
      stopAnimation();
      resize();
      animationStart = performance.now() - elapsedBeforePause * 1000;
      lastFrame = 0;
      observer.lastFrameTimestamp = 0;
      drag.lastFrameTimestamp = 0;
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
        releaseDrag();
        deactivateObserver();
        stopAnimation();
        return;
      }

      startAnimation();
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      releaseDrag();
      stopAnimation();
      container.dataset.renderer = "fallback";
    };

    const handleWindowBlur = () => {
      releaseDrag();
      deactivateObserver();
    };

    void audioSource.start();
    resizeObserver.observe(container);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", releaseDrag);
    window.addEventListener("pointercancel", releaseDrag);
    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("blur", handleWindowBlur);
    document.documentElement.addEventListener("pointerleave", deactivateObserver);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    motionQuery.addEventListener("change", reconcileAnimationState);
    document.addEventListener("visibilitychange", reconcileAnimationState);
    reconcileAnimationState();

    return () => {
      stopAnimation();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", releaseDrag);
      window.removeEventListener("pointercancel", releaseDrag);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("blur", handleWindowBlur);
      document.documentElement.removeEventListener("pointerleave", deactivateObserver);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      motionQuery.removeEventListener("change", reconcileAnimationState);
      document.removeEventListener("visibilitychange", reconcileAnimationState);
      audioSource.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="hero-signal" data-renderer="webgl">
      <canvas ref={canvasRef} className="hero-signal__canvas" aria-hidden="true" />

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
