import { describe, expect, it } from "vitest";

import {
  MAX_QUEUED_POWER_SHIFTS,
  createInputController,
} from "../app/features/keep-the-signal/runtime";

describe("Keep the Signal KTS-I3 deterministic input controller", () => {
  it.each([
    ["KeyA", -1, 0],
    ["ArrowLeft", -1, 0],
    ["KeyD", 1, 0],
    ["ArrowRight", 1, 0],
    ["KeyW", 0, -1],
    ["ArrowUp", 0, -1],
    ["KeyS", 0, 1],
    ["ArrowDown", 0, 1],
  ])("maps %s to the accepted movement axis", (code: string, moveX: number, moveY: number) => {
    const controller = createInputController();

    const result = controller.handleKeyDown({ code });
    const frame = controller.sampleTickFrame();

    expect(result.handled).toBe(true);
    expect(result.preventDefault).toBe(true);
    expect(frame.player.moveX).toBe(moveX);
    expect(frame.player.moveY).toBe(moveY);
  });

  it("neutralizes opposing horizontal directions", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "KeyA" });
    controller.handleKeyDown({ code: "KeyD" });

    expect(controller.sampleTickFrame().player.moveX).toBe(0);
  });

  it("neutralizes opposing vertical directions", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "KeyW" });
    controller.handleKeyDown({ code: "KeyS" });

    expect(controller.sampleTickFrame().player.moveY).toBe(0);
  });

  it("keeps fire active while Space remains held", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "Space" });

    expect(controller.sampleTickFrame().player.fire).toBe(true);
    expect(controller.sampleTickFrame().player.fire).toBe(true);

    controller.handleKeyUp({ code: "Space" });
    expect(controller.sampleTickFrame().player.fire).toBe(false);
  });

  it("consumes a recovery pulse exactly once", () => {
    const controller = createInputController();

    expect(controller.handleKeyDown({ code: "KeyR" }).queued).toBe(true);
    expect(controller.sampleTickFrame().player.recoveryPulse).toBe(true);
    expect(controller.sampleTickFrame().player.recoveryPulse).toBe(false);
  });

  it("suppresses repeated recovery keydown events", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "KeyR" });
    const repeated = controller.handleKeyDown({ code: "KeyR", repeat: true });

    expect(repeated.handled).toBe(true);
    expect(repeated.queued).toBe(false);
    expect(controller.sampleTickFrame().player.recoveryPulse).toBe(true);
    expect(controller.sampleTickFrame().player.recoveryPulse).toBe(false);
  });

  it.each([
    ["Digit1", { from: "defence", to: "weapons" }],
    ["Digit2", { from: "signal", to: "weapons" }],
    ["Digit3", { from: "weapons", to: "defence" }],
    ["Digit4", { from: "signal", to: "defence" }],
    ["Digit5", { from: "weapons", to: "signal" }],
    ["Digit6", { from: "defence", to: "signal" }],
  ] as const)(
    "maps %s to its directed power transfer",
    (
      code: string,
      expected: Readonly<{
        from: "weapons" | "defence" | "signal";
        to: "weapons" | "defence" | "signal";
      }>,
    ) => {
      const controller = createInputController();

      expect(controller.handleKeyDown({ code }).queued).toBe(true);
      expect(controller.sampleTickFrame().player.powerShift).toEqual(expected);
    },
  );

  it("consumes at most one queued power shift per tick", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "Digit1" });
    controller.handleKeyDown({ code: "Digit2" });

    expect(controller.sampleTickFrame().player.powerShift).toEqual({
      from: "defence",
      to: "weapons",
    });
    expect(controller.sampleTickFrame().player.powerShift).toEqual({
      from: "signal",
      to: "weapons",
    });
    expect(controller.sampleTickFrame().player.powerShift).toBeUndefined();
  });

  it("bounds the power-shift queue at six actions", () => {
    const controller = createInputController();

    for (let index = 0; index < MAX_QUEUED_POWER_SHIFTS; index += 1) {
      expect(controller.queuePowerShift({ from: "defence", to: "weapons" })).toBe(true);
    }

    expect(controller.queuePowerShift({ from: "signal", to: "weapons" })).toBe(false);
    expect(controller.snapshot().queuedPowerShifts).toHaveLength(MAX_QUEUED_POWER_SHIFTS);
  });

  it("rejects invalid runtime power-shift values", () => {
    const controller = createInputController();

    expect(() => controller.queuePowerShift({ from: "weapons", to: "weapons" })).toThrow(
      "two different valid channels",
    );
    expect(() => controller.queuePowerShift({ from: "invalid", to: "signal" } as never)).toThrow(
      "two different valid channels",
    );
  });

  it("returns a pause command without placing it in the engine frame", () => {
    const controller = createInputController();

    const result = controller.handleKeyDown({ code: "Escape" });
    const frame = controller.sampleTickFrame();

    expect(result.command).toBe("toggle_pause");
    expect(frame).toEqual({
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });
  });

  it("suppresses repeated pause commands", () => {
    const controller = createInputController();

    expect(controller.handleKeyDown({ code: "KeyP" }).command).toBe("toggle_pause");
    expect(controller.handleKeyDown({ code: "KeyP", repeat: true }).command).toBeNull();
  });

  it("ignores unknown keyboard codes", () => {
    const controller = createInputController();

    expect(controller.handleKeyDown({ code: "KeyQ" })).toEqual({
      handled: false,
      preventDefault: false,
      queued: false,
      command: null,
    });
  });

  it("supports independent keyboard and pointer held sources", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "KeyA" });
    controller.pressHeld("left", "pointer:7");
    controller.handleKeyUp({ code: "KeyA" });

    expect(controller.sampleTickFrame().player.moveX).toBe(-1);

    controller.releaseSource("pointer:7");
    expect(controller.sampleTickFrame().player.moveX).toBe(0);
  });

  it("clears only the released pointer source", () => {
    const controller = createInputController();

    controller.pressHeld("fire", "pointer:1");
    controller.pressHeld("right", "pointer:2");
    controller.releaseSource("pointer:1");

    const frame = controller.sampleTickFrame();
    expect(frame.player.fire).toBe(false);
    expect(frame.player.moveX).toBe(1);
  });

  it("can clear held input independently from queued actions", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "KeyD" });
    controller.handleKeyDown({ code: "KeyR" });
    controller.clearHeldInputs();

    const frame = controller.sampleTickFrame();
    expect(frame.player.moveX).toBe(0);
    expect(frame.player.recoveryPulse).toBe(true);
  });

  it("clears queued one-shot actions without clearing held input", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "Space" });
    controller.handleKeyDown({ code: "KeyR" });
    controller.handleKeyDown({ code: "Digit1" });
    controller.clearQueuedActions();

    const frame = controller.sampleTickFrame();
    expect(frame.player.fire).toBe(true);
    expect(frame.player.recoveryPulse).toBe(false);
    expect(frame.player.powerShift).toBeUndefined();
  });

  it("clears every held and queued input on visibility-style reset", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "KeyW" });
    controller.handleKeyDown({ code: "Space" });
    controller.handleKeyDown({ code: "KeyR" });
    controller.handleKeyDown({ code: "Digit4" });
    controller.clearAllInputs();

    expect(controller.sampleTickFrame()).toEqual({
      player: {
        moveX: 0,
        moveY: 0,
        fire: false,
        recoveryPulse: false,
      },
      environmentEvents: [],
    });
  });

  it("returns frozen tick-frame object graphs", () => {
    const controller = createInputController();

    controller.handleKeyDown({ code: "Digit1" });
    const frame = controller.sampleTickFrame();

    expect(Object.isFrozen(frame)).toBe(true);
    expect(Object.isFrozen(frame.player)).toBe(true);
    expect(Object.isFrozen(frame.player.powerShift)).toBe(true);
    expect(Object.isFrozen(frame.environmentEvents)).toBe(true);
  });

  it("rejects empty pointer source identifiers", () => {
    const controller = createInputController();

    expect(() => controller.pressHeld("fire", " ")).toThrow("non-empty string");
    expect(() => controller.releaseSource("")).toThrow("non-empty string");
  });
});
