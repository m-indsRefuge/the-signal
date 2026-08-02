import { deepFreezeJson } from "../memory-fabric/canonical-json";
import { failTraining, validateTrainingIdentity } from "./failures";
import { auditDuplicates, type DuplicateAuditReport } from "./duplicate-auditor";
import { auditLeakage, type LeakageAuditReport } from "./leakage-auditor";
import { evaluateDatasetQuality, type DatasetQualityReport } from "./quality-gates";
import { assignExamplePartitions, materializePartitionAssignments } from "./partitioner";
import type { PartitionManifest, PartitionPolicy } from "./partition-contract";
import type { TrainingExample } from "./training-example-contract";
import {
  createDatasetManifest,
  type DatasetManifest,
  type DatasetStatus,
} from "./dataset-contract";
import { calculateDatasetMetrics, type DatasetMetrics } from "./dataset-metrics";
import {
  evaluateSourceEligibility,
  isReadOnlyTrainingEvidenceSource,
  validateTrainingSource,
  type ReadOnlyTrainingEvidenceSource,
  type SourceAccessPolicy,
  type SourceEligibilityReport,
  type TrainingSourceRecord,
} from "./source-contract";
export interface DatasetCompilerRequest {
  readonly requestId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly examples: readonly Readonly<TrainingExample>[];
  readonly partitionPolicy: PartitionPolicy;
  readonly requestedStatus: DatasetStatus;
  readonly maximumExamples: number;
  readonly knownLimitations: readonly string[];
  readonly reviewerStatus: "accepted" | "rejected" | "unknown";
  readonly signal?: AbortSignal;
}
export interface SourceCompilationRequest extends Omit<DatasetCompilerRequest, "examples"> {
  readonly domainId: string;
  readonly maximumSourceRecords: number;
  readonly sourcePolicy: SourceAccessPolicy;
}
export type TrainingSourceProjector = (
  source: Readonly<TrainingSourceRecord>,
) => Promise<readonly Readonly<TrainingExample>[]>;
export interface DatasetCompilerResult {
  readonly classification: "complete" | "partial" | "rejected" | "cancelled";
  readonly examples: readonly Readonly<TrainingExample>[];
  readonly sourceEligibilityReports?: readonly Readonly<SourceEligibilityReport>[];
  readonly partitions?: Readonly<PartitionManifest>;
  readonly duplicates?: Readonly<DuplicateAuditReport>;
  readonly leakage?: Readonly<LeakageAuditReport>;
  readonly quality?: Readonly<DatasetQualityReport>;
  readonly manifest?: Readonly<DatasetManifest>;
  readonly metrics?: Readonly<DatasetMetrics>;
  readonly truncated: boolean;
}
export class DatasetCompiler {
  #disposed = false;
  async compile(
    request: Readonly<DatasetCompilerRequest>,
  ): Promise<Readonly<DatasetCompilerResult>> {
    if (this.#disposed)
      failTraining("compiler_disposed", "compiler", "Dataset compiler is disposed.");
    validateTrainingIdentity(
      request.requestId,
      "requestId",
      "invalid_dataset_manifest",
      "compiler",
    );
    if (request.signal?.aborted)
      return Object.freeze({
        classification: "cancelled",
        examples: Object.freeze([]),
        truncated: false,
      });
    if (!Number.isSafeInteger(request.maximumExamples) || request.maximumExamples < 0)
      failTraining("invalid_dataset_manifest", "compiler", "Example budget is invalid.");
    const sorted = [...request.examples].sort((a, b) => (a.exampleId < b.exampleId ? -1 : 1));
    const bounded = Object.freeze(sorted.slice(0, request.maximumExamples));
    const truncated = sorted.length > bounded.length;
    const partitions = await assignExamplePartitions(bounded, request.partitionPolicy);
    const examples = await materializePartitionAssignments(bounded, partitions);
    const duplicates = await auditDuplicates(examples);
    const leakage = await auditLeakage(examples, partitions);
    const quality = await evaluateDatasetQuality(examples, duplicates, leakage);
    const status =
      request.requestedStatus === "validation_candidate" && !quality.eligible
        ? "rejected"
        : request.requestedStatus;
    const manifest = await createDatasetManifest(
      request.datasetId,
      request.datasetVersion,
      status,
      examples,
      partitions,
      quality,
      undefined,
      undefined,
      request.knownLimitations,
      request.reviewerStatus,
    );
    const metrics = calculateDatasetMetrics(examples);
    return deepFreezeJson({
      classification: quality.eligible ? (truncated ? "partial" : "complete") : "rejected",
      examples,
      partitions,
      duplicates,
      leakage,
      quality,
      manifest,
      metrics,
      truncated,
    }) as unknown as Readonly<DatasetCompilerResult>;
  }
  async compileFromSource(
    request: Readonly<SourceCompilationRequest>,
    source: ReadOnlyTrainingEvidenceSource,
    projector: TrainingSourceProjector,
  ): Promise<Readonly<DatasetCompilerResult>> {
    if (this.#disposed)
      failTraining("compiler_disposed", "compiler", "Dataset compiler is disposed.");
    if (!isReadOnlyTrainingEvidenceSource(source))
      failTraining(
        "source_policy_prohibited",
        "source",
        "Training source must expose read operations only.",
      );
    if (!Number.isSafeInteger(request.maximumSourceRecords) || request.maximumSourceRecords < 0)
      failTraining("invalid_training_source", "source", "Source record budget is invalid.");
    if (request.signal?.aborted)
      return Object.freeze({
        classification: "cancelled",
        examples: Object.freeze([]),
        sourceEligibilityReports: Object.freeze([]),
        truncated: false,
      });
    const sources = await source.listSources(request.domainId, request.maximumSourceRecords);
    if (sources.length > request.maximumSourceRecords)
      failTraining(
        "invalid_training_source",
        "source",
        "Source returned more records than authorized.",
      );
    const reports: Readonly<SourceEligibilityReport>[] = [];
    const examples: Readonly<TrainingExample>[] = [];
    for (const record of sources) {
      await validateTrainingSource(record);
      const report = evaluateSourceEligibility(record, request.sourcePolicy);
      reports.push(report);
      if (report.outcome !== "eligible") continue;
      for (const example of await projector(record)) examples.push(example);
    }
    const result = await this.compile({ ...request, examples });
    return deepFreezeJson({
      ...result,
      sourceEligibilityReports: Object.freeze(reports),
    }) as unknown as Readonly<DatasetCompilerResult>;
  }
  dispose(): void {
    this.#disposed = true;
  }
}
