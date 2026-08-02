import {
  digestCanonical,
  immutableCopy,
  requireIdentity,
  requireSafeInteger,
  sortText,
} from "./evaluation-contract";
import type { ModelArtifactProfile } from "./artifact-contract";
import type { LicenseProfile } from "./license-contract";
import { createModelIdentity, requireImmutableRevision } from "./model-identity";
import type { RuntimeProfile } from "./runtime-contract";

export type ModelCandidateProfile = Readonly<{
  candidateId: string;
  publisher: string;
  repositoryId: string;
  revision: string;
  identity: string;
  familyId: string;
  architecture: string;
  parameterCount: number;
  role: "base" | "instruction_tuned";
  supportedLanguages: readonly string[];
  contextWindowTokens: number;
  modelCardDigest: string;
  configurationDigest: string;
  tokenizerIdentity: string;
  tokenizerDigest: string;
  chatTemplateIdentity: string;
  chatTemplateDigest: string;
  license: LicenseProfile;
  artifacts: readonly ModelArtifactProfile[];
  runtimes: readonly RuntimeProfile[];
  expectedPrecision: string;
  limitations: readonly string[];
  suitabilityHypotheses: readonly string[];
  selectionState: "not_selected";
  candidateDigest: string;
}>;

export function createModelCandidate(
  input: Omit<ModelCandidateProfile, "identity" | "selectionState" | "candidateDigest">,
): ModelCandidateProfile {
  for (const [label, value] of [
    ["candidateId", input.candidateId],
    ["publisher", input.publisher],
    ["repositoryId", input.repositoryId],
    ["familyId", input.familyId],
    ["architecture", input.architecture],
    ["modelCardDigest", input.modelCardDigest],
    ["configurationDigest", input.configurationDigest],
    ["tokenizerIdentity", input.tokenizerIdentity],
    ["tokenizerDigest", input.tokenizerDigest],
    ["chatTemplateIdentity", input.chatTemplateIdentity],
    ["chatTemplateDigest", input.chatTemplateDigest],
    ["expectedPrecision", input.expectedPrecision],
  ] as const)
    requireIdentity(value, label);
  requireImmutableRevision(input.revision);
  requireSafeInteger(input.parameterCount, "parameterCount", 1);
  requireSafeInteger(input.contextWindowTokens, "contextWindowTokens", 1, 10_000_000);
  const core = {
    ...input,
    identity: createModelIdentity(input.repositoryId, input.revision),
    supportedLanguages: sortText(input.supportedLanguages),
    artifacts: [...input.artifacts],
    runtimes: [...input.runtimes],
    limitations: sortText(input.limitations),
    suitabilityHypotheses: sortText(input.suitabilityHypotheses),
    selectionState: "not_selected" as const,
  };
  return immutableCopy({
    ...core,
    candidateDigest: digestCanonical(core),
  }) as ModelCandidateProfile;
}
