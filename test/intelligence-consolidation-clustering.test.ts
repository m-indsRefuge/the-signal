import { describe, expect, it } from "vitest";
import {
  createFeatureRecord,
  type DeterministicClusterPolicy,
} from "../app/features/intelligence-harness/consolidation/cluster-contract";
import { clusterDeterministically } from "../app/features/intelligence-harness/consolidation/deterministic-clusterer";

const digest = "a".repeat(64);

describe("KTS-I4-F deterministic clustering", () => {
  it("clusters exact feature matches", async () => {
    const result = await clusterDeterministically(
      [await feature("episode:a", { wave: 1 }), await feature("episode:b", { wave: 1 })],
      policy(),
    );
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]?.memberCount).toBe(2);
  });

  it("separates different exact features", async () => {
    const result = await clusterDeterministically(
      [await feature("episode:a", { wave: 1 }), await feature("episode:b", { wave: 2 })],
      policy(),
    );
    expect(result.clusters).toHaveLength(2);
  });

  it("uses explicit numeric buckets", async () => {
    const result = await clusterDeterministically(
      [
        await feature("episode:a", { score: 10 }),
        await feature("episode:b", { score: 20 }),
        await feature("episode:c", { score: 110 }),
      ],
      policy({
        mode: "explicit_bucket",
        featureKeys: ["score"],
        bucketBoundaries: { score: [50, 100] },
      }),
    );
    expect(result.clusters).toHaveLength(2);
  });

  it("uses caller supplied assignments", async () => {
    const result = await clusterDeterministically(
      [await feature("episode:a", {}), await feature("episode:b", {})],
      policy({
        mode: "caller_supplied_assignment",
        callerAssignments: { "episode:a": "group:a", "episode:b": "group:a" },
      }),
    );
    expect(result.clusters).toHaveLength(1);
  });

  for (const missingValueTreatment of ["separate", "shared_unknown"] as const) {
    it(`handles missing values as ${missingValueTreatment}`, async () => {
      const result = await clusterDeterministically(
        [await feature("episode:a", {}), await feature("episode:b", {})],
        policy({ missingValueTreatment }),
      );
      expect(result.clusters.length).toBe(missingValueTreatment === "shared_unknown" ? 1 : 2);
    });
  }

  it("rejects missing required values when configured", async () => {
    await expect(
      clusterDeterministically(
        [await feature("episode:a", {})],
        policy({ missingValueTreatment: "reject" }),
      ),
    ).rejects.toMatchObject({ code: "invalid_cluster" });
  });

  for (const singletonTreatment of ["retain", "separate"] as const) {
    it(`retains singleton treatment ${singletonTreatment}`, async () => {
      const result = await clusterDeterministically(
        [await feature("episode:a", { wave: 1 })],
        policy({ singletonTreatment }),
      );
      expect(result.clusters).toHaveLength(1);
    });
  }

  it("omits singleton clusters when configured", async () => {
    const result = await clusterDeterministically(
      [await feature("episode:a", { wave: 1 })],
      policy({ singletonTreatment: "omit" }),
    );
    expect(result.clusters).toHaveLength(0);
    expect(result.omittedFeatureRecordIds).toEqual(["feature:episode:a"]);
  });

  it("truncates members deterministically", async () => {
    const result = await clusterDeterministically(
      [
        await feature("episode:c", { wave: 1 }),
        await feature("episode:a", { wave: 1 }),
        await feature("episode:b", { wave: 1 }),
      ],
      policy({ maximumMembersPerCluster: 2 }),
    );
    expect(result.clusters[0]?.memberEpisodeIds).toEqual(["episode:a", "episode:b"]);
    expect(result.omittedFeatureRecordIds).toEqual(["feature:episode:c"]);
  });

  it("rejects member overflow when configured", async () => {
    await expect(
      clusterDeterministically(
        [await feature("episode:a", { wave: 1 }), await feature("episode:b", { wave: 1 })],
        policy({ maximumMembersPerCluster: 1, overflowBehaviour: "reject" }),
      ),
    ).rejects.toMatchObject({ code: "cluster_budget_exceeded" });
  });

  it("bounds cluster count", async () => {
    const result = await clusterDeterministically(
      [await feature("episode:a", { wave: 1 }), await feature("episode:b", { wave: 2 })],
      policy({ maximumClusters: 1 }),
    );
    expect(result.clusters).toHaveLength(1);
    expect(result.overflowed).toBe(true);
  });

  it("rejects cluster-count overflow when configured", async () => {
    await expect(
      clusterDeterministically(
        [await feature("episode:a", { wave: 1 }), await feature("episode:b", { wave: 2 })],
        policy({ maximumClusters: 1, overflowBehaviour: "reject" }),
      ),
    ).rejects.toMatchObject({ code: "cluster_budget_exceeded" });
  });

  it("preserves divergent feature reports", async () => {
    const result = await clusterDeterministically(
      [
        await feature("episode:a", { wave: 1, outcome: "pass" }),
        await feature("episode:b", { wave: 1, outcome: "fail" }),
      ],
      policy({ featureKeys: ["wave"] }),
    );
    expect(result.clusters[0]?.sharedFeatureBasis.wave).toBe(1);
  });

  it("is independent of input ordering", async () => {
    const a = await feature("episode:a", { wave: 1 });
    const b = await feature("episode:b", { wave: 1 });
    const first = await clusterDeterministically([a, b], policy());
    const second = await clusterDeterministically([b, a], policy());
    expect(first.clusters[0]?.contentDigest).toBe(second.clusters[0]?.contentDigest);
  });

  const lexicalIds = ["A", "a", "a_1", "a-1", "a.1", "a1", "1", "10", "2"];
  for (const id of lexicalIds) {
    it(`uses locale-independent identity for ${id}`, async () => {
      const result = await clusterDeterministically(
        [await feature(`episode:${id}`, { wave: 1 })],
        policy(),
      );
      expect(result.clusters[0]?.memberEpisodeIds).toEqual([`episode:${id}`]);
    });
  }

  it("handles 1,000 clusters before bounded truncation", async () => {
    const records = await Promise.all(
      Array.from({ length: 1_000 }, (_, index) => feature(`episode:${index}`, { wave: index })),
    );
    const result = await clusterDeterministically(records, policy({ maximumClusters: 100 }));
    expect(result.clusters).toHaveLength(100);
    expect(result.overflowed).toBe(true);
  });

  it("handles a 10,000-member cluster", async () => {
    const records = await Promise.all(
      Array.from({ length: 10_000 }, (_, index) => feature(`episode:${index}`, { wave: 1 })),
    );
    const result = await clusterDeterministically(
      records,
      policy({
        maximumMembersPerCluster: 10_000,
      }),
    );
    expect(result.clusters[0]?.memberCount).toBe(10_000);
  });
});

function policy(overrides: Partial<DeterministicClusterPolicy> = {}): DeterministicClusterPolicy {
  return {
    policyId: "policy:cluster",
    policyVersion: "1",
    mode: "exact_feature_match",
    featureKeys: ["wave"],
    missingValueTreatment: "separate",
    maximumClusters: 2_000,
    maximumMembersPerCluster: 20_000,
    overflowBehaviour: "truncate",
    minimumClusterSize: 1,
    singletonTreatment: "retain",
    ...overrides,
  };
}

async function feature(id: string, features: Record<string, unknown>) {
  return createFeatureRecord({
    featureRecordId: `feature:${id}`,
    featureRecordVersion: "1",
    sourceEpisodeId: id,
    sourceEpisodeDigest: digest,
    domainId: "keep-the-signal",
    domainVersion: "1",
    featureSchemaId: "test.features",
    featureSchemaVersion: 1,
    features: features as never,
    missingFeatures: [],
    extractionMethodId: "test.projection",
    extractionMethodVersion: "1",
    sourceEvidenceReferences: [],
    sourceAttachmentReferences: [],
    sourceRelationReferences: [],
    projectionLimitations: [],
  });
}
