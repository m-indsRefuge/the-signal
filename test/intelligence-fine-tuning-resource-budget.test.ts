import { describe, expect, it } from "vitest";

import {
  evaluateResourceBudget,
  validateResourceBudget,
  FineTuningFailure,
} from "../app/features/intelligence-harness/fine-tuning";
function budget() {
  return {
    maximumWallClockSeconds: 10,
    maximumOptimizerSteps: 10,
    maximumEpochs: 2,
    maximumTokens: 100,
    maximumExamples: 10,
    maximumCheckpoints: 2,
    maximumDiskBytes: 100,
    maximumRamBytes: 100,
    maximumAcceleratorMemoryBytes: 100,
    maximumCpuThreads: 4,
    maximumGpuCount: 1,
    maximumEvaluationCases: 10,
    maximumOutputBytes: 100,
    maximumExternalCostMinorUnits: 0,
  };
}
function usage() {
  return {
    wallClockSeconds: 1,
    optimizerSteps: 1,
    epochs: 1,
    tokens: 1,
    examples: 1,
    checkpoints: 1,
    diskBytes: 1,
    ramBytes: 1,
    acceleratorMemoryBytes: 1,
    cpuThreads: 1,
    gpuCount: 1,
    evaluationCases: 1,
    outputBytes: 1,
    externalCostMinorUnits: 0,
  };
}
const cases = [
  "wallClockSeconds",
  "optimizerSteps",
  "epochs",
  "tokens",
  "examples",
  "checkpoints",
  "diskBytes",
  "ramBytes",
  "acceleratorMemoryBytes",
  "cpuThreads",
  "gpuCount",
  "evaluationCases",
  "outputBytes",
] as const;
describe("KTS-I4-H resource budget", () => {
  it("validates zero-cost budget", () =>
    expect(validateResourceBudget(budget()).maximumExternalCostMinorUnits).toBe(0));
  it("passes usage within budget", () =>
    expect(evaluateResourceBudget(budget(), usage()).withinBudget).toBe(true));
  for (const key of cases)
    it(`detects budget exceedance for ${key}`, () => {
      const changed = { ...usage(), [key]: 1000 };
      expect(evaluateResourceBudget(budget(), changed).withinBudget).toBe(false);
    });
  for (const key of cases)
    it(`accepts zero usage for ${key}`, () => {
      const changed = { ...usage(), [key]: 0 };
      expect(evaluateResourceBudget(budget(), changed).withinBudget).toBe(true);
    });
  it("rejects paid cost budget", () =>
    expect(() => validateResourceBudget({ ...budget(), maximumExternalCostMinorUnits: 1 })).toThrow(
      FineTuningFailure,
    ));
  it("rejects zero wall clock budget", () =>
    expect(() => validateResourceBudget({ ...budget(), maximumWallClockSeconds: 0 })).toThrow(
      FineTuningFailure,
    ));
  it("freezes budget", () => expect(Object.isFrozen(validateResourceBudget(budget()))).toBe(true));
  for (let i = 0; i < 20; i++)
    it(`evaluates deterministic budget ${i}`, () =>
      expect(evaluateResourceBudget(budget(), usage()).exceeded).toHaveLength(0));
});
