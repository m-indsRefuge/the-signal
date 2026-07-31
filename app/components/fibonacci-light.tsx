import { useEffect, useRef } from "react";

const FIBONACCI_SECONDS = [1, 1, 2, 3, 5, 8, 13];
const REVERSE_FIBONACCI_INTENSITY = [1, 0.72, 0.54, 0.38, 0.28, 0.2, 0.16];
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function FibonacciLight() {
  const lightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const light = lightRef.current;

    if (!light) {
      return;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    let cancelled = false;
    let timeoutId: number | undefined;
    let activeAnimation: Animation | undefined;

    const stopPulse = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      activeAnimation?.cancel();
      activeAnimation = undefined;
    };

    const holdReducedMotionState = () => {
      stopPulse();
      light.style.opacity = "0.2";
      light.style.transform = "scale(1)";
    };

    const runPulse = (phase: number) => {
      if (cancelled || mediaQuery.matches) {
        holdReducedMotionState();
        return;
      }

      const duration = FIBONACCI_SECONDS[phase] * 1000;
      const peakOpacity = REVERSE_FIBONACCI_INTENSITY[phase];

      activeAnimation = light.animate(
        [
          {
            opacity: 0.16,
            transform: "scale(0.985)",
            offset: 0,
          },
          {
            opacity: peakOpacity,
            transform: "scale(1.018)",
            offset: 0.46,
          },
          {
            opacity: Math.max(0.16, peakOpacity * 0.46),
            transform: "scale(1.004)",
            offset: 0.72,
          },
          {
            opacity: 0.16,
            transform: "scale(0.985)",
            offset: 1,
          },
        ],
        {
          duration,
          easing: "cubic-bezier(0.37, 0, 0.2, 1)",
          fill: "both",
        },
      );

      timeoutId = window.setTimeout(() => {
        activeAnimation = undefined;
        runPulse((phase + 1) % FIBONACCI_SECONDS.length);
      }, duration);
    };

    const handleMotionPreference = () => {
      stopPulse();

      if (mediaQuery.matches) {
        holdReducedMotionState();
        return;
      }

      light.style.removeProperty("opacity");
      light.style.removeProperty("transform");
      runPulse(0);
    };

    mediaQuery.addEventListener("change", handleMotionPreference);
    handleMotionPreference();

    return () => {
      cancelled = true;
      stopPulse();
      mediaQuery.removeEventListener("change", handleMotionPreference);
    };
  }, []);

  return <div ref={lightRef} className="signal-threshold__pink-field" aria-hidden="true" />;
}
