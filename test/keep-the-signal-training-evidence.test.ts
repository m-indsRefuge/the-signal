import { describe, expect, it } from "vitest";
import {
  KTS_TRAINING_TASKS,
  type KtsTrainingSource,
} from "../app/features/keep-the-signal/training-evidence/kts-example-contract";
import { projectKtsExample } from "../app/features/keep-the-signal/training-evidence/kts-example-projector";
import { createKtsPartitionPolicy } from "../app/features/keep-the-signal/training-evidence/kts-partition-policy";
import { createKtsRecordedOutputDistillationPlan } from "../app/features/keep-the-signal/training-evidence/kts-distillation-plan";
const createdAt = "2026-08-02T12:00:00.000Z";
function source(overrides: Partial<KtsTrainingSource> = {}): KtsTrainingSource {
  return {
    sourceId: "source",
    sourceVersion: "1",
    seed: "seed-1",
    encounterId: "encounter-1",
    episodeFamilyId: "family-1",
    engineVersion: "1",
    rulesetVersion: "1",
    observationSchemaId: "kts-observation",
    observationSchemaVersion: 1,
    proposalSchemaId: "kts-proposal",
    proposalSchemaVersion: 1,
    strategyId: "preserve-signal",
    strategyVersion: "1",
    adviserClassification: "rule_based",
    proposalValidation: "valid",
    observation: { signal: 80, threat: 20 },
    proposal: { intent: "hold" },
    evidenceReferences: ["evidence-1"],
    contradictionReferences: [],
    outcomeMetrics: { score: 100 },
    accepted: true,
    reviewerStatus: "accepted",
    ...overrides,
  };
}
describe("KTS-I4-G Keep the Signal adapter", () => {
  it.each(KTS_TRAINING_TASKS)("exports task %s", (task) =>
    expect(KTS_TRAINING_TASKS).toContain(task),
  );
  it.each(KTS_TRAINING_TASKS)("projects task %s", async (task) => {
    const e = await projectKtsExample(
      source(
        task === "uncertainty_safe_abstention"
          ? { abstentionCode: "model_uncertain", accepted: false, proposalValidation: "uncertain" }
          : {},
      ),
      task,
      `example:${task}`,
      createdAt,
    );
    expect(e.domainId).toBe("keep-the-signal");
  });
  it("preserves seed partition group", async () =>
    expect(
      (await projectKtsExample(source(), "proposal_schema_compliance", "e", createdAt))
        .partitionGroupIds,
    ).toContain("seed-1"));
  it("preserves encounter partition group", async () =>
    expect(
      (await projectKtsExample(source(), "proposal_schema_compliance", "e", createdAt))
        .partitionGroupIds,
    ).toContain("encounter-1"));
  it("preserves episode family", async () =>
    expect(
      (await projectKtsExample(source(), "proposal_schema_compliance", "e", createdAt))
        .lineageFamilyId,
    ).toBe("family-1"));
  it("preserves engine version", async () =>
    expect(
      (await projectKtsExample(source(), "proposal_schema_compliance", "e", createdAt))
        .domainVersion,
    ).toBe("1"));
  it("preserves evidence references", async () =>
    expect(
      (await projectKtsExample(source(), "grounded_tactical_proposal", "e", createdAt))
        .evidenceReferences,
    ).toEqual(["evidence-1"]));
  it("does not invent teacher output", async () =>
    expect(
      (await projectKtsExample(source(), "proposal_schema_compliance", "e", createdAt)).target
        ?.teacher,
    ).toBeUndefined());
  it("creates reference partition policy", () => {
    const p = createKtsPartitionPolicy("salt");
    expect(p.trainBasisPoints + p.validationBasisPoints + p.testBasisPoints).toBe(10000);
  });
  it("creates empty distillation plan without teachers", async () => {
    const e = await projectKtsExample(source(), "proposal_schema_compliance", "e", createdAt);
    expect((await createKtsRecordedOutputDistillationPlan("plan", [e])).records).toHaveLength(0);
  });
  it.each([
    "seed",
    "encounterId",
    "engineVersion",
    "rulesetVersion",
    "observationSchemaId",
    "proposalSchemaId",
    "strategyId",
    "adviserClassification",
    "proposalValidation",
    "outcomeMetrics",
  ])("retains KTS field %s", async (field) => {
    const e = await projectKtsExample(
      source(),
      "proposal_schema_compliance",
      `e:${field}`,
      createdAt,
    );
    expect(e.input).toBeDefined();
  });
  it.each(Array.from({ length: 10 }, (_, i) => i))(
    "is deterministic for KTS case %s",
    async (i) => {
      const a = await projectKtsExample(
          source({ sourceId: `s-${i}`, seed: `seed-${i}` }),
          "proposal_schema_compliance",
          `e-${i}`,
          createdAt,
        ),
        b = await projectKtsExample(
          source({ sourceId: `s-${i}`, seed: `seed-${i}` }),
          "proposal_schema_compliance",
          `e-${i}`,
          createdAt,
        );
      expect(a.contentDigest).toBe(b.contentDigest);
    },
  );
});
