import { canonicalizeJson, deepFreezeJson, type JsonValue } from "../memory-fabric/canonical-json";
import { failFineTuning } from "./failures";
export const TRAINING_METHODS = Object.freeze(["supervised_fine_tuning", "lora", "qlora"] as const);
export type TrainingMethod = (typeof TRAINING_METHODS)[number];
export interface TrainingMethodConfiguration {
  readonly method: TrainingMethod;
  readonly trainableParameterScope: string;
  readonly targetModules: readonly string[];
  readonly adapterRank?: number;
  readonly adapterAlpha?: number;
  readonly quantizationBits?: 4 | 8 | 16 | 32;
  readonly precision: "fp32" | "fp16" | "bf16";
}
export function validateTrainingMethodConfiguration(
  value: Readonly<TrainingMethodConfiguration>,
): Readonly<TrainingMethodConfiguration> {
  if (
    !TRAINING_METHODS.includes(value.method) ||
    value.trainableParameterScope.trim() === "" ||
    value.targetModules.length === 0
  )
    failFineTuning("invalid_training_method", "method", "Training method is invalid.");
  if (
    value.method !== "supervised_fine_tuning" &&
    (!Number.isSafeInteger(value.adapterRank) ||
      Number(value.adapterRank) < 1 ||
      !Number.isFinite(value.adapterAlpha) ||
      Number(value.adapterAlpha) <= 0)
  )
    failFineTuning("invalid_training_method", "method", "Adapter settings are required.");
  if (value.method === "qlora" && value.quantizationBits !== 4 && value.quantizationBits !== 8)
    failFineTuning(
      "invalid_training_method",
      "method",
      "QLoRA requires four- or eight-bit quantization.",
    );
  return deepFreezeJson(
    canonicalizeJson({
      ...value,
      targetModules: [...new Set(value.targetModules)].sort(),
    }) as JsonValue,
  ) as unknown as Readonly<TrainingMethodConfiguration>;
}
