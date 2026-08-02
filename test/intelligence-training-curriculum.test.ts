import { describe, expect, it } from "vitest";
import { CURRICULUM_STAGES } from "../app/features/intelligence-harness/training-evidence/curriculum-contract";
import {
  createCurriculumPlan,
  createSamplingDecisions,
} from "../app/features/intelligence-harness/training-evidence/curriculum-planner";
import { createTrainingExample } from "../app/features/intelligence-harness/training-evidence/training-example-contract";

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

const stages = CURRICULUM_STAGES.map((stage) => ({
  stage,
  exampleKinds: ["supervised_target" as const, "abstention" as const, "strategy_routing" as const],
  maximumPerLineageFamily: 2,
  samplingBasisPoints: 10000,
  requireProtectedReview: true,
  validationCheckpoint: true,
}));
describe("KTS-I4-G curriculum", () => {
  it.each(CURRICULUM_STAGES)("exports curriculum stage %s", (x) =>
    expect(CURRICULUM_STAGES).toContain(x),
  );
  it("creates deterministic plans", async () => {
    const a = await createCurriculumPlan("plan", "1", stages, []),
      b = await createCurriculumPlan("plan", "1", stages, []);
    expect(a.planDigest).toBe(b.planDigest);
  });
  it("rejects duplicate stages", async () =>
    await expect(
      createCurriculumPlan("plan", "1", [stages[0]!, stages[0]!], []),
    ).rejects.toMatchObject({ code: "invalid_curriculum_plan" }));
  it("limits lineage family sampling", async () => {
    const p = await createCurriculumPlan("plan", "1", stages, []);
    const examples = [];
    for (let i = 0; i < 4; i++)
      examples.push(
        await createTrainingExample({
          ...base(`sample-${i}`),
          lineageFamilyId: "shared",
          exampleKind: "supervised_target",
          target: acceptedTarget,
        }),
      );
    const d = await createSamplingDecisions(examples, p);
    expect(d.filter((x) => x.included)).toHaveLength(2);
  });
  it("requires review for protected examples", async () => {
    const p = await createCurriculumPlan("plan", "1", stages, []);
    const e = await createTrainingExample({
      ...base(),
      protectedSourceReferences: ["protected"],
      reviewerStatus: "unknown",
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const d = await createSamplingDecisions([e], p);
    expect(d[0]?.reason).toBe("protected_review_required");
  });
  it("supports 10000 sampling decisions", async () => {
    const p = await createCurriculumPlan(
      "plan",
      "1",
      stages.map((s) => ({ ...s, maximumPerLineageFamily: 10000 })),
      [],
    );
    const examples = [];
    for (let i = 0; i < 10000; i++)
      examples.push(
        await createTrainingExample({
          ...base(`curr-${i}`),
          exampleKind: "supervised_target",
          target: acceptedTarget,
        }),
      );
    expect(await createSamplingDecisions(examples, p)).toHaveLength(10000);
  });
  it.each(Array.from({ length: 20 }, (_, i) => i))("is deterministic for sample %s", async (i) => {
    const p = await createCurriculumPlan("plan", "1", stages, []);
    const e = await createTrainingExample({
      ...base(`det-${i}`),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const a = await createSamplingDecisions([e], p),
      b = await createSamplingDecisions([e], p);
    expect(a[0]?.decisionDigest).toBe(b[0]?.decisionDigest);
  });
});
