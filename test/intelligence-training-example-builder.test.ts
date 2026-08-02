import { describe, expect, it } from "vitest";
import {
  buildSupervisedTarget,
  buildPreferencePair,
  buildCorrection,
  buildAbstention,
  buildRetrievalGrounding,
  buildStrategyRouting,
} from "../app/features/intelligence-harness/training-evidence/training-example-builder";

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

const rejected = {
  ...acceptedTarget,
  value: { intent: "invalid" },
  label: "rejected" as const,
  rejectionClasses: ["illegal_proposal" as const],
  legal: false,
  grounded: true,
};
describe("KTS-I4-G example builders", () => {
  it("builds supervised targets", async () =>
    expect((await buildSupervisedTarget(base(), acceptedTarget)).exampleKind).toBe(
      "supervised_target",
    ));
  it("builds preference pairs", async () =>
    expect((await buildPreferencePair(base(), acceptedTarget, rejected)).exampleKind).toBe(
      "preference_pair",
    ));
  it("rejects identical preferences", async () =>
    await expect(buildPreferencePair(base(), acceptedTarget, acceptedTarget)).rejects.toMatchObject(
      { code: "preference_not_established" },
    ));
  it("builds corrections", async () =>
    expect((await buildCorrection(base(), { intent: "bad" }, acceptedTarget)).input).toHaveProperty(
      "original",
    ));
  it("builds abstentions", async () => {
    const t = { ...rejected, label: "abstained" as const, value: { code: "model_uncertain" } };
    expect((await buildAbstention(base(), t)).exampleKind).toBe("abstention");
  });
  it("rejects non-abstention abstention target", async () =>
    await expect(buildAbstention(base(), rejected)).rejects.toMatchObject({
      code: "invalid_target",
    }));
  it("builds grounded examples", async () =>
    expect(
      (await buildRetrievalGrounding(base(), acceptedTarget, ["evidence:example-1"])).exampleKind,
    ).toBe("retrieval_grounding"));
  it("rejects omitted evidence grounding", async () =>
    await expect(buildRetrievalGrounding(base(), acceptedTarget, [])).rejects.toMatchObject({
      code: "target_ungrounded",
    }));
  it("builds strategy routing", async () =>
    expect((await buildStrategyRouting(base(), acceptedTarget)).exampleKind).toBe(
      "strategy_routing",
    ));
  it.each(Array.from({ length: 24 }, (_, i) => i + 1))(
    "preserves builder identity case %s",
    async (i) => {
      const e = await buildSupervisedTarget(base(`builder-${i}`), acceptedTarget);
      expect(e.exampleId).toBe(`builder-${i}`);
      expect(e.sourceRecordReferences).toContain(`source:builder-${i}`);
    },
  );
});
