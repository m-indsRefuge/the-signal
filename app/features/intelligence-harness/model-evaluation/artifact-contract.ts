import {
  digestCanonical,
  immutableCopy,
  requireIdentity,
  requireIsoTime,
  requireSafeInteger,
  sortText,
} from "./evaluation-contract";
import { fail } from "./failures";

export type ArtifactIntegrity = "verified" | "mismatch" | "incomplete" | "unknown";

export type ModelArtifactProfile = Readonly<{
  artifactId: string;
  candidateIdentity: string;
  sourceRepository: string;
  filename: string;
  format: "safetensors" | "gguf" | "other";
  quantization: string;
  byteLength: number;
  sha256: string;
  conversionProvenance?: string;
  sourceArtifacts: readonly Readonly<{ artifactId: string; sha256: string }>[];
  tokenizerDigest: string;
  chatTemplateDigest: string;
  acquiredAt: string;
  acquisitionAuthorizationId: string;
  integrity: ArtifactIntegrity;
  limitations: readonly string[];
  artifactDigest: string;
}>;

export function createArtifactProfile(
  input: Omit<ModelArtifactProfile, "artifactDigest">,
): ModelArtifactProfile {
  for (const [label, value] of [
    ["artifactId", input.artifactId],
    ["candidateIdentity", input.candidateIdentity],
    ["sourceRepository", input.sourceRepository],
    ["filename", input.filename],
    ["quantization", input.quantization],
    ["sha256", input.sha256],
    ["tokenizerDigest", input.tokenizerDigest],
    ["chatTemplateDigest", input.chatTemplateDigest],
    ["acquisitionAuthorizationId", input.acquisitionAuthorizationId],
  ] as const)
    requireIdentity(value, label);
  requireSafeInteger(input.byteLength, "byteLength", 1);
  requireIsoTime(input.acquiredAt, "acquiredAt");
  if (!/^[A-Fa-f0-9]{64}$/.test(input.sha256)) {
    fail("artifact_digest_mismatch", "artifact sha256 must be 64 hex characters");
  }
  const core = {
    ...input,
    sourceArtifacts: [...input.sourceArtifacts].sort((a, b) =>
      a.artifactId < b.artifactId ? -1 : a.artifactId > b.artifactId ? 1 : 0,
    ),
    limitations: sortText(input.limitations),
  };
  return immutableCopy({
    ...core,
    artifactDigest: digestCanonical(core),
  }) as ModelArtifactProfile;
}
