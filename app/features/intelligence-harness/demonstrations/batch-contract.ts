import type { DemonstrationEvidenceRecord } from "./evidence-record";
import type { EvidenceMetrics } from "./evidence-metrics";

export interface DemonstrationBatch {
  readonly batchId: string;
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly records: readonly DemonstrationEvidenceRecord[];
  readonly exactDuplicateCount: number;
  readonly structuralDuplicateCount: number;
  readonly truncated: boolean;
  readonly metrics: EvidenceMetrics;
  readonly datasetAdmission: "not_performed";
  readonly batchDigest: string;
}
