import { useSyncExternalStore } from "react";

let currentTimestamp = 0;
let timeoutId: number | undefined;
const listeners = new Set<() => void>();

function emitTick() {
  currentTimestamp = Date.now();

  for (const listener of listeners) {
    listener();
  }
}

function scheduleNextTick() {
  const now = Date.now();
  const delay = 1000 - (now % 1000) + 8;

  timeoutId = window.setTimeout(() => {
    emitTick();

    if (listeners.size > 0) {
      scheduleNextTick();
    }
  }, delay);
}

function startClock() {
  if (timeoutId !== undefined) {
    return;
  }

  emitTick();
  scheduleNextTick();
}

function stopClock() {
  if (timeoutId === undefined) {
    return;
  }

  window.clearTimeout(timeoutId);
  timeoutId = undefined;
  currentTimestamp = 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    startClock();
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      stopClock();
    }
  };
}

function getSnapshot(): number {
  return currentTimestamp;
}

function getServerSnapshot(): number {
  return 0;
}

export function useSecondTick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
