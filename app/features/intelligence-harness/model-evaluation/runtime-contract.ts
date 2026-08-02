import {
  digestCanonical,
  immutableCopy,
  requireIdentity,
  requireSafeInteger,
  sortText,
} from "./evaluation-contract";
import type { RuntimeCapabilities } from "./runtime-capability";

export type RuntimeProfile = Readonly<{
  runtimeId: "llama.cpp" | "Ollama" | "Transformers/PyTorch";
  versionIdentity: string;
  executableDigest: string;
  installationSource: string;
  operatingEnvironment: string;
  acceleratorBackend: string;
  deviceIdentity: string;
  gpuOffloadConfiguration: string;
  contextAllocationTokens: number;
  threadCount: number;
  batchSize: number;
  promptTemplateBehavior: string;
  seedBehavior: string;
  outputProtocol: string;
  capabilities: RuntimeCapabilities;
  warnings: readonly string[];
  limitations: readonly string[];
  authorizationId: string;
  runtimeDigest: string;
}>;

export function createRuntimeProfile(input: Omit<RuntimeProfile, "runtimeDigest">): RuntimeProfile {
  for (const [label, value] of [
    ["versionIdentity", input.versionIdentity],
    ["executableDigest", input.executableDigest],
    ["installationSource", input.installationSource],
    ["operatingEnvironment", input.operatingEnvironment],
    ["acceleratorBackend", input.acceleratorBackend],
    ["deviceIdentity", input.deviceIdentity],
    ["gpuOffloadConfiguration", input.gpuOffloadConfiguration],
    ["promptTemplateBehavior", input.promptTemplateBehavior],
    ["seedBehavior", input.seedBehavior],
    ["outputProtocol", input.outputProtocol],
    ["authorizationId", input.authorizationId],
  ] as const)
    requireIdentity(value, label);
  requireSafeInteger(input.contextAllocationTokens, "contextAllocationTokens", 1, 1_000_000);
  requireSafeInteger(input.threadCount, "threadCount", 1, 1_024);
  requireSafeInteger(input.batchSize, "batchSize", 1, 65_536);
  const core = {
    ...input,
    warnings: sortText(input.warnings),
    limitations: sortText(input.limitations),
  };
  return immutableCopy({
    ...core,
    runtimeDigest: digestCanonical(core),
  }) as RuntimeProfile;
}
