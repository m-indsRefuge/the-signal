import { ABSENT_AUTHORITY, immutableCopy, serializedLength, sortText } from "./admission-contract";
import type { AdmissionDecision } from "./admission-decision";
import { fail } from "./failures";
import type { DatasetManifest, ManifestSampleReference } from "./manifest-contract";
import { computeManifestDigest } from "./manifest-digest";
import type { PartitionPolicy } from "./partition-policy";
import type { NormalizedSample } from "./sample-contract";

export const MAX_MANIFEST_SAMPLES = 10_000;
export const MAX_MANIFEST_SERIALIZED_CHARACTERS = 16_777_216;

export type ManifestBuildInput = Readonly<{
  manifestId: string;
  schemaId: string;
  schemaVersion: string;
  datasetPurposeId: string;
  domainId: string;
  compatibleDomainVersions: readonly string[];
  policyBindings: Readonly<Record<string, string>>;
  partitionPolicy: PartitionPolicy;
  decisions: readonly AdmissionDecision[];
  samples: readonly NormalizedSample[];
  limitations: readonly string[];
}>;

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

export function buildDatasetManifest(input: ManifestBuildInput): DatasetManifest {
  const sampleById = new Map(input.samples.map((sample) => [sample.sampleId, sample]));
  const included: ManifestSampleReference[] = [];
  const seenSampleIds = new Set<string>();
  const familyPartition = new Map<string, string>();
  const roleCounts: Record<string, number> = {};
  const partitionCounts = {
    train: 0,
    validation: 0,
    test: 0,
    holdout: 0,
  };
  const familyCounts: Record<string, number> = {};
  const duplicateCounts: Record<string, number> = {};
  const leakageSummary: Record<string, number> = {};
  const outcomeCounts: Record<string, number> = {};

  const decisions = [...input.decisions].sort((a, b) =>
    a.decisionId < b.decisionId ? -1 : a.decisionId > b.decisionId ? 1 : 0,
  );

  for (const decision of decisions) {
    increment(outcomeCounts, decision.outcome);
    increment(leakageSummary, decision.leakage.state);
    increment(duplicateCounts, decision.duplicate.status);

    if (decision.outcome !== "admitted") {
      continue;
    }
    if (
      decision.leakage.state !== "clear" ||
      !decision.sampleId ||
      !decision.sampleDigest ||
      !decision.partition
    ) {
      fail("manifest_digest_mismatch", "admitted decision lacks clear sample binding");
    }
    const sample = sampleById.get(decision.sampleId);
    if (!sample || sample.sampleDigest !== decision.sampleDigest) {
      fail("sample_digest_mismatch", "manifest sample binding mismatch");
    }
    if (seenSampleIds.has(sample.sampleId)) {
      continue;
    }
    seenSampleIds.add(sample.sampleId);

    const existingPartition = familyPartition.get(sample.families.partitionFamilyId);
    if (existingPartition && existingPartition !== decision.partition.partition) {
      fail("cross_partition_leakage", "partition family spans multiple partitions");
    }
    familyPartition.set(sample.families.partitionFamilyId, decision.partition.partition);

    included.push({
      sampleId: sample.sampleId,
      sampleDigest: sample.sampleDigest,
      role: sample.role,
      partition: decision.partition.partition,
      partitionFamilyId: sample.families.partitionFamilyId,
      duplicateFamilyId: sample.families.duplicateFamilyId,
    });
    increment(roleCounts, sample.role);
    increment(partitionCounts, decision.partition.partition);
    increment(familyCounts, sample.families.partitionFamilyId);
  }

  if (included.length > MAX_MANIFEST_SAMPLES) {
    fail("record_budget_exceeded", "manifest sample-count budget exceeded");
  }

  included.sort((a, b) => (a.sampleId < b.sampleId ? -1 : a.sampleId > b.sampleId ? 1 : 0));

  const core = {
    manifestId: input.manifestId,
    schemaId: input.schemaId,
    schemaVersion: input.schemaVersion,
    datasetPurposeId: input.datasetPurposeId,
    domainId: input.domainId,
    compatibleDomainVersions: sortText(input.compatibleDomainVersions),
    policyBindings: input.policyBindings,
    partitionWeights: input.partitionPolicy.weights,
    samples: included,
    roleCounts,
    partitionCounts,
    familyCounts,
    duplicateCounts,
    leakageSummary,
    outcomeCounts,
    decisionReferences: decisions.map((decision) => decision.decisionDigest),
    limitations: sortText(input.limitations),
    authority: ABSENT_AUTHORITY,
  };

  const manifest = {
    ...core,
    manifestDigest: computeManifestDigest(core),
  };
  if (serializedLength(manifest) > MAX_MANIFEST_SERIALIZED_CHARACTERS) {
    fail("serialized_size_exceeded", "manifest serialized-size budget exceeded");
  }
  return immutableCopy(manifest) as DatasetManifest;
}
