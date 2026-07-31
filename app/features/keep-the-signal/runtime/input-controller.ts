import type { PowerChannel, PowerShiftAction, TickFrame } from "../engine";

const EMPTY_ENVIRONMENT_EVENTS = Object.freeze([]);
const MAX_QUEUED_POWER_SHIFTS = 6;

export type HeldInputControl = "left" | "right" | "up" | "down" | "fire";
export type RuntimeInputCommand = "toggle_pause";

export interface KeyboardInputLike {
  readonly code: string;
  readonly repeat?: boolean;
}

export interface KeyboardInputResult {
  readonly handled: boolean;
  readonly preventDefault: boolean;
  readonly queued: boolean;
  readonly command: RuntimeInputCommand | null;
}

export interface InputControllerSnapshot {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly fire: boolean;
  readonly recoveryPulseQueued: boolean;
  readonly queuedPowerShifts: readonly Readonly<PowerShiftAction>[];
}

export interface KtsInputController {
  handleKeyDown(event: KeyboardInputLike): KeyboardInputResult;
  handleKeyUp(event: KeyboardInputLike): KeyboardInputResult;
  pressHeld(control: HeldInputControl, sourceId: string): void;
  releaseHeld(control: HeldInputControl, sourceId: string): void;
  releaseSource(sourceId: string): void;
  queueRecoveryPulse(): boolean;
  queuePowerShift(powerShift: Readonly<PowerShiftAction>): boolean;
  sampleTickFrame(): Readonly<TickFrame>;
  clearHeldInputs(): void;
  clearQueuedActions(): void;
  clearAllInputs(): void;
  snapshot(): InputControllerSnapshot;
}

const HELD_KEY_CODES: Readonly<Record<string, HeldInputControl>> = Object.freeze({
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  Space: "fire",
});

const POWER_SHIFT_KEY_CODES: Readonly<Record<string, Readonly<PowerShiftAction>>> = Object.freeze({
  Digit1: Object.freeze({ from: "defence", to: "weapons" }),
  Digit2: Object.freeze({ from: "signal", to: "weapons" }),
  Digit3: Object.freeze({ from: "weapons", to: "defence" }),
  Digit4: Object.freeze({ from: "signal", to: "defence" }),
  Digit5: Object.freeze({ from: "weapons", to: "signal" }),
  Digit6: Object.freeze({ from: "defence", to: "signal" }),
});

const POWER_CHANNELS: readonly PowerChannel[] = Object.freeze(["weapons", "defence", "signal"]);

export function createInputController(): KtsInputController {
  const heldSources: Record<HeldInputControl, Set<string>> = {
    left: new Set<string>(),
    right: new Set<string>(),
    up: new Set<string>(),
    down: new Set<string>(),
    fire: new Set<string>(),
  };

  let recoveryPulseQueued = false;
  const powerShiftQueue: PowerShiftAction[] = [];

  const pressHeld = (control: HeldInputControl, sourceId: string): void => {
    assertHeldControl(control);
    assertSourceId(sourceId);
    heldSources[control].add(sourceId);
  };

  const releaseHeld = (control: HeldInputControl, sourceId: string): void => {
    assertHeldControl(control);
    assertSourceId(sourceId);
    heldSources[control].delete(sourceId);
  };

  const releaseSource = (sourceId: string): void => {
    assertSourceId(sourceId);

    for (const sources of Object.values(heldSources)) {
      sources.delete(sourceId);
    }
  };

  const queueRecoveryPulse = (): boolean => {
    if (recoveryPulseQueued) {
      return false;
    }

    recoveryPulseQueued = true;
    return true;
  };

  const queuePowerShift = (powerShift: Readonly<PowerShiftAction>): boolean => {
    assertPowerShift(powerShift);

    if (powerShiftQueue.length >= MAX_QUEUED_POWER_SHIFTS) {
      return false;
    }

    powerShiftQueue.push({
      from: powerShift.from,
      to: powerShift.to,
    });

    return true;
  };

  const handleKeyDown = (event: KeyboardInputLike): KeyboardInputResult => {
    const heldControl = HELD_KEY_CODES[event.code];

    if (heldControl !== undefined) {
      pressHeld(heldControl, keyboardSourceId(event.code));
      return inputResult(true, true, false, null);
    }

    if (event.code === "KeyR") {
      return inputResult(true, true, event.repeat === true ? false : queueRecoveryPulse(), null);
    }

    const powerShift = POWER_SHIFT_KEY_CODES[event.code];

    if (powerShift !== undefined) {
      return inputResult(
        true,
        true,
        event.repeat === true ? false : queuePowerShift(powerShift),
        null,
      );
    }

    if (event.code === "Escape" || event.code === "KeyP") {
      return inputResult(true, true, false, event.repeat === true ? null : "toggle_pause");
    }

    return inputResult(false, false, false, null);
  };

  const handleKeyUp = (event: KeyboardInputLike): KeyboardInputResult => {
    const heldControl = HELD_KEY_CODES[event.code];

    if (heldControl === undefined) {
      return inputResult(false, false, false, null);
    }

    releaseHeld(heldControl, keyboardSourceId(event.code));
    return inputResult(true, true, false, null);
  };

  const sampleTickFrame = (): Readonly<TickFrame> => {
    const left = heldSources.left.size > 0;
    const right = heldSources.right.size > 0;
    const up = heldSources.up.size > 0;
    const down = heldSources.down.size > 0;
    const fire = heldSources.fire.size > 0;
    const powerShift = powerShiftQueue.shift();

    const player = powerShift
      ? Object.freeze({
          moveX: resolveAxis(left, right),
          moveY: resolveAxis(up, down),
          fire,
          recoveryPulse: recoveryPulseQueued,
          powerShift: Object.freeze({ ...powerShift }),
        })
      : Object.freeze({
          moveX: resolveAxis(left, right),
          moveY: resolveAxis(up, down),
          fire,
          recoveryPulse: recoveryPulseQueued,
        });

    recoveryPulseQueued = false;

    return Object.freeze({
      player,
      environmentEvents: EMPTY_ENVIRONMENT_EVENTS,
    });
  };

  const clearHeldInputs = (): void => {
    for (const sources of Object.values(heldSources)) {
      sources.clear();
    }
  };

  const clearQueuedActions = (): void => {
    recoveryPulseQueued = false;
    powerShiftQueue.length = 0;
  };

  const clearAllInputs = (): void => {
    clearHeldInputs();
    clearQueuedActions();
  };

  const snapshot = (): InputControllerSnapshot =>
    Object.freeze({
      left: heldSources.left.size > 0,
      right: heldSources.right.size > 0,
      up: heldSources.up.size > 0,
      down: heldSources.down.size > 0,
      fire: heldSources.fire.size > 0,
      recoveryPulseQueued,
      queuedPowerShifts: Object.freeze(
        powerShiftQueue.map((powerShift) => Object.freeze({ ...powerShift })),
      ),
    });

  return Object.freeze({
    handleKeyDown,
    handleKeyUp,
    pressHeld,
    releaseHeld,
    releaseSource,
    queueRecoveryPulse,
    queuePowerShift,
    sampleTickFrame,
    clearHeldInputs,
    clearQueuedActions,
    clearAllInputs,
    snapshot,
  });
}

function keyboardSourceId(code: string): string {
  return `keyboard:${code}`;
}

function resolveAxis(negative: boolean, positive: boolean): -1 | 0 | 1 {
  if (negative === positive) {
    return 0;
  }

  return negative ? -1 : 1;
}

function inputResult(
  handled: boolean,
  preventDefault: boolean,
  queued: boolean,
  command: RuntimeInputCommand | null,
): KeyboardInputResult {
  return Object.freeze({
    handled,
    preventDefault,
    queued,
    command,
  });
}

function assertSourceId(sourceId: string): void {
  if (typeof sourceId !== "string" || sourceId.trim().length === 0) {
    throw new TypeError("sourceId must be a non-empty string.");
  }
}

function assertHeldControl(control: HeldInputControl): void {
  if (!Object.hasOwn(HELD_CONTROL_MARKERS, control)) {
    throw new TypeError("Held input control is invalid.");
  }
}

const HELD_CONTROL_MARKERS: Readonly<Record<HeldInputControl, true>> = Object.freeze({
  left: true,
  right: true,
  up: true,
  down: true,
  fire: true,
});

function assertPowerShift(powerShift: Readonly<PowerShiftAction>): void {
  if (
    typeof powerShift !== "object" ||
    powerShift === null ||
    !POWER_CHANNELS.includes(powerShift.from) ||
    !POWER_CHANNELS.includes(powerShift.to) ||
    powerShift.from === powerShift.to
  ) {
    throw new TypeError("Power shift must move power between two different valid channels.");
  }
}

export { MAX_QUEUED_POWER_SHIFTS };
