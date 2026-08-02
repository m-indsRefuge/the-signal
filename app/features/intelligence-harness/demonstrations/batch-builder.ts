import { DEMONSTRATION_MAXIMA, requireIdentity } from "./demonstration-contract";
import { detectDuplicate } from "./duplicate-detector";
import type { DemonstrationEvidenceRecord } from "./evidence-record";
import { evidenceDigest, freezeDeep, serializedCharacters } from "./evidence-digest";
import { createEvidenceMetrics } from "./evidence-metrics";
import { failDemonstration } from "./failures";
import type { DemonstrationBatch } from "./batch-contract";

export interface BuildBatchInput {
  readonly batchId: string;
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly records: readonly DemonstrationEvidenceRecord[];
  readonly maximumRecords: number;
  readonly maximumSerializedCharacters: number;
}

export function buildDemonstrationBatch(input: BuildBatchInput): DemonstrationBatch {
  if (
    !Number.isSafeInteger(input.maximumRecords) ||
    input.maximumRecords <= 0 ||
    input.maximumRecords > DEMONSTRATION_MAXIMA.evidenceRecordsPerBatch ||
    !Number.isSafeInteger(input.maximumSerializedCharacters) ||
    input.maximumSerializedCharacters <= 0 ||
    input.maximumSerializedCharacters > DEMONSTRATION_MAXIMA.batchCharacters
  ) {
    return failDemonstration("record_budget_exceeded", "Batch budget is invalid.");
  }
  const accepted: DemonstrationEvidenceRecord[] = [];
  let exactDuplicateCount = 0;
  let structuralDuplicateCount = 0;
  for (const record of [...input.records].sort((left, right) =>
    left.recordId < right.recordId ? -1 : left.recordId > right.recordId ? 1 : 0,
  )) {
    const duplicate = detectDuplicate(record, accepted);
    if (duplicate.classification === "conflicting_duplicate") {
      return failDemonstration(
        "duplicate_identity_conflict",
        "Batch contains conflicting identity reuse.",
      );
    }
    if (duplicate.classification === "exact_duplicate") {
      exactDuplicateCount += 1;
      continue;
    }
    if (duplicate.classification === "structural_duplicate") structuralDuplicateCount += 1;
    accepted.push(record);
  }
  const retained = accepted.slice(0, input.maximumRecords);
  if (retained.some((record) => record.sourceLineage.domainId !== input.domainId)) {
    return failDemonstration("invalid_schema", "Batch mixes domains.");
  }
  const body = freezeDeep({
    batchId: requireIdentity(input.batchId, "batchId"),
    schemaId: requireIdentity(input.schemaId, "schemaId"),
    schemaVersion: requireIdentity(input.schemaVersion, "schemaVersion"),
    domainId: requireIdentity(input.domainId, "domainId"),
    domainVersion: requireIdentity(input.domainVersion, "domainVersion"),
    policyId: requireIdentity(input.policyId, "policyId"),
    policyVersion: requireIdentity(input.policyVersion, "policyVersion"),
    records: Object.freeze(retained),
    exactDuplicateCount,
    structuralDuplicateCount,
    truncated: accepted.length > retained.length,
    metrics: createEvidenceMetrics(retained, [], {
      exact: exactDuplicateCount,
      structural: structuralDuplicateCount,
      conflicting: 0,
    }),
    datasetAdmission: "not_performed" as const,
  });
  const batch = freezeDeep({ ...body, batchDigest: evidenceDigest(body) });
  if (serializedCharacters(batch) > input.maximumSerializedCharacters) {
    return failDemonstration("serialized_size_exceeded", "Batch exceeds serialized-size budget.");
  }
  return batch;
}
