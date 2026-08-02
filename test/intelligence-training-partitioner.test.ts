import { describe, expect, it } from "vitest";
import { createTrainingExample } from "../app/features/intelligence-harness/training-evidence/training-example-contract";
import {
  assignExamplePartitions,
  materializePartitionAssignments,
} from "../app/features/intelligence-harness/training-evidence/partitioner";
import { validatePartitionPolicy } from "../app/features/intelligence-harness/training-evidence/partition-contract";

const createdAt = "2026-08-02T12:00:00.000Z";
const acceptedTarget = {
  schemaId: "kts-proposal",
  schemaVersion: 1,
  value: { intent: "hold" },
  label: "accepted" as const,
  rejectionClasses: [] as const,
  legal: true,
  grounded: true,
  reviewerStatus: "accepted" as const,
};
function base(id = "example-1") {
  return {
    exampleId: id,
    exampleVersion: "1",
    domainId: "keep-the-signal",
    domainVersion: "1",
    observationSchemaId: "kts-observation",
    observationSchemaVersion: 1,
    targetSchemaId: "kts-proposal",
    targetSchemaVersion: 1,
    constructionPolicyId: "policy-1",
    constructionPolicyVersion: "1",
    sourceRecordReferences: [`source:${id}`],
    lineageFamilyId: `family:${id}`,
    partitionGroupIds: [`seed:${id}`, `episode:${id}`],
    input: { signal: 80, threat: 20 },
    acceptanceLabels: ["accepted"],
    rejectionLabels: [],
    uncertainty: "low" as const,
    evidenceReferences: [`evidence:${id}`],
    contradictionReferences: [],
    protectedSourceReferences: [],
    reviewerStatus: "accepted" as const,
    partition: "train" as const,
    qualityGates: [],
    createdAt,
  };
}

const policy = {
  policyId: "partition-1",
  policyVersion: "1",
  trainBasisPoints: 8000,
  validationBasisPoints: 1000,
  testBasisPoints: 1000,
  salt: "stable",
  quarantineBlocked: true,
};
describe("KTS-I4-G deterministic partitioner", () => {
  it("validates a 10000 basis-point policy", () =>
    expect(() => validatePartitionPolicy(policy)).not.toThrow());
  it("rejects invalid totals", () =>
    expect(() => validatePartitionPolicy({ ...policy, testBasisPoints: 999 })).toThrow());
  it("is stable under input ordering", async () => {
    const a = await createTrainingExample({
        ...base("a"),
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
      b = await createTrainingExample({
        ...base("b"),
        exampleKind: "supervised_target",
        target: acceptedTarget,
      });
    const x = await assignExamplePartitions([a, b], policy),
      y = await assignExamplePartitions([b, a], policy);
    expect(x.manifestDigest).toBe(y.manifestDigest);
  });
  it("keeps derived siblings together", async () => {
    const a = await createTrainingExample({
        ...base("a"),
        lineageFamilyId: "shared",
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
      b = await createTrainingExample({
        ...base("b"),
        lineageFamilyId: "shared",
        exampleKind: "supervised_target",
        target: acceptedTarget,
      });
    const m = await assignExamplePartitions([a, b], policy);
    expect(m.assignments).toHaveLength(1);
  });
  it("quarantines blocking examples", async () => {
    const e = await createTrainingExample({
      ...base(),
      qualityGates: [{ gateId: "x", outcome: "fail", blocking: true, reasons: [] }],
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const m = await assignExamplePartitions([e], policy);
    expect(m.assignments[0]?.partition).toBe("quarantine");
  });
  it.each(["A", "a", "a_1", "a-1", "a.1", "a1", "1", "10", "2"])(
    "assigns locale-independent family %s",
    async (id) => {
      const e = await createTrainingExample({
        ...base(id),
        exampleKind: "supervised_target",
        target: acceptedTarget,
      });
      const m = await assignExamplePartitions([e], policy);
      expect(["train", "validation", "test"]).toContain(m.assignments[0]?.partition);
    },
  );
  it("supports 10000 deterministic assignments", async () => {
    const examples = [];
    for (let i = 0; i < 10000; i++)
      examples.push(
        await createTrainingExample({
          ...base(`scale-${i}`),
          exampleKind: "supervised_target",
          target: acceptedTarget,
        }),
      );
    const m = await assignExamplePartitions(examples, policy);
    expect(m.assignments).toHaveLength(10000);
  });
  it.each(Array.from({ length: 20 }, (_, i) => i))("repeats partition decision %s", async (i) => {
    const e = await createTrainingExample({
      ...base(`repeat-${i}`),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const a = await assignExamplePartitions([e], policy),
      b = await assignExamplePartitions([e], policy);
    expect(a.manifestDigest).toBe(b.manifestDigest);
  });
  it("materializes authoritative partitions", async () => {
    const e = await createTrainingExample({
      ...base(),
      partition: "quarantine",
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const m = await assignExamplePartitions([{ ...e, qualityGates: [] } as typeof e], {
      ...policy,
      quarantineBlocked: false,
    });
    const assigned = await materializePartitionAssignments([e], m);
    expect(assigned[0]?.partition).toBe(m.assignments[0]?.partition);
  });
  it("recomputes digest after partition materialization", async () => {
    const e = await createTrainingExample({
      ...base(),
      partition: "quarantine",
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const m = await assignExamplePartitions([e], { ...policy, quarantineBlocked: false });
    const assigned = await materializePartitionAssignments([e], m);
    if (assigned[0]?.partition !== e.partition)
      expect(assigned[0]?.contentDigest).not.toBe(e.contentDigest);
  });
  it("does not mutate pre-assignment examples", async () => {
    const e = await createTrainingExample({
      ...base(),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const before = e.contentDigest;
    const m = await assignExamplePartitions([e], policy);
    await materializePartitionAssignments([e], m);
    expect(e.contentDigest).toBe(before);
  });
});
