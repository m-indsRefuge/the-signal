import { useEffect, useState, useSyncExternalStore } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TARGET = "THE SIGNAL";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const INITIAL_START_DELAY_MS = 650;
const INITIAL_TICK_MS = 320;
const INITIAL_SETTLE_MS = 160;
const INITIAL_STEPS = [2, 3, 2, 3, 2, 3, 2, 3];

const MAINTENANCE_DELAYS_MS = [6000, 9000, 7000, 11000];
const MAINTENANCE_TICK_MS = 600;
const MAINTENANCE_SETTLE_MS = 340;
const MAINTENANCE_STEPS = [2, 3, 2, 4];

function createInitialCharacters(target: string): string[] {
  return target.split("").map((character, index) => {
    if (character === " ") {
      return " ";
    }

    const candidate = GLYPHS[(character.charCodeAt(0) + index * 11) % GLYPHS.length];

    return candidate === character ? GLYPHS[(index * 7 + 5) % GLYPHS.length] : candidate;
  });
}

function createTransientGlyph(index: number, step: number, target: string): string {
  const candidate = GLYPHS[(index * 13 + step * 17 + 9) % GLYPHS.length];

  if (candidate !== target) {
    return candidate;
  }

  return GLYPHS[(GLYPHS.indexOf(candidate) + 7) % GLYPHS.length];
}

function subscribeToReducedMotion(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  mediaQuery.addEventListener("change", onStoreChange);

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export function SignalTitleDecoder() {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const [displayCharacters, setDisplayCharacters] = useState<string[]>(() =>
    createInitialCharacters(TARGET),
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const targetCharacters = TARGET.split("");
    const decodableIndices = targetCharacters
      .map((character, index) => (character === " " ? null : index))
      .filter((value): value is number => value !== null);

    let cancelled = false;
    const timeouts = new Set<number>();

    const schedule = (callback: () => void, delay: number) => {
      const timeoutId = window.setTimeout(() => {
        timeouts.delete(timeoutId);

        if (!cancelled) {
          callback();
        }
      }, delay);

      timeouts.add(timeoutId);
    };

    const decodeCharacter = (
      index: number,
      steps: number,
      tickDuration: number,
      settleDuration: number,
      onComplete: () => void,
    ) => {
      let step = 0;

      const tick = () => {
        if (cancelled) {
          return;
        }

        setActiveIndex(index);

        if (step < steps) {
          setDisplayCharacters((previous) => {
            const next = [...previous];
            next[index] = createTransientGlyph(index, step, targetCharacters[index]);
            return next;
          });

          step += 1;
          schedule(tick, tickDuration);
          return;
        }

        setDisplayCharacters((previous) => {
          const next = [...previous];
          next[index] = targetCharacters[index];
          return next;
        });

        schedule(() => {
          setActiveIndex(null);
          onComplete();
        }, settleDuration);
      };

      tick();
    };

    const scheduleMaintenance = (cycle: number) => {
      const delay = MAINTENANCE_DELAYS_MS[cycle % MAINTENANCE_DELAYS_MS.length];

      schedule(() => {
        const selectedIndex = decodableIndices[(cycle * 3 + 2) % decodableIndices.length];
        const steps = MAINTENANCE_STEPS[cycle % MAINTENANCE_STEPS.length];

        decodeCharacter(selectedIndex, steps, MAINTENANCE_TICK_MS, MAINTENANCE_SETTLE_MS, () => {
          scheduleMaintenance(cycle + 1);
        });
      }, delay);
    };

    const decodeSequence = (pointer: number) => {
      if (pointer >= decodableIndices.length) {
        setDisplayCharacters(targetCharacters);
        setActiveIndex(null);
        setIsResolved(true);
        scheduleMaintenance(0);
        return;
      }

      const index = decodableIndices[pointer];
      const steps = INITIAL_STEPS[pointer % INITIAL_STEPS.length];

      decodeCharacter(index, steps, INITIAL_TICK_MS, INITIAL_SETTLE_MS, () => {
        decodeSequence(pointer + 1);
      });
    };

    schedule(() => {
      setDisplayCharacters(createInitialCharacters(TARGET));
      setActiveIndex(null);
      setIsResolved(false);
      decodeSequence(0);
    }, INITIAL_START_DELAY_MS);

    return () => {
      cancelled = true;

      for (const timeoutId of timeouts) {
        window.clearTimeout(timeoutId);
      }

      timeouts.clear();
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <span className="signal-title-decoder" data-resolved="true" aria-hidden="true">
        {TARGET.split("").map((character, index) => {
          const isSpace = character === " ";

          return (
            <span
              key={index}
              className={[
                "signal-title-decoder__glyph",
                isSpace ? "signal-title-decoder__glyph--space" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isSpace ? "\u00A0" : character}
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span
      className="signal-title-decoder"
      data-resolved={isResolved ? "true" : "false"}
      aria-hidden="true"
    >
      {displayCharacters.map((character, index) => {
        const isSpace = character === " ";
        const isActive = activeIndex === index;

        return (
          <span
            key={index}
            className={[
              "signal-title-decoder__glyph",
              isSpace ? "signal-title-decoder__glyph--space" : "",
              isActive ? "signal-title-decoder__glyph--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {isSpace ? "\u00A0" : character}
          </span>
        );
      })}
    </span>
  );
}
