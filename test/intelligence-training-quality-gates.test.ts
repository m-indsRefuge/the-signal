import { describe, expect, it } from "vitest";
import {
  createTrainingExample,
  type TrainingExample,
} from "../app/features/intelligence-harness/training-evidence/training-example-contract";
import { auditDuplicates } from "../app/features/intelligence-harness/training-evidence/duplicate-auditor";
import { auditLeakage } from "../app/features/intelligence-harness/training-evidence/leakage-auditor";
import { assignExamplePartitions } from "../app/features/intelligence-harness/training-evidence/partitioner";
import {
  evaluateDatasetQuality,
  REQUIRED_QUALITY_GATES,
  assertDatasetQuality,
} from "../app/features/intelligence-harness/training-evidence/quality-gates";

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
async function report(examples: readonly Readonly<TrainingExample>[]) {
  const p = await assignExamplePartitions(examples, policy);
  return evaluateDatasetQuality(
    examples,
    await auditDuplicates(examples),
    await auditLeakage(examples, p),
  );
}
describe("KTS-I4-G quality gates", () => {
  it.each(REQUIRED_QUALITY_GATES)("exports required gate %s", (x) =>
    expect(REQUIRED_QUALITY_GATES).toContain(x),
  );
  it("passes a valid dataset", async () => {
    const e = await createTrainingExample({
      ...base(),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const r = await report([e]);
    expect(r.eligible).toBe(true);
    expect(() => assertDatasetQuality(r)).not.toThrow();
  });
  it("warns for empty datasets", async () => {
    const r = await report([]);
    expect(r.gates.find((g) => g.gateId === "class_balance")?.outcome).toBe("warning");
  });
  it("blocks conflicting duplicates", async () => {
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
    const r = await report([a, b]);
    expect(r.eligible).toBe(false);
    expect(() => assertDatasetQuality(r)).toThrow();
  });
  it("blocks example quality failures", async () => {
    const e = await createTrainingExample({
      ...base(),
      qualityGates: [{ gateId: "source", outcome: "fail", blocking: true, reasons: ["missing"] }],
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const r = await report([e]);
    expect(r.eligible).toBe(false);
  });
  it.each(Array.from({ length: 15 }, (_, i) => i))(
    "evaluates deterministic valid set %s",
    async (i) => {
      const e = await createTrainingExample({
        ...base(`quality-${i}`),
        exampleKind: "supervised_target",
        target: acceptedTarget,
      });
      const a = await report([e]),
        b = await report([e]);
      expect(a.reportDigest).toBe(b.reportDigest);
    },
  );
});
