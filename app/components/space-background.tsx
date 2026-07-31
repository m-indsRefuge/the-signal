import { useEffect, useRef } from "react";

import "./space-background.css";

const STAR_COUNT = 92;
const FRAME_INTERVAL_MS = 1000 / 30;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type Star = {
  x: number;
  y: number;
  depth: number;
  radius: number;
  brightness: number;
};

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createStar(random: () => number, nearCentre = false): Star {
  return {
    x: nearCentre ? 0.43 + random() * 0.14 : random(),
    y: nearCentre ? 0.43 + random() * 0.14 : random(),
    depth: 0.12 + random() * 0.88,
    radius: 0.28 + random() * 0.9,
    brightness: 0.18 + random() * 0.46,
  };
}

export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const random = createSeededRandom(0x5349474e);
    const stars = Array.from({ length: STAR_COUNT }, () => createStar(random));

    let animationFrameId: number | null = null;
    let previousTime = performance.now();
    let lastFrame = 0;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;

    const resizeCanvas = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      canvas.width = Math.floor(viewportWidth * pixelRatio);
      canvas.height = Math.floor(viewportHeight * pixelRatio);
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const drawStars = (deltaSeconds: number, moveStars: boolean) => {
      const centreX = viewportWidth * 0.52;
      const centreY = viewportHeight * 0.46;

      context.clearRect(0, 0, viewportWidth, viewportHeight);

      for (const star of stars) {
        const dx = star.x * viewportWidth - centreX;
        const dy = star.y * viewportHeight - centreY;

        if (moveStars) {
          const speed = 0.0055 * star.depth;
          star.x += (dx / viewportWidth) * speed * deltaSeconds;
          star.y += (dy / viewportHeight) * speed * deltaSeconds;

          const outsideFrame = star.x < -0.05 || star.x > 1.05 || star.y < -0.05 || star.y > 1.05;

          if (outsideFrame) {
            const replacement = createStar(random, true);
            Object.assign(star, replacement);
          }
        }

        const x = star.x * viewportWidth;
        const y = star.y * viewportHeight;
        const alpha = star.brightness * (0.35 + star.depth * 0.55);
        const radius = star.radius * (0.48 + star.depth * 0.72);

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(220, 232, 255, ${alpha.toFixed(3)})`;
        context.fill();
      }
    };

    const stopAnimation = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const animate = (currentTime: number) => {
      if (currentTime - lastFrame >= FRAME_INTERVAL_MS) {
        const deltaSeconds = Math.min((currentTime - previousTime) / 1000, 0.05);
        previousTime = currentTime;
        lastFrame = currentTime;
        drawStars(deltaSeconds, true);
      }

      animationFrameId = window.requestAnimationFrame(animate);
    };

    const reconcileAnimationState = () => {
      stopAnimation();
      previousTime = performance.now();
      lastFrame = 0;

      if (mediaQuery.matches || document.visibilityState === "hidden") {
        drawStars(0, false);
        return;
      }

      animationFrameId = window.requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    mediaQuery.addEventListener("change", reconcileAnimationState);
    document.addEventListener("visibilitychange", reconcileAnimationState);
    reconcileAnimationState();

    return () => {
      stopAnimation();
      window.removeEventListener("resize", resizeCanvas);
      mediaQuery.removeEventListener("change", reconcileAnimationState);
      document.removeEventListener("visibilitychange", reconcileAnimationState);
    };
  }, []);

  return (
    <div className="space-background" aria-hidden="true">
      <div className="space-background__image space-background__image--base" />
      <div className="space-background__image space-background__image--drift" />
      <canvas ref={canvasRef} className="space-background__stars" />
      <div className="space-background__shade" />
    </div>
  );
}
