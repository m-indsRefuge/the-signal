import { digestCanonical, immutableCopy, sortText } from "./admission-contract";

export type AuditStage =
  | "eligibility"
  | "role_assignment"
  | "duplicate_classification"
  | "family_assignment"
  | "partition_assignment"
  | "leakage_evaluation"
  | "admission_decision"
  | "manifest_inclusion"
  | "manifest_exclusion"
  | "bounded_truncation";

export type AdmissionAuditRecord = Readonly<{
  auditId: string;
  requestId: string;
  stage: AuditStage;
  subjectId: string;
  reasonCodes: readonly string[];
  policyId: string;
  policyVersion: string;
  digest: string;
}>;

export function createAuditRecord(
  input: Omit<AdmissionAuditRecord, "digest">,
): AdmissionAuditRecord {
  const normalized = {
    ...input,
    reasonCodes: sortText(input.reasonCodes),
  };
  return immutableCopy({
    ...normalized,
    digest: digestCanonical(normalized),
  }) as AdmissionAuditRecord;
}
