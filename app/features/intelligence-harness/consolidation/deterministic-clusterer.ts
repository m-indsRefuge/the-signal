import {
  canonicalStringify,
  canonicalizeJson,
  type JsonObject,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { failConsolidation } from "./failures";
import {
  createClusterRecord,
  featureValue,
  validateClusterPolicy,
  type ClusterRecord,
  type DeterministicClusterPolicy,
  type FeatureRecord,
} from "./cluster-contract";

export interface ClusterResult {
  readonly clusters: readonly Readonly<ClusterRecord>[];
  readonly omittedFeatureRecordIds: readonly string[];
  readonly overflowed: boolean;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function bucket(value: JsonValue | undefined, boundaries: readonly number[]): string {
  if (typeof value !== "number") return "missing";
  for (let index = 0; index < boundaries.length; index += 1) {
    if (value < boundaries[index]!) return `bucket:${index}`;
  }
  return `bucket:${boundaries.length}`;
}

function clusterKey(
  record: Readonly<FeatureRecord>,
  policy: Readonly<DeterministicClusterPolicy>,
): string {
  if (policy.mode === "caller_supplied_assignment") {
    const assignment = policy.callerAssignments?.[record.sourceEpisodeId];
    if (assignment === undefined) {
      if (policy.missingValueTreatment === "reject") {
        failConsolidation("invalid_cluster", "clustering", "Caller assignment is missing.");
      }
      return policy.missingValueTreatment === "shared_unknown"
        ? "assignment:unknown"
        : `assignment:missing:${record.sourceEpisodeId}`;
    }
    return `assignment:${assignment}`;
  }
  const basis: Record<string, JsonValue> = {};
  for (const key of policy.featureKeys) {
    const value = featureValue(record, key);
    if (value === undefined) {
      if (policy.missingValueTreatment === "reject") {
        failConsolidation(
          "invalid_cluster",
          "clustering",
          "A required cluster feature is missing.",
        );
      }
      basis[key] =
        policy.missingValueTreatment === "shared_unknown"
          ? null
          : `missing:${record.sourceEpisodeId}`;
    } else if (policy.mode === "explicit_bucket") {
      basis[key] = bucket(value, policy.bucketBoundaries?.[key] ?? []);
    } else {
      basis[key] = value;
    }
  }
  return canonicalStringify(basis);
}

function sharedAndDivergent(
  records: readonly Readonly<FeatureRecord>[],
  keys: readonly string[],
): { shared: JsonObject; divergent: JsonObject } {
  const shared: Record<string, JsonValue> = {};
  const divergent: Record<string, JsonValue> = {};
  for (const key of keys) {
    const values = records.map((record) => featureValue(record, key));
    const canonical = values.map((value) => canonicalStringify(value ?? null));
    if (new Set(canonical).size === 1) shared[key] = values[0] ?? null;
    else divergent[key] = values as readonly JsonValue[];
  }
  return {
    shared: canonicalizeJson(shared) as JsonObject,
    divergent: canonicalizeJson(divergent) as JsonObject,
  };
}

export async function clusterDeterministically(
  records: readonly Readonly<FeatureRecord>[],
  policy: Readonly<DeterministicClusterPolicy>,
): Promise<Readonly<ClusterResult>> {
  validateClusterPolicy(policy);
  const ordered = [...records].sort(
    (a, b) =>
      compareCodeUnits(a.sourceEpisodeId, b.sourceEpisodeId) ||
      compareCodeUnits(a.featureRecordId, b.featureRecordId),
  );
  const groups = new Map<string, Readonly<FeatureRecord>[]>();
  for (const record of ordered) {
    const key = clusterKey(record, policy);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const sortedGroups = [...groups.entries()].sort(([left], [right]) =>
    compareCodeUnits(left, right),
  );
  const clusters: Readonly<ClusterRecord>[] = [];
  const omittedFeatureRecordIds: string[] = [];
  let overflowed = false;

  for (const [, group] of sortedGroups) {
    if (
      group.length < policy.minimumClusterSize ||
      (group.length === 1 && policy.singletonTreatment === "omit")
    ) {
      omittedFeatureRecordIds.push(...group.map((record) => record.featureRecordId));
      continue;
    }
    if (clusters.length >= policy.maximumClusters) {
      if (policy.overflowBehaviour === "reject") {
        failConsolidation(
          "cluster_budget_exceeded",
          "clustering",
          "Cluster-count budget was exceeded.",
        );
      }
      omittedFeatureRecordIds.push(...group.map((record) => record.featureRecordId));
      overflowed = true;
      continue;
    }
    let included = group;
    let omitted: Readonly<FeatureRecord>[] = [];
    if (group.length > policy.maximumMembersPerCluster) {
      if (policy.overflowBehaviour === "reject") {
        failConsolidation(
          "cluster_budget_exceeded",
          "clustering",
          "Cluster member budget was exceeded.",
        );
      }
      included = group.slice(0, policy.maximumMembersPerCluster);
      omitted = group.slice(policy.maximumMembersPerCluster);
      omittedFeatureRecordIds.push(...omitted.map((record) => record.featureRecordId));
      overflowed = true;
    }
    const basis = sharedAndDivergent(included, policy.featureKeys);
    const contradictionReferences = included.flatMap((record) =>
      record.sourceRelationReferences.filter((reference) => reference.includes("contradict")),
    );
    clusters.push(
      await createClusterRecord({
        clusterId: `cluster:${policy.policyId}:${clusters.length}`,
        clusterVersion: policy.policyVersion,
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
        memberEpisodeIds: included.map((record) => record.sourceEpisodeId),
        memberEpisodeDigests: included.map((record) => record.sourceEpisodeDigest),
        memberFeatureRecordIds: included.map((record) => record.featureRecordId),
        sharedFeatureBasis: basis.shared,
        divergentFeatureReport: basis.divergent,
        contradictionReferences,
        overflowed: omitted.length > 0,
        omittedMemberIds: omitted.map((record) => record.sourceEpisodeId),
      }),
    );
  }
  return Object.freeze({
    clusters: Object.freeze(clusters),
    omittedFeatureRecordIds: Object.freeze(omittedFeatureRecordIds.sort(compareCodeUnits)),
    overflowed,
  });
}
