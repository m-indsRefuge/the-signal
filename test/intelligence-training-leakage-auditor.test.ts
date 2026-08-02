import { describe, expect, it } from "vitest";
import { createTrainingExample } from "../app/features/intelligence-harness/training-evidence/training-example-contract";
import { assignExamplePartitions } from "../app/features/intelligence-harness/training-evidence/partitioner";
import {
  auditLeakage,
  AUDIT_OUTCOMES,
} from "../app/features/intelligence-harness/training-evidence/leakage-auditor";
import {
  auditDuplicates,
  DUPLICATE_CLASSIFICATIONS,
} from "../app/features/intelligence-harness/training-evidence/duplicate-auditor";

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
  trainBasisPoints: 10000,
  validationBasisPoints: 0,
  testBasisPoints: 0,
  salt: "stable",
  quarantineBlocked: true,
};
describe("KTS-I4-G leakage and duplicate audit", () => {
  it.each(AUDIT_OUTCOMES)("exports audit outcome %s", (x) => expect(AUDIT_OUTCOMES).toContain(x));
  it.each(DUPLICATE_CLASSIFICATIONS)("exports duplicate classification %s", (x) =>
    expect(DUPLICATE_CLASSIFICATIONS).toContain(x),
  );
  it("passes clean examples", async () => {
    const e = await createTrainingExample({
        ...base(),
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
      m = await assignExamplePartitions([e], policy),
      r = await auditLeakage([e], m);
    expect(r.blocking).toBe(false);
  });
  it("detects test contamination", async () => {
    const e = await createTrainingExample({
        ...base(),
        acceptanceLabels: ["test_only"],
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
      m = await assignExamplePartitions([e], policy),
      r = await auditLeakage([e], m);
    expect(r.blocking).toBe(true);
  });
  it("detects evaluation target leakage", async () => {
    const e = await createTrainingExample({
        ...base(),
        rejectionLabels: ["evaluation_target"],
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
      m = await assignExamplePartitions([e], policy),
      r = await auditLeakage([e], m);
    expect(r.blocking).toBe(true);
  });
  it("identifies exact duplicates", async () => {
    const e = await createTrainingExample({
      ...base(),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const r = await auditDuplicates([e, e]);
    expect(r.exactDuplicateCount).toBe(2);
  });
  it("identifies conflicting targets", async () => {
    const a = await createTrainingExample({
        ...base("a"),
        input: { shared: true },
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
      b = await createTrainingExample({
        ...base("b"),
        input: { shared: true },
        exampleKind: "supervised_target",
        target: { ...acceptedTarget, value: { intent: "move" } },
      });
    const r = await auditDuplicates([a, b]);
    expect(r.conflictingDuplicateCount).toBe(2);
  });
  it("supports 10000 duplicate audit entries", async () => {
    const examples = [];
    for (let i = 0; i < 10000; i++)
      examples.push(
        await createTrainingExample({
          ...base(`dup-${i}`),
          exampleKind: "supervised_target",
          target: acceptedTarget,
        }),
      );
    const r = await auditDuplicates(examples);
    expect(r.entries).toHaveLength(10000);
  });
  it.each(Array.from({ length: 20 }, (_, i) => i))("keeps unique input %s unique", async (i) => {
    const e = await createTrainingExample({
      ...base(`unique-${i}`),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const r = await auditDuplicates([e]);
    expect(r.entries[0]?.classification).toBe("unique");
  });
});
