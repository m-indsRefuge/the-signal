import { digestCanonical, immutableCopy, type FeasibilityState } from "./evaluation-contract";
import type { HardwareSnapshot } from "./hardware-snapshot";

export type HardwareRequirement = Readonly<{
  artifactStorageMiB: number;
  requiredVramMiB: number;
  requiredSystemMemoryMiB: number;
  requiredContextTokens: number;
}>;

export type HardwareFeasibility = Readonly<{
  storage: FeasibilityState;
  vram: FeasibilityState;
  systemMemory: FeasibilityState;
  context: FeasibilityState;
  trainingEstimate: FeasibilityState;
  reasonCodes: readonly string[];
  digest: string;
}>;

function compareKnown(available: number | "unknown", required: number): FeasibilityState {
  if (available === "unknown") return "unknown";
  return available >= required ? "feasible" : "infeasible";
}

export function evaluateHardwareFeasibility(
  snapshot: HardwareSnapshot,
  requirement: HardwareRequirement,
): HardwareFeasibility {
  const storage = compareKnown(snapshot.storageAvailableMiB, requirement.artifactStorageMiB);
  const vram = compareKnown(snapshot.availableVramMiB, requirement.requiredVramMiB);
  const systemMemory = compareKnown(
    snapshot.availableSystemMemoryMiB,
    requirement.requiredSystemMemoryMiB,
  );
  const context: FeasibilityState =
    requirement.requiredContextTokens <= 0 ? "unknown" : "conditionally_feasible";
  const trainingEstimate: FeasibilityState =
    snapshot.totalVramMiB === "unknown"
      ? "unknown"
      : snapshot.totalVramMiB >= requirement.requiredVramMiB * 2
        ? "conditionally_feasible"
        : "infeasible";
  const reasonCodes = [
    `storage:${storage}`,
    `vram:${vram}`,
    `system_memory:${systemMemory}`,
    `context:${context}`,
    `training_estimate:${trainingEstimate}`,
  ];
  const core = { storage, vram, systemMemory, context, trainingEstimate, reasonCodes };
  return immutableCopy({
    ...core,
    digest: digestCanonical(core),
  }) as HardwareFeasibility;
}
