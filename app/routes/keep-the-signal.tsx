import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

import {
  KeepTheSignalPlayer,
  resolveKtsRouteSeed,
  type KtsRouteSeedResolution,
} from "../features/keep-the-signal/player";

export function meta() {
  const title = "Keep the Signal — The Signal";
  const description =
    "A deterministic retro-futurist arcade system for preserving carrier coherence under pressure.";

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
}

export default function KeepTheSignalRoute() {
  const location = useLocation();
  const seedCache = useRef<{
    readonly search: string;
    readonly resolution: KtsRouteSeedResolution;
  } | null>(null);
  const [resolution, setResolution] = useState<KtsRouteSeedResolution | null>(null);

  useEffect(() => {
    if (seedCache.current?.search !== location.search) {
      seedCache.current = Object.freeze({
        search: location.search,
        resolution: resolveKtsRouteSeed(location.search),
      });
    }

    setResolution(seedCache.current.resolution);
  }, [location.search]);

  if (resolution === null) {
    return (
      <main id="main-content" className="kts-player-shell">
        <section className="kts-route-boot" aria-labelledby="kts-route-boot-title">
          <p className="kts-player-kicker">KTS / BROWSER RUNTIME</p>
          <h1 id="kts-route-boot-title">Establishing carrier…</h1>
          <p>Preparing a deterministic seed and player-facing runtime.</p>
        </section>
      </main>
    );
  }

  if (resolution.status === "error" || resolution.seed === null) {
    return (
      <main id="main-content" className="kts-player-shell">
        <section className="kts-route-boot" aria-labelledby="kts-route-error-title">
          <p className="kts-player-kicker">KTS / INITIALIZATION FAULT</p>
          <h1 id="kts-route-error-title">Carrier unavailable.</h1>
          <p>{resolution.notice}</p>
          <a href="/">Return to The Signal</a>
        </section>
      </main>
    );
  }

  return (
    <KeepTheSignalPlayer
      key={`${location.search}:${resolution.seed}`}
      initialSeed={resolution.seed}
      seedNotice={resolution.notice}
    />
  );
}
