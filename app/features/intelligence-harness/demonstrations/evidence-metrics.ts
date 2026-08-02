import type { DemonstrationEvidenceRecord } from "./evidence-record";
import { evidenceDigest, freezeDeep } from "./evidence-digest";
import type { ReviewRecord } from "./review-record";

export interface EvidenceMetrics {
  readonly requestCount: number;
  readonly generatedRecordCount: number;
  readonly exactDuplicateCount: number;
  readonly structuralDuplicateCount: number;
  readonly conflictingDuplicateCount: number;
  readonly plannerOutcomeCounts: Readonly<Record<string, number>>;
  readonly validatorDecisionCounts: Readonly<Record<string, number>>;
  readonly qualityLabelCounts: Readonly<Record<string, number>>;
  readonly riskLabelCounts: Readonly<Record<string, number>>;
  readonly quarantinedRecordCount: number;
  readonly reviewedRecordCount: number;
  readonly reviewDecisionCounts: Readonly<Record<string, number>>;
  readonly truncatedRecordCount: number;
  readonly serializedCharacterCount: number;
  readonly generationFailureCount: number;
  readonly metricsDigest: string;
}

export function createEvidenceMetrics(
  records: readonly DemonstrationEvidenceRecord[],
  reviews: readonly ReviewRecord[] = [],
  duplicateCounts: Readonly<{
    exact: number;
    structural: number;
    conflicting: number;
  }> = { exact: 0, structural: 0, conflicting: 0 },
): EvidenceMetrics {
  const body = freezeDeep({
    requestCount: records.length,
    generatedRecordCount: records.length,
    exactDuplicateCount: duplicateCounts.exact,
    structuralDuplicateCount: duplicateCounts.structural,
    conflictingDuplicateCount: duplicateCounts.conflicting,
    plannerOutcomeCounts: count(records.map((record) => record.outcome)),
    validatorDecisionCounts: count(
      records.map((record) => record.validator?.decision ?? "not_applicable"),
    ),
    qualityLabelCounts: count(records.flatMap((record) => [...record.qualityLabels])),
    riskLabelCounts: count(records.flatMap((record) => [...record.riskLabels])),
    quarantinedRecordCount: records.length,
    reviewedRecordCount: reviews.length,
    reviewDecisionCounts: count(reviews.map((review) => review.decision)),
    truncatedRecordCount: records.filter((record) => record.truncated).length,
    serializedCharacterCount: JSON.stringify(records).length,
    generationFailureCount: 0,
  });
  return freezeDeep({ ...body, metricsDigest: evidenceDigest(body) });
}

function count(values: readonly string[]): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return freezeDeep(
    Object.fromEntries(
      Object.entries(result).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    ),
  );
}
