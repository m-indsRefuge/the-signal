const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 96;
const SAMPLE_COUNT = 240;

function createSignalPath(): string {
  const midpoint = VIEWBOX_HEIGHT / 2;

  return Array.from({ length: SAMPLE_COUNT + 1 }, (_, index) => {
    const progress = index / SAMPLE_COUNT;
    const x = progress * VIEWBOX_WIDTH;

    const primary = Math.sin(x * 0.044) * 13;
    const secondary = Math.sin(x * 0.109 + 0.8) * 5;
    const drift = Math.sin(x * 0.014 - 1.2) * 7;
    const envelope = 0.72 + Math.sin(x * 0.006) * 0.18;

    const y = midpoint + (primary + secondary + drift) * envelope;
    const command = index === 0 ? "M" : "L";

    return `${command} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

const SIGNAL_PATH = createSignalPath();

export function CarrierSignal() {
  return (
    <svg
      className="carrier-wave"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="carrier-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a30f62" stopOpacity="0.28" />
          <stop offset="20%" stopColor="#ff2ea6" stopOpacity="0.82" />
          <stop offset="51%" stopColor="#ff72c4" stopOpacity="1" />
          <stop offset="80%" stopColor="#ff2ea6" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#a30f62" stopOpacity="0.24" />
        </linearGradient>

        <filter id="carrier-glow" x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path className="carrier-wave__ghost" d={SIGNAL_PATH} />
      <path
        className="carrier-wave__line"
        d={SIGNAL_PATH}
        stroke="url(#carrier-stroke)"
        filter="url(#carrier-glow)"
      />
    </svg>
  );
}
