import { describe, expect, it } from "vitest";
import {
  createHardwareSnapshot,
  evaluateHardwareFeasibility,
  type HardwareSnapshot,
  type LicenseDecision,
  type LicenseProfile,
  type ModelArtifactProfile,
  type ModelCandidateProfile,
  type RawResponseEnvelope,
  type RuntimeProfile,
  createLicenseProfile,
  createRuntimeProfile,
  createArtifactProfile,
  createModelCandidate,
  createRawResponseEnvelope,
} from "../app/features/intelligence-harness/model-evaluation";

function hardware(index = 0): HardwareSnapshot {
  return createHardwareSnapshot({
    snapshotId: `hardware-${index}`,
    schemaVersion: "1.0.0",
    capturedAt: "2026-08-02T20:00:00Z",
    machineAlias: "signal-workstation",
    operatingSystem: "Windows",
    operatingSystemVersion: "11",
    environmentId: "host",
    cpuIdentity: "Intel Core i7-14700HX",
    logicalProcessors: 28,
    architecture: "x64",
    totalSystemMemoryMiB: 32768,
    availableSystemMemoryMiB: 20000,
    storageCapacityMiB: 953000,
    storageAvailableMiB: 500000,
    gpuIdentity: "NVIDIA GeForce RTX 5060 Laptop GPU",
    gpuArchitecture: "unknown",
    totalVramMiB: 8151,
    availableVramMiB: 7600,
    driverVersion: "caller-supplied",
    cudaDriverVersion: "caller-supplied",
    cudaToolkitVersion: "unknown",
    powerMode: "plugged_in",
    thermalMode: "performance",
    chargerState: "connected",
    evidenceSources: [{ sourceId: "fixture", sourceDigest: `fixture-${index}` }],
    unknownFields: ["cudaToolkitVersion", "gpuArchitecture"],
    limitations: ["synthetic_fixture"],
  });
}

function license(decision: LicenseDecision = "approved_for_baseline_evaluation"): LicenseProfile {
  return createLicenseProfile({
    licenseId: "apache-2.0",
    sourceId: "fixture-license",
    termsDigest: "terms-digest",
    accessRequirement: "none",
    redistributionConditions: [],
    derivativeWorkConditions: [],
    commercialUse: "allowed",
    attributionRequirements: ["notice"],
    acceptableUseRestrictions: [],
    reviewerId: "operator",
    reviewedAt: "2026-08-02T20:01:00Z",
    decision,
    reasonCodes: [],
    limitations: [],
  });
}

function runtime(): RuntimeProfile {
  return createRuntimeProfile({
    runtimeId: "llama.cpp",
    versionIdentity: "commit-abc123",
    executableDigest: "executable-digest",
    installationSource: "official-release",
    operatingEnvironment: "Windows-x64",
    acceleratorBackend: "CUDA",
    deviceIdentity: "RTX-5060-Laptop",
    gpuOffloadConfiguration: "all-supported-layers",
    contextAllocationTokens: 8192,
    threadCount: 16,
    batchSize: 512,
    promptTemplateBehavior: "jinja",
    seedBehavior: "explicit",
    outputProtocol: "stdout-json",
    capabilities: {
      executableAvailability: "supported",
      artifactFormatSupport: "supported",
      architectureSupport: "supported",
      cudaBackend: "supported",
      cpuFallback: "supported",
      gpuOffload: "supported",
      deterministicSeed: "supported",
      chatTemplate: "supported",
      structuredOutput: "supported",
      contextConfiguration: "supported",
      tokenAccounting: "supported",
      timingEvidence: "supported",
      memoryTelemetry: "unknown",
      serverMode: "supported",
      cliMode: "supported",
      cancellation: "supported",
      timeoutEnforcement: "supported",
      outputCapture: "supported",
    },
    warnings: [],
    limitations: [],
    authorizationId: "fixture-only",
  });
}

function artifact(): ModelArtifactProfile {
  return createArtifactProfile({
    artifactId: "artifact-q4",
    candidateIdentity: "example/model@abc123",
    sourceRepository: "example/model",
    filename: "model-q4.gguf",
    format: "gguf",
    quantization: "Q4_K_M",
    byteLength: 2_000_000_000,
    sha256: "A".repeat(64),
    conversionProvenance: "official-ggml-org",
    sourceArtifacts: [],
    tokenizerDigest: "tokenizer-digest",
    chatTemplateDigest: "template-digest",
    acquiredAt: "2026-08-02T20:02:00Z",
    acquisitionAuthorizationId: "fixture-only",
    integrity: "verified",
    limitations: [],
  });
}

function candidate(): ModelCandidateProfile {
  return createModelCandidate({
    candidateId: "candidate",
    publisher: "example",
    repositoryId: "example/model",
    revision: "abc123",
    familyId: "example-family",
    architecture: "decoder-only",
    parameterCount: 1_700_000_000,
    role: "instruction_tuned",
    supportedLanguages: ["English"],
    contextWindowTokens: 32768,
    modelCardDigest: "model-card-digest",
    configurationDigest: "config-digest",
    tokenizerIdentity: "tokenizer",
    tokenizerDigest: "tokenizer-digest",
    chatTemplateIdentity: "template",
    chatTemplateDigest: "template-digest",
    license: license(),
    artifacts: [artifact()],
    runtimes: [runtime()],
    expectedPrecision: "Q4_K_M",
    limitations: [],
    suitabilityHypotheses: ["compact local strategist"],
  });
}

function response(
  rawText = '{"kind":"proposal","actions":[{"kind":"hold"}]}',
  index = 0,
): RawResponseEnvelope {
  return createRawResponseEnvelope({
    responseId: `response-${index}`,
    invocationId: `invocation-${index}`,
    candidateIdentity: "example/model@abc123",
    artifactId: "artifact-q4",
    runtimeId: "llama.cpp",
    rawText,
    responseProtocolId: "json-object",
    finishReason: "stop",
    promptTokens: 100,
    generatedTokens: 20,
    totalDurationMilliseconds: 1000,
    timeToFirstTokenMilliseconds: 100,
    peakGpuMemoryMiB: 3000,
    peakSystemMemoryMiB: 1000,
    runtimeWarnings: [],
    truncated: false,
    cancelled: false,
    timedOut: false,
    limitations: [],
  });
}

void hardware;
void license;
void runtime;
void artifact;
void candidate;
void response;

describe("hardware snapshots", () => {
  it("keeps unknowns explicit", () => {
    expect(hardware().unknownFields).toContain("gpuArchitecture");
  });
  it("evaluates known feasibility", () => {
    const result = evaluateHardwareFeasibility(hardware(), {
      artifactStorageMiB: 5000,
      requiredVramMiB: 4000,
      requiredSystemMemoryMiB: 8000,
      requiredContextTokens: 8192,
    });
    expect(result.storage).toBe("feasible");
    expect(result.vram).toBe("feasible");
  });
  for (let index = 0; index < 58; index += 1) {
    it(`creates immutable snapshot ${index}`, () => {
      const value = hardware(index);
      expect(Object.isFrozen(value)).toBe(true);
      expect(value.snapshotDigest).toHaveLength(32);
    });
  }
});
