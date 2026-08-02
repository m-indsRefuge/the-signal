import type { EvidenceState } from "./evaluation-contract";

export type RuntimeCapabilities = Readonly<{
  executableAvailability: EvidenceState;
  artifactFormatSupport: EvidenceState;
  architectureSupport: EvidenceState;
  cudaBackend: EvidenceState;
  cpuFallback: EvidenceState;
  gpuOffload: EvidenceState;
  deterministicSeed: EvidenceState;
  chatTemplate: EvidenceState;
  structuredOutput: EvidenceState;
  contextConfiguration: EvidenceState;
  tokenAccounting: EvidenceState;
  timingEvidence: EvidenceState;
  memoryTelemetry: EvidenceState;
  serverMode: EvidenceState;
  cliMode: EvidenceState;
  cancellation: EvidenceState;
  timeoutEnforcement: EvidenceState;
  outputCapture: EvidenceState;
}>;
