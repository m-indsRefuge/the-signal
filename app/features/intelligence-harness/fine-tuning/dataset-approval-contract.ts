import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isSha256Hex, sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export const DATASET_APPROVAL_STATUSES = Object.freeze([
  "approved",
  "rejected",
  "review_required",
  "quarantined",
] as const);
export type DatasetApprovalStatus = (typeof DATASET_APPROVAL_STATUSES)[number];
export interface DatasetPartitionCounts {
  readonly train: number;
  readonly validation: number;
  readonly test: number;
  readonly quarantine: number;
}
export interface DatasetApprovalDraft {
  readonly approvalId: string;
  readonly approvalVersion: string;
  readonly manifestId: string;
  readonly manifestVersion: string;
  readonly manifestDigest: string;
  readonly exportDraftDigest: string;
  readonly includedExampleDigests: readonly string[];
  readonly partitionCounts: DatasetPartitionCounts;
  readonly labelCounts: Readonly<Record<string, number>>;
  readonly taskCounts: Readonly<Record<string, number>>;
  readonly sourceFamilyCount: number;
  readonly protectedEvidenceReportDigest: string;
  readonly consentPrivacyReportDigest: string;
  readonly duplicateAuditDigest: string;
  readonly leakageAuditDigest: string;
  readonly qualityReportDigest: string;
  readonly curriculumPlanDigest: string;
  readonly distillationPlanDigest?: string;
  readonly reviewerStatus: "accepted" | "rejected" | "unknown";
  readonly approvalStatus: DatasetApprovalStatus;
  readonly testIsolationVerified: boolean;
  readonly knownLimitations: readonly string[];
}
export interface DatasetApprovalRecord extends DatasetApprovalDraft {
  readonly contentDigest: string;
}
export async function createDatasetApprovalRecord(
  draft: Readonly<DatasetApprovalDraft>,
): Promise<Readonly<DatasetApprovalRecord>> {
  for (const [l, v] of [
    ["approvalId", draft.approvalId],
    ["approvalVersion", draft.approvalVersion],
    ["manifestId", draft.manifestId],
    ["manifestVersion", draft.manifestVersion],
  ] as const)
    validateFineTuningIdentity(v, l, "invalid_dataset_approval");
  const digests = [
    draft.manifestDigest,
    draft.exportDraftDigest,
    ...draft.includedExampleDigests,
    draft.protectedEvidenceReportDigest,
    draft.consentPrivacyReportDigest,
    draft.duplicateAuditDigest,
    draft.leakageAuditDigest,
    draft.qualityReportDigest,
    draft.curriculumPlanDigest,
    ...(draft.distillationPlanDigest ? [draft.distillationPlanDigest] : []),
  ];
  if (digests.some((d) => !isSha256Hex(d)))
    failFineTuning("dataset_digest_mismatch", "dataset", "Dataset digest evidence is invalid.");
  if (draft.approvalStatus !== "approved" || draft.reviewerStatus !== "accepted")
    failFineTuning("dataset_not_approved", "dataset", "Dataset is not approved.");
  if (!draft.testIsolationVerified)
    failFineTuning("test_partition_contaminated", "dataset", "Test isolation is not verified.");
  const counts = Object.values(draft.partitionCounts);
  if (
    counts.some((v) => !Number.isSafeInteger(v) || v < 0) ||
    draft.partitionCounts.train < 1 ||
    draft.partitionCounts.validation < 1 ||
    draft.partitionCounts.test < 1 ||
    draft.partitionCounts.quarantine < 0 ||
    draft.includedExampleDigests.length === 0 ||
    !Number.isSafeInteger(draft.sourceFamilyCount) ||
    draft.sourceFamilyCount < 1
  )
    failFineTuning("dataset_partition_invalid", "dataset", "Dataset partitions are invalid.");
  const normalized = canonicalizeJson({
    ...draft,
    includedExampleDigests: [...new Set(draft.includedExampleDigests)].sort(),
    knownLimitations: [...new Set(draft.knownLimitations)].sort(),
  }) as unknown as DatasetApprovalDraft;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<DatasetApprovalRecord>;
}
export async function validateDatasetApprovalRecord(
  record: Readonly<DatasetApprovalRecord>,
): Promise<void> {
  const { contentDigest, ...body } = record;
  if (!(await verifySha256Hex(canonicalStringify(body), contentDigest)))
    failFineTuning("dataset_manifest_mismatch", "dataset", "Dataset approval digest mismatch.");
}
