import { describe, expect, it } from "vitest";

import {
  DEFAULT_KTS_OBSERVATION_BUDGET,
  KTS_OBSERVATION_ADAPTER_ID,
  KTS_OBSERVATION_ADAPTER_VERSION,
  KTS_OBSERVATION_FAILURE_CODES,
  KTS_OBSERVATION_LEVELS,
  KTS_OBSERVATION_SCHEMA_ID,
  KTS_OBSERVATION_SCHEMA_VERSION,
  deepFreezeKtsValue,
  isKtsJsonCompatible,
  isKtsObservationId,
  isKtsObservationLevel,
  movementDirection,
  toBasisPoints,
  validateKtsObservationBudget,
} from "../app/features/keep-the-signal/intelligence-adapter";

describe("KTS-I4-C observation contract", () => {
  it("exports the accepted schema identity", () => {
    expect(KTS_OBSERVATION_SCHEMA_ID).toBe("kts.observation");
    expect(KTS_OBSERVATION_SCHEMA_VERSION).toBe(1);
  });

  it("exports the accepted adapter identity", () => {
    expect(KTS_OBSERVATION_ADAPTER_ID).toBe("keep-the-signal");
    expect(KTS_OBSERVATION_ADAPTER_VERSION).toBe("KTS-I4-C");
  });

  it("exports only observation levels zero and one", () => {
    expect(KTS_OBSERVATION_LEVELS).toEqual([0, 1]);
  });

  it("accepts a compact observation identity", () => {
    expect(isKtsObservationId("session-1:tick.42")).toBe(true);
  });

  it("rejects an empty observation identity", () => {
    expect(isKtsObservationId("")).toBe(false);
  });

  it("rejects an observation identity with leading punctuation", () => {
    expect(isKtsObservationId("-invalid")).toBe(false);
  });

  it("rejects whitespace in an observation identity", () => {
    expect(isKtsObservationId("invalid id")).toBe(false);
  });

  it("rejects an observation identity above 128 characters", () => {
    expect(isKtsObservationId(`a${"b".repeat(128)}`)).toBe(false);
  });

  it("accepts observation level zero", () => {
    expect(isKtsObservationLevel(0)).toBe(true);
  });

  it("accepts observation level one", () => {
    expect(isKtsObservationLevel(1)).toBe(true);
  });

  it("rejects an unsupported observation level", () => {
    expect(isKtsObservationLevel(2)).toBe(false);
  });

  it("accepts the exported default budget", () => {
    expect(validateKtsObservationBudget(DEFAULT_KTS_OBSERVATION_BUDGET)).toBe(true);
  });

  it("accepts zero collection budgets", () => {
    expect(
      validateKtsObservationBudget({
        ...DEFAULT_KTS_OBSERVATION_BUDGET,
        maximumEnemies: 0,
        maximumRecentEvents: 0,
      }),
    ).toBe(true);
  });

  it("rejects a negative entity budget", () => {
    expect(
      validateKtsObservationBudget({
        ...DEFAULT_KTS_OBSERVATION_BUDGET,
        maximumEnemies: -1,
      }),
    ).toBe(false);
  });

  it("rejects a zero serialized-character budget", () => {
    expect(
      validateKtsObservationBudget({
        ...DEFAULT_KTS_OBSERVATION_BUDGET,
        maximumSerializedCharacters: 0,
      }),
    ).toBe(false);
  });

  it("rejects a fractional event budget", () => {
    expect(
      validateKtsObservationBudget({
        ...DEFAULT_KTS_OBSERVATION_BUDGET,
        maximumRecentEvents: 1.5,
      }),
    ).toBe(false);
  });

  it("accepts every JSON primitive", () => {
    expect([null, true, false, "signal", 0, -12.5].every(isKtsJsonCompatible)).toBe(true);
  });

  it("accepts nested plain JSON records", () => {
    expect(isKtsJsonCompatible({ a: [1, { b: "c" }], d: null })).toBe(true);
  });

  it("rejects undefined at the JSON boundary", () => {
    expect(isKtsJsonCompatible({ value: undefined })).toBe(false);
  });

  it("rejects functions at the JSON boundary", () => {
    expect(isKtsJsonCompatible({ value: () => 1 })).toBe(false);
  });

  it("rejects class instances at the JSON boundary", () => {
    class Example {
      readonly value = 1;
    }

    expect(isKtsJsonCompatible(new Example())).toBe(false);
  });

  it("rejects cyclic records at the JSON boundary", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isKtsJsonCompatible(cyclic)).toBe(false);
  });

  it("deeply freezes nested records", () => {
    const value = deepFreezeKtsValue({ nested: { count: 1 } });
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.nested)).toBe(true);
  });

  it("deeply freezes nested arrays", () => {
    const value = deepFreezeKtsValue({ values: [{ count: 1 }] });
    expect(Object.isFrozen(value.values)).toBe(true);
    expect(Object.isFrozen(value.values[0])).toBe(true);
  });

  it("projects signed movement directions", () => {
    expect([movementDirection(-10), movementDirection(0), movementDirection(10)]).toEqual([
      -1, 0, 1,
    ]);
  });

  it("projects clamped integer basis points", () => {
    expect(toBasisPoints(5_000, 10_000)).toBe(5_000);
    expect(toBasisPoints(12_000, 10_000)).toBe(10_000);
    expect(toBasisPoints(-1, 10_000)).toBe(0);
  });

  it("exports the complete closed adapter failure taxonomy", () => {
    expect(KTS_OBSERVATION_FAILURE_CODES).toEqual([
      "invalid_observation_request",
      "invalid_observation_id",
      "invalid_observation_level",
      "invalid_budget",
      "invalid_engine_state",
      "invalid_event_window",
      "future_event",
      "unknown_event_type",
      "projection_budget_exceeded",
      "observation_not_json",
      "adapter_internal_failure",
    ]);
  });
});
