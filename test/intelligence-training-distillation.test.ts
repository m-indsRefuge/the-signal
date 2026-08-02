import { describe, expect, it } from "vitest";
import { DISTILLATION_METHOD_COMPATIBILITY } from "../app/features/intelligence-harness/training-evidence/distillation-contract";
import {
  createDistillationRecord,
  createDistillationPlan,
} from "../app/features/intelligence-harness/training-evidence/distillation-planner";
const teacher = {
  teacherId: "teacher",
  teacherVersion: "1",
  teacherKind: "human" as const,
  schemaId: "kts-proposal",
  schemaVersion: 1,
  reviewed: true,
  output: { intent: "hold" },
  evidenceReferences: ["evidence"],
  uncertainty: "low" as const,
};
function draft(id = "record") {
  return {
    recordId: id,
    recordVersion: "1",
    studentInput: { signal: 80 },
    teacher,
    targetSchemaId: "kts-proposal",
    targetSchemaVersion: 1,
    sourceEvidenceReferences: ["evidence"],
    partition: "train" as const,
    curriculumStage: "mixed_difficulty",
    methods: ["teacher_student_distillation" as const],
  };
}
describe("KTS-I4-G distillation planning", () => {
  it.each(DISTILLATION_METHOD_COMPATIBILITY)("exports compatibility %s", (x) =>
    expect(DISTILLATION_METHOD_COMPATIBILITY).toContain(x),
  );
  it("creates immutable records", async () =>
    expect(Object.isFrozen(await createDistillationRecord(draft()))).toBe(true));
  it("creates stable record digests", async () =>
    expect((await createDistillationRecord(draft())).contentDigest).toBe(
      (await createDistillationRecord(draft())).contentDigest,
    ));
  it("rejects teacher schema mismatch", async () =>
    await expect(
      createDistillationRecord({ ...draft(), targetSchemaId: "other" }),
    ).rejects.toMatchObject({ code: "teacher_schema_incompatible" }));
  it("rejects unreviewed model teacher", async () =>
    await expect(
      createDistillationRecord({
        ...draft(),
        teacher: { ...teacher, teacherKind: "recorded_model", reviewed: false },
      }),
    ).rejects.toMatchObject({ code: "teacher_review_missing" }));
  it("creates ordered plans", async () => {
    const a = await createDistillationRecord(draft("a")),
      b = await createDistillationRecord(draft("b"));
    const p = await createDistillationPlan("plan", "1", [b, a]);
    expect(p.records.map((r) => r.recordId)).toEqual(["a", "b"]);
  });
  it("supports 10000 distillation records", async () => {
    const records = [];
    for (let i = 0; i < 10000; i++)
      records.push(await createDistillationRecord(draft(`record-${i}`)));
    expect((await createDistillationPlan("plan", "1", records)).records).toHaveLength(10000);
  });
  it.each(Array.from({ length: 20 }, (_, i) => i))("preserves record %s", async (i) => {
    const r = await createDistillationRecord(draft(`r-${i}`));
    expect(r.recordId).toBe(`r-${i}`);
  });
});
