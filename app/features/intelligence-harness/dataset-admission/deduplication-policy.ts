import { digestCanonical, immutableCopy } from "./admission-contract";
import type { NormalizedSample } from "./sample-contract";

export type DuplicateStatus =
  "unique" | "exact_duplicate" | "structural_duplicate" | "conflicting_duplicate";

export type DuplicateResult = Readonly<{
  status: DuplicateStatus;
  relatedSampleIds: readonly string[];
  reasonCodes: readonly string[];
  digest: string;
}>;

export function classifyDuplicate(
  candidate: NormalizedSample,
  existing: readonly NormalizedSample[],
): DuplicateResult {
  let status: DuplicateStatus = "unique";
  const related: string[] = [];
  const reasons: string[] = [];

  for (const sample of existing) {
    if (sample.sampleId === candidate.sampleId && sample.sampleDigest !== candidate.sampleDigest) {
      status = "conflicting_duplicate";
      related.push(sample.sampleId);
      reasons.push("sample_identity_reused_with_different_digest");
      break;
    }
    if (sample.sampleDigest === candidate.sampleDigest) {
      status = "exact_duplicate";
      related.push(sample.sampleId);
      reasons.push("sample_digest_match");
      continue;
    }
    if (
      sample.families.duplicateFamilyId === candidate.families.duplicateFamilyId ||
      sample.observationDigest === candidate.observationDigest ||
      sample.plannerResultDigest === candidate.plannerResultDigest
    ) {
      if (status === "unique") {
        status = "structural_duplicate";
      }
      related.push(sample.sampleId);
      reasons.push("shared_structural_identity");
    }
  }

  const normalized = {
    status,
    relatedSampleIds: [...new Set(related)].sort(),
    reasonCodes: [...new Set(reasons)].sort(),
  };
  return immutableCopy({
    ...normalized,
    digest: digestCanonical(normalized),
  }) as DuplicateResult;
}
