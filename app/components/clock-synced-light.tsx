import { useEffect, useRef } from "react";

import { useSecondTick } from "./second-tick";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function ClockSyncedLight() {
  const lightRef = useRef<HTMLDivElement>(null);
  const timestamp = useSecondTick();

  useEffect(() => {
    const light = lightRef.current;

    if (!light || timestamp === 0) {
      return;
    }

    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      light.getAnimations().forEach((animation) => animation.cancel());
      light.style.opacity = "0.13";
      light.style.transform = "scale(1)";
      return;
    }

    light.style.removeProperty("opacity");
    light.style.removeProperty("transform");

    const animation = light.animate(
      [
        {
          opacity: 0.12,
          transform: "scale(0.995)",
          offset: 0,
        },
        {
          opacity: 0.2,
          transform: "scale(1.004)",
          offset: 0.36,
        },
        {
          opacity: 0.15,
          transform: "scale(1.001)",
          offset: 0.68,
        },
        {
          opacity: 0.12,
          transform: "scale(0.995)",
          offset: 1,
        },
      ],
      {
        duration: 920,
        easing: "cubic-bezier(0.37, 0, 0.2, 1)",
        fill: "both",
      },
    );

    return () => {
      animation.cancel();
    };
  }, [timestamp]);

  return <div ref={lightRef} className="signal-threshold__pink-field" aria-hidden="true" />;
}
