import { canonicalizeJson, deepFreezeJson, type JsonValue } from "../memory-fabric/canonical-json";
import { failFineTuning } from "./failures";
export interface HyperparameterConfiguration {
  readonly optimizer: string;
  readonly learningRate: number;
  readonly schedule: string;
  readonly maximumEpochs: number;
  readonly maximumSteps: number;
  readonly batchSize: number;
  readonly gradientAccumulationSteps: number;
  readonly gradientClipNorm: number;
  readonly warmupSteps: number;
  readonly weightDecay: number;
  readonly checkpointEverySteps: number;
  readonly maximumCheckpoints: number;
  readonly earlyStoppingPatience: number;
  readonly seed: number;
}
export function validateHyperparameterConfiguration(
  value: Readonly<HyperparameterConfiguration>,
): Readonly<HyperparameterConfiguration> {
  if (
    !/^[a-zA-Z0-9._-]+$/.test(value.optimizer) ||
    !/^[a-zA-Z0-9._-]+$/.test(value.schedule) ||
    !Number.isFinite(value.learningRate) ||
    value.learningRate <= 0 ||
    value.learningRate > 1
  )
    failFineTuning(
      "invalid_hyperparameters",
      "hyperparameters",
      "Optimizer or learning rate is invalid.",
    );
  const positives = [
    value.maximumEpochs,
    value.maximumSteps,
    value.batchSize,
    value.gradientAccumulationSteps,
    value.checkpointEverySteps,
    value.maximumCheckpoints,
  ];
  if (
    positives.some((v) => !Number.isSafeInteger(v) || v < 1) ||
    !Number.isFinite(value.gradientClipNorm) ||
    value.gradientClipNorm < 0 ||
    !Number.isSafeInteger(value.warmupSteps) ||
    value.warmupSteps < 0 ||
    !Number.isFinite(value.weightDecay) ||
    value.weightDecay < 0 ||
    !Number.isSafeInteger(value.earlyStoppingPatience) ||
    value.earlyStoppingPatience < 0 ||
    !Number.isSafeInteger(value.seed)
  )
    failFineTuning(
      "invalid_hyperparameters",
      "hyperparameters",
      "Hyperparameter bounds are invalid.",
    );
  return deepFreezeJson(
    canonicalizeJson(value) as JsonValue,
  ) as unknown as Readonly<HyperparameterConfiguration>;
}
