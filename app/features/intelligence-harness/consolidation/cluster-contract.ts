import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failConsolidation, validateConsolidationIdentity } from "./failures";

export const CLUSTER_MODES = Object.freeze([
  "exact_feature_match",
  "explicit_bucket",
  "caller_supplied_assignment",
] as const);
export type ClusterMode = (typeof CLUSTER_MODES)[number];

export const MISSING_VALUE_TREATMENTS = Object.freeze([
  "separate",
  "shared_unknown",
  "reject",
] as const);
export type MissingValueTreatment = (typeof MISSING_VALUE_TREATMENTS)[number];

export const CLUSTER_OVERFLOW_BEHAVIOURS = Object.freeze([
  "truncate",
  "overflow_cluster",
  "reject",
] as const);
export type ClusterOverflowBehaviour = (typeof CLUSTER_OVERFLOW_BEHAVIOURS)[number];

export const SINGLETON_TREATMENTS = Object.freeze(["retain", "omit", "separate"] as const);
export type SingletonTreatment = (typeof SINGLETON_TREATMENTS)[number];

export interface DeterministicClusterPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly mode: ClusterMode;
  readonly featureKeys: readonly string[];
  readonly missingValueTreatment: MissingValueTreatment;
  readonly bucketBoundaries?: Readonly<Record<string, readonly number[]>>;
  readonly callerAssignments?: Readonly<Record<string, string>>;
  readonly maximumClusters: number;
  readonly maximumMembersPerCluster: number;
  readonly overflowBehaviour: ClusterOverflowBehaviour;
  readonly minimumClusterSize: number;
  readonly singletonTreatment: SingletonTreatment;
}

export interface FeatureRecordDraft {
  readonly featureRecordId: string;
  readonly featureRecordVersion: string;
  readonly sourceEpisodeId: string;
  readonly sourceEpisodeDigest: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly featureSchemaId: string;
  readonly featureSchemaVersion: number;
  readonly features: JsonObject;
  readonly missingFeatures: readonly string[];
  readonly extractionMethodId: string;
  readonly extractionMethodVersion: string;
  readonly sourceEvidenceReferences: readonly string[];
  readonly sourceAttachmentReferences: readonly string[];
  readonly sourceRelationReferences: readonly string[];
  readonly projectionLimitations: readonly string[];
}

export interface FeatureRecord extends FeatureRecordDraft {
  readonly contentDigest: string;
}

export interface ClusterRecordDraft {
  readonly clusterId: string;
  readonly clusterVersion: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly memberEpisodeIds: readonly string[];
  readonly memberEpisodeDigests: readonly string[];
  readonly memberFeatureRecordIds: readonly string[];
  readonly sharedFeatureBasis: JsonObject;
  readonly divergentFeatureReport: JsonObject;
  readonly contradictionReferences: readonly string[];
  readonly overflowed: boolean;
  readonly omittedMemberIds: readonly string[];
}

export interface ClusterRecord extends ClusterRecordDraft {
  readonly memberCount: number;
  readonly contentDigest: string;
}

export function validateClusterPolicy(policy: Readonly<DeterministicClusterPolicy>): void {
  validateConsolidationIdentity(
    policy.policyId,
    "policyId",
    "invalid_cluster_policy",
    "clustering",
  );
  validateConsolidationIdentity(
    policy.policyVersion,
    "policyVersion",
    "invalid_cluster_policy",
    "clustering",
  );
  if (
    !CLUSTER_MODES.includes(policy.mode) ||
    !MISSING_VALUE_TREATMENTS.includes(policy.missingValueTreatment) ||
    !CLUSTER_OVERFLOW_BEHAVIOURS.includes(policy.overflowBehaviour) ||
    !SINGLETON_TREATMENTS.includes(policy.singletonTreatment)
  ) {
    failConsolidation(
      "invalid_cluster_policy",
      "clustering",
      "Cluster policy contains an unsupported option.",
    );
  }
  if (
    policy.featureKeys.length === 0 ||
    new Set(policy.featureKeys).size !== policy.featureKeys.length
  ) {
    failConsolidation(
      "invalid_cluster_policy",
      "clustering",
      "Cluster feature keys must be explicit and unique.",
    );
  }
  if (
    ![policy.maximumClusters, policy.maximumMembersPerCluster, policy.minimumClusterSize].every(
      (value) => Number.isSafeInteger(value) && value >= 1,
    )
  ) {
    failConsolidation("invalid_cluster_policy", "clustering", "Cluster limits are invalid.");
  }
  if (policy.mode === "explicit_bucket" && policy.bucketBoundaries === undefined) {
    failConsolidation(
      "invalid_cluster_policy",
      "clustering",
      "Bucket clustering requires explicit boundaries.",
    );
  }
  if (policy.mode === "caller_supplied_assignment" && policy.callerAssignments === undefined) {
    failConsolidation(
      "invalid_cluster_policy",
      "clustering",
      "Caller assignment mode requires assignments.",
    );
  }
}

export async function createFeatureRecord(
  draft: Readonly<FeatureRecordDraft>,
): Promise<Readonly<FeatureRecord>> {
  for (const [label, value] of [
    ["featureRecordId", draft.featureRecordId],
    ["featureRecordVersion", draft.featureRecordVersion],
    ["sourceEpisodeId", draft.sourceEpisodeId],
    ["domainId", draft.domainId],
    ["domainVersion", draft.domainVersion],
    ["featureSchemaId", draft.featureSchemaId],
    ["extractionMethodId", draft.extractionMethodId],
    ["extractionMethodVersion", draft.extractionMethodVersion],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_feature_record", "feature_projection");
  }
  if (!/^[a-f0-9]{64}$/.test(draft.sourceEpisodeDigest)) {
    failConsolidation(
      "invalid_feature_record",
      "feature_projection",
      "Source episode digest is invalid.",
    );
  }
  if (!Number.isSafeInteger(draft.featureSchemaVersion) || draft.featureSchemaVersion < 1) {
    failConsolidation(
      "invalid_feature_record",
      "feature_projection",
      "Feature schema version is invalid.",
    );
  }
  const normalized = canonicalizeJson({
    ...draft,
    missingFeatures: [...new Set(draft.missingFeatures)].sort(),
    sourceEvidenceReferences: [...new Set(draft.sourceEvidenceReferences)].sort(),
    sourceAttachmentReferences: [...new Set(draft.sourceAttachmentReferences)].sort(),
    sourceRelationReferences: [...new Set(draft.sourceRelationReferences)].sort(),
    projectionLimitations: [...new Set(draft.projectionLimitations)].sort(),
  }) as unknown as Omit<FeatureRecord, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonObject) as unknown as Readonly<FeatureRecord>;
}

export async function createClusterRecord(
  draft: Readonly<ClusterRecordDraft>,
): Promise<Readonly<ClusterRecord>> {
  for (const [label, value] of [
    ["clusterId", draft.clusterId],
    ["clusterVersion", draft.clusterVersion],
    ["policyId", draft.policyId],
    ["policyVersion", draft.policyVersion],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_cluster", "clustering");
  }
  if (
    draft.memberEpisodeIds.length === 0 ||
    draft.memberEpisodeIds.length !== draft.memberEpisodeDigests.length ||
    draft.memberEpisodeIds.length !== draft.memberFeatureRecordIds.length
  ) {
    failConsolidation("invalid_cluster", "clustering", "Cluster member lineage is inconsistent.");
  }
  const normalized = canonicalizeJson({
    ...draft,
    memberEpisodeIds: [...draft.memberEpisodeIds],
    memberEpisodeDigests: [...draft.memberEpisodeDigests],
    memberFeatureRecordIds: [...draft.memberFeatureRecordIds],
    contradictionReferences: [...new Set(draft.contradictionReferences)].sort(),
    omittedMemberIds: [...new Set(draft.omittedMemberIds)].sort(),
    memberCount: draft.memberEpisodeIds.length,
  }) as unknown as Omit<ClusterRecord, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonObject) as unknown as Readonly<ClusterRecord>;
}

export function featureValue(record: Readonly<FeatureRecord>, key: string): JsonValue | undefined {
  return record.features[key];
}
