import type { AuthorityBoundary, DatasetPartition } from "./admission-contract";

export type ManifestSampleReference = Readonly<{
  sampleId: string;
  sampleDigest: string;
  role: string;
  partition: DatasetPartition;
  partitionFamilyId: string;
  duplicateFamilyId: string;
}>;

export type DatasetManifest = Readonly<{
  manifestId: string;
  manifestDigest: string;
  schemaId: string;
  schemaVersion: string;
  datasetPurposeId: string;
  domainId: string;
  compatibleDomainVersions: readonly string[];
  policyBindings: Readonly<Record<string, string>>;
  partitionWeights: Readonly<Record<DatasetPartition, number>>;
  samples: readonly ManifestSampleReference[];
  roleCounts: Readonly<Record<string, number>>;
  partitionCounts: Readonly<Record<DatasetPartition, number>>;
  familyCounts: Readonly<Record<string, number>>;
  duplicateCounts: Readonly<Record<string, number>>;
  leakageSummary: Readonly<Record<string, number>>;
  outcomeCounts: Readonly<Record<string, number>>;
  decisionReferences: readonly string[];
  limitations: readonly string[];
  authority: AuthorityBoundary;
}>;
