import type { DuplicateClassification } from "./duplicate-contract";
import type { DemonstrationEvidenceRecord } from "./evidence-record";
import type { ReviewRecord } from "./review-record";

export interface QuarantineRegistrationResult {
  readonly classification: "registered" | DuplicateClassification;
  readonly record: DemonstrationEvidenceRecord;
  readonly matchedRecordIds: readonly string[];
}

export interface QuarantineSnapshot {
  readonly records: readonly DemonstrationEvidenceRecord[];
  readonly reviews: readonly ReviewRecord[];
  readonly recordCount: number;
  readonly reviewCount: number;
  readonly truncated: boolean;
  readonly snapshotDigest: string;
}

export interface QuarantineListResult {
  readonly records: readonly DemonstrationEvidenceRecord[];
  readonly totalRecords: number;
  readonly truncated: boolean;
}
