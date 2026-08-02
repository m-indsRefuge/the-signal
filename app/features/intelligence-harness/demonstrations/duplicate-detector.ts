import type { DemonstrationEvidenceRecord } from "./evidence-record";
import { evidenceDigest, freezeDeep } from "./evidence-digest";
import { createDuplicateFingerprint, type DuplicateAnalysis } from "./duplicate-contract";

export function detectDuplicate(
  candidate: DemonstrationEvidenceRecord,
  existing: readonly DemonstrationEvidenceRecord[],
): DuplicateAnalysis {
  const fingerprint = createDuplicateFingerprint(candidate);
  const sameId = existing.find((record) => record.recordId === candidate.recordId);
  let classification: DuplicateAnalysis["classification"] = "unique";
  let matchedRecordIds: string[] = [];
  if (sameId !== undefined) {
    classification =
      sameId.recordDigest === candidate.recordDigest ? "exact_duplicate" : "conflicting_duplicate";
    matchedRecordIds = [sameId.recordId];
  } else {
    const structural = existing
      .filter(
        (record) =>
          createDuplicateFingerprint(record).structuralDigest === fingerprint.structuralDigest,
      )
      .map((record) => record.recordId)
      .sort();
    if (structural.length > 0) {
      classification = "structural_duplicate";
      matchedRecordIds = structural;
    }
  }
  const body = freezeDeep({
    classification,
    candidate: fingerprint,
    matchedRecordIds: Object.freeze(matchedRecordIds),
  });
  return freezeDeep({ ...body, analysisDigest: evidenceDigest(body) });
}
