import { canonicalizeJson, deepFreezeJson, type JsonValue } from "../memory-fabric/canonical-json";
import { failFineTuning } from "./failures";
export interface ResourceBudget {
  readonly maximumWallClockSeconds: number;
  readonly maximumOptimizerSteps: number;
  readonly maximumEpochs: number;
  readonly maximumTokens: number;
  readonly maximumExamples: number;
  readonly maximumCheckpoints: number;
  readonly maximumDiskBytes: number;
  readonly maximumRamBytes: number;
  readonly maximumAcceleratorMemoryBytes: number;
  readonly maximumCpuThreads: number;
  readonly maximumGpuCount: number;
  readonly maximumEvaluationCases: number;
  readonly maximumOutputBytes: number;
  readonly maximumExternalCostMinorUnits: number;
}
export interface ResourceUsage {
  readonly wallClockSeconds: number;
  readonly optimizerSteps: number;
  readonly epochs: number;
  readonly tokens: number;
  readonly examples: number;
  readonly checkpoints: number;
  readonly diskBytes: number;
  readonly ramBytes: number;
  readonly acceleratorMemoryBytes: number;
  readonly cpuThreads: number;
  readonly gpuCount: number;
  readonly evaluationCases: number;
  readonly outputBytes: number;
  readonly externalCostMinorUnits: number;
}
export interface ResourceBudgetDecision {
  readonly withinBudget: boolean;
  readonly exceeded: readonly (keyof ResourceBudget)[];
}
const keys: readonly (keyof ResourceBudget)[] = Object.freeze([
  "maximumWallClockSeconds",
  "maximumOptimizerSteps",
  "maximumEpochs",
  "maximumTokens",
  "maximumExamples",
  "maximumCheckpoints",
  "maximumDiskBytes",
  "maximumRamBytes",
  "maximumAcceleratorMemoryBytes",
  "maximumCpuThreads",
  "maximumGpuCount",
  "maximumEvaluationCases",
  "maximumOutputBytes",
  "maximumExternalCostMinorUnits",
]);
export function validateResourceBudget(budget: Readonly<ResourceBudget>): Readonly<ResourceBudget> {
  if (
    keys.some((k) => !Number.isSafeInteger(budget[k]) || budget[k] < 0) ||
    budget.maximumWallClockSeconds < 1 ||
    budget.maximumOptimizerSteps < 1 ||
    budget.maximumExamples < 1
  )
    failFineTuning("invalid_resource_budget", "budget", "Resource budget is invalid.");
  if (budget.maximumExternalCostMinorUnits !== 0)
    failFineTuning(
      "paid_compute_not_authorized",
      "budget",
      "Initial experiment cost ceiling must be zero.",
    );
  return deepFreezeJson(
    canonicalizeJson(budget) as JsonValue,
  ) as unknown as Readonly<ResourceBudget>;
}
export function evaluateResourceBudget(
  budget: Readonly<ResourceBudget>,
  usage: Readonly<ResourceUsage>,
): Readonly<ResourceBudgetDecision> {
  validateResourceBudget(budget);
  const pairs: readonly [keyof ResourceBudget, keyof ResourceUsage][] = Object.freeze([
    ["maximumWallClockSeconds", "wallClockSeconds"],
    ["maximumOptimizerSteps", "optimizerSteps"],
    ["maximumEpochs", "epochs"],
    ["maximumTokens", "tokens"],
    ["maximumExamples", "examples"],
    ["maximumCheckpoints", "checkpoints"],
    ["maximumDiskBytes", "diskBytes"],
    ["maximumRamBytes", "ramBytes"],
    ["maximumAcceleratorMemoryBytes", "acceleratorMemoryBytes"],
    ["maximumCpuThreads", "cpuThreads"],
    ["maximumGpuCount", "gpuCount"],
    ["maximumEvaluationCases", "evaluationCases"],
    ["maximumOutputBytes", "outputBytes"],
    ["maximumExternalCostMinorUnits", "externalCostMinorUnits"],
  ]);
  if (Object.values(usage).some((v) => !Number.isFinite(v) || v < 0))
    failFineTuning("invalid_resource_budget", "budget", "Resource usage is invalid.");
  const exceeded = pairs.filter(([b, u]) => usage[u] > budget[b]).map(([b]) => b);
  return Object.freeze({ withinBudget: exceeded.length === 0, exceeded: Object.freeze(exceeded) });
}
