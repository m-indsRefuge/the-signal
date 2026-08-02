import { failFineTuning } from "./failures";
import type { AdapterStatus } from "./adapter-contract";
export const PERMITTED_EXPERIMENT_CLASSIFICATIONS = Object.freeze([
  "experimental_candidate",
  "evaluation_candidate",
  "rejected",
  "quarantined",
  "experiment_accepted",
  "superseded",
] as const);
export function validateExperimentClassification(value: string): AdapterStatus {
  if (!(PERMITTED_EXPERIMENT_CLASSIFICATIONS as readonly string[]).includes(value))
    failFineTuning(
      "promotion_not_authorized",
      "promotion",
      "Production promotion is not authorized.",
    );
  return value as AdapterStatus;
}
export function assertRuntimePromotionProhibited(requested: boolean): void {
  if (requested)
    failFineTuning("promotion_not_authorized", "promotion", "Runtime promotion is not authorized.");
}
