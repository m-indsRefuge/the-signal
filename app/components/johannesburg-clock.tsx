import { useMemo } from "react";

import { useSecondTick } from "./second-tick";

const TIME_ZONE = "Africa/Johannesburg";

function formatJohannesburgTime(timestamp: number): {
  display: string;
  dateTime: string;
} {
  if (timestamp === 0) {
    return {
      display: "-- -- --",
      dateTime: "",
    };
  }

  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat("en-ZA", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "--";

  return {
    display: `${part("hour")} ${part("minute")} ${part("second")}`,
    dateTime: date.toISOString(),
  };
}

export function JohannesburgClock() {
  const timestamp = useSecondTick();
  const time = useMemo(() => formatJohannesburgTime(timestamp), [timestamp]);

  return (
    <div className="signal-threshold__footer" aria-label="Johannesburg signal coordinates">
      <div className="signal-threshold__footer-info">
        <div className="signal-threshold__coordinates">
          <span>26°12′15″ S</span>
          <span>28°02′50″ E</span>
        </div>

        <div className="signal-threshold__clock">
          <time dateTime={time.dateTime}>{time.display}</time>
          <span className="signal-threshold__clock-zone">SAST · Johannesburg, South Africa</span>
        </div>
      </div>

      <a className="signal-threshold__scroll" href="#threshold-briefing">
        Scroll
      </a>
    </div>
  );
}
