import {
  ABSENT_EVALUATION_AUTHORITY,
  digestCanonical,
  immutableCopy,
  requireIdentity,
  requireIsoTime,
  requireSafeInteger,
  sortText,
} from "./evaluation-contract";

export type HardwareEvidenceSource = Readonly<{
  sourceId: string;
  sourceDigest: string;
}>;

export type HardwareSnapshot = Readonly<{
  snapshotId: string;
  schemaVersion: string;
  capturedAt: string;
  machineAlias: string;
  operatingSystem: string;
  operatingSystemVersion: string;
  environmentId: string;
  cpuIdentity: string;
  logicalProcessors: number | "unknown";
  architecture: string;
  totalSystemMemoryMiB: number | "unknown";
  availableSystemMemoryMiB: number | "unknown";
  storageCapacityMiB: number | "unknown";
  storageAvailableMiB: number | "unknown";
  gpuIdentity: string | "unknown";
  gpuArchitecture: string | "unknown";
  totalVramMiB: number | "unknown";
  availableVramMiB: number | "unknown";
  driverVersion: string | "unknown";
  cudaDriverVersion: string | "unknown";
  cudaToolkitVersion: string | "unknown";
  powerMode: string | "unknown";
  thermalMode: string | "unknown";
  chargerState: string | "unknown";
  evidenceSources: readonly HardwareEvidenceSource[];
  unknownFields: readonly string[];
  limitations: readonly string[];
  authority: typeof ABSENT_EVALUATION_AUTHORITY;
  snapshotDigest: string;
}>;

export function createHardwareSnapshot(
  input: Omit<HardwareSnapshot, "authority" | "snapshotDigest">,
): HardwareSnapshot {
  for (const [label, value] of [
    ["snapshotId", input.snapshotId],
    ["schemaVersion", input.schemaVersion],
    ["machineAlias", input.machineAlias],
    ["operatingSystem", input.operatingSystem],
    ["operatingSystemVersion", input.operatingSystemVersion],
    ["environmentId", input.environmentId],
    ["cpuIdentity", input.cpuIdentity],
    ["architecture", input.architecture],
  ] as const) {
    requireIdentity(value, label);
  }
  requireIsoTime(input.capturedAt, "capturedAt");
  for (const [label, value] of [
    ["logicalProcessors", input.logicalProcessors],
    ["totalSystemMemoryMiB", input.totalSystemMemoryMiB],
    ["availableSystemMemoryMiB", input.availableSystemMemoryMiB],
    ["storageCapacityMiB", input.storageCapacityMiB],
    ["storageAvailableMiB", input.storageAvailableMiB],
    ["totalVramMiB", input.totalVramMiB],
    ["availableVramMiB", input.availableVramMiB],
  ] as const) {
    if (value !== "unknown") requireSafeInteger(value, label);
  }
  const core = {
    ...input,
    evidenceSources: [...input.evidenceSources]
      .map((item) => ({
        sourceId: requireIdentity(item.sourceId, "sourceId"),
        sourceDigest: requireIdentity(item.sourceDigest, "sourceDigest"),
      }))
      .sort((a, b) => (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0)),
    unknownFields: sortText(input.unknownFields),
    limitations: sortText(input.limitations),
    authority: ABSENT_EVALUATION_AUTHORITY,
  };
  return immutableCopy({
    ...core,
    snapshotDigest: digestCanonical(core),
  }) as HardwareSnapshot;
}
