import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isSha256Hex, sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export const NETWORK_POLICIES = Object.freeze(["offline", "restricted", "authorized"] as const);
export type NetworkPolicy = (typeof NETWORK_POLICIES)[number];
export interface EnvironmentDraft {
  readonly environmentId: string;
  readonly environmentVersion: string;
  readonly operatingSystem: string;
  readonly pythonVersion: string;
  readonly packageManager: string;
  readonly lockfileDigest: string;
  readonly trainingFramework: string;
  readonly trainingFrameworkVersion: string;
  readonly acceleratorLibraries: Readonly<Record<string, string>>;
  readonly computeDevice: string;
  readonly driverVersion: string;
  readonly availableMemoryBytes: number;
  readonly availableStorageBytes: number;
  readonly environmentVariableNames: readonly string[];
  readonly networkPolicy: NetworkPolicy;
  readonly externalUploadAuthorized: boolean;
  readonly paidComputeAuthorized: boolean;
  readonly sourceCheckpoint: string;
  readonly runnerPackageDigest: string;
}
export interface EnvironmentRecord extends EnvironmentDraft {
  readonly contentDigest: string;
}
export async function createEnvironmentRecord(
  draft: Readonly<EnvironmentDraft>,
): Promise<Readonly<EnvironmentRecord>> {
  for (const [l, v] of [
    ["environmentId", draft.environmentId],
    ["environmentVersion", draft.environmentVersion],
    ["operatingSystem", draft.operatingSystem],
    ["pythonVersion", draft.pythonVersion],
    ["packageManager", draft.packageManager],
    ["trainingFramework", draft.trainingFramework],
    ["trainingFrameworkVersion", draft.trainingFrameworkVersion],
    ["computeDevice", draft.computeDevice],
    ["driverVersion", draft.driverVersion],
    ["sourceCheckpoint", draft.sourceCheckpoint],
  ] as const)
    validateFineTuningIdentity(v, l, "invalid_environment");
  if (
    !isSha256Hex(draft.lockfileDigest) ||
    !isSha256Hex(draft.runnerPackageDigest) ||
    !NETWORK_POLICIES.includes(draft.networkPolicy) ||
    !Number.isSafeInteger(draft.availableMemoryBytes) ||
    draft.availableMemoryBytes < 1 ||
    !Number.isSafeInteger(draft.availableStorageBytes) ||
    draft.availableStorageBytes < 1
  )
    failFineTuning("invalid_environment", "environment", "Environment evidence is invalid.");
  if (draft.networkPolicy !== "offline" && !draft.externalUploadAuthorized)
    failFineTuning(
      "network_not_authorized",
      "environment",
      "Non-offline network policy requires explicit authorization.",
    );
  if (draft.paidComputeAuthorized)
    failFineTuning(
      "paid_compute_not_authorized",
      "environment",
      "Paid compute is not authorized by this implementation.",
    );
  const normalized = canonicalizeJson({
    ...draft,
    environmentVariableNames: [...new Set(draft.environmentVariableNames)].sort(),
  }) as unknown as EnvironmentDraft;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<EnvironmentRecord>;
}
export async function validateEnvironmentRecord(
  record: Readonly<EnvironmentRecord>,
): Promise<void> {
  const { contentDigest, ...body } = record;
  if (!(await verifySha256Hex(canonicalStringify(body), contentDigest)))
    failFineTuning("environment_mismatch", "environment", "Environment digest mismatch.");
}
