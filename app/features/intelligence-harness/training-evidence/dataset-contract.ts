import { canonicalStringify, deepFreezeJson } from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failTraining, validateTrainingIdentity } from "./failures";
import type { CurriculumPlan } from "./curriculum-contract";
import type { DistillationPlan } from "./distillation-contract";
import type { DatasetQualityReport } from "./quality-gates";
import type { PartitionManifest } from "./partition-contract";
import type { TrainingExample } from "./training-example-contract";
export const DATASET_STATUSES = Object.freeze([
  "draft",
  "review_required",
  "validation_candidate",
  "rejected",
  "quarantined",
  "superseded",
] as const);
export type DatasetStatus = (typeof DATASET_STATUSES)[number];
export interface DatasetManifest {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly status: DatasetStatus;
  readonly domainScope: readonly string[];
  readonly intendedModelRole: string;
  readonly intendedMethodCompatibility: readonly string[];
  readonly exampleDigests: readonly string[];
  readonly exampleCounts: Readonly<Record<string, number>>;
  readonly partitionCounts: Readonly<Record<string, number>>;
  readonly qualityReportDigest: string;
  readonly partitionManifestDigest: string;
  readonly curriculumPlanDigest?: string;
  readonly distillationPlanDigest?: string;
  readonly knownLimitations: readonly string[];
  readonly reviewerStatus: "accepted" | "rejected" | "unknown";
  readonly manifestDigest: string;
}
export async function createDatasetManifest(
  datasetId: string,
  datasetVersion: string,
  status: DatasetStatus,
  examples: readonly Readonly<TrainingExample>[],
  partitions: Readonly<PartitionManifest>,
  quality: Readonly<DatasetQualityReport>,
  curriculum: Readonly<CurriculumPlan> | undefined,
  distillation: Readonly<DistillationPlan> | undefined,
  knownLimitations: readonly string[],
  reviewerStatus: "accepted" | "rejected" | "unknown",
): Promise<Readonly<DatasetManifest>> {
  validateTrainingIdentity(datasetId, "datasetId", "invalid_dataset_manifest", "manifest");
  validateTrainingIdentity(
    datasetVersion,
    "datasetVersion",
    "invalid_dataset_manifest",
    "manifest",
  );
  if (!DATASET_STATUSES.includes(status))
    failTraining("invalid_dataset_manifest", "manifest", "Dataset status is invalid.");
  if (status === "validation_candidate" && !quality.eligible)
    failTraining(
      "quality_gate_failed",
      "manifest",
      "Validation candidates require passing quality.",
    );
  const exampleCounts: Record<string, number> = {},
    partitionCounts: Record<string, number> = {};
  for (const e of examples) {
    exampleCounts[e.exampleKind] = (exampleCounts[e.exampleKind] ?? 0) + 1;
    partitionCounts[e.partition] = (partitionCounts[e.partition] ?? 0) + 1;
  }
  const envelope: Record<string, unknown> = {
    datasetId,
    datasetVersion,
    status,
    domainScope: [...new Set(examples.map((e) => e.domainId))].sort(),
    intendedModelRole: "tactical_adviser",
    intendedMethodCompatibility: [
      "supervised_fine_tuning",
      "lora",
      "qlora",
      "preference_optimization",
      "teacher_student_distillation",
    ],
    exampleDigests: [...examples]
      .sort((a, b) => (a.exampleId < b.exampleId ? -1 : 1))
      .map((e) => e.contentDigest),
    exampleCounts,
    partitionCounts,
    qualityReportDigest: quality.reportDigest,
    partitionManifestDigest: partitions.manifestDigest,
    knownLimitations: [...new Set(knownLimitations)].sort(),
    reviewerStatus,
  };
  if (curriculum) envelope.curriculumPlanDigest = curriculum.planDigest;
  if (distillation) envelope.distillationPlanDigest = distillation.planDigest;
  const manifestDigest = await sha256Hex(canonicalStringify(envelope));
  return deepFreezeJson({ ...envelope, manifestDigest }) as unknown as Readonly<DatasetManifest>;
}
