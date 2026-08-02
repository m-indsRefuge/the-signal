import { describe, expect, it } from "vitest";
import {
  EXAMPLE_KINDS,
  DATASET_PARTITIONS,
  QUALITY_OUTCOMES,
  createTrainingExample,
  validateTrainingExample,
} from "../app/features/intelligence-harness/training-evidence/training-example-contract";
import {
  TARGET_LABELS,
  REJECTION_CLASSES,
  TEACHER_KINDS,
  normalizeTarget,
  normalizeTeacherRecord,
} from "../app/features/intelligence-harness/training-evidence/target-contract";
import {
  TRAINING_FAILURE_CODES,
  TrainingEvidenceError,
} from "../app/features/intelligence-harness/training-evidence/failures";
import {
  SOURCE_CLASSIFICATIONS,
  SOURCE_ELIGIBILITY_OUTCOMES,
  GOVERNANCE_STATUSES,
  createTrainingSource,
  validateTrainingSource,
  evaluateSourceEligibility,
} from "../app/features/intelligence-harness/training-evidence/source-contract";

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

describe("KTS-I4-G example contracts", () => {
  it.each(EXAMPLE_KINDS)("exports example kind %s", (value) =>
    expect(EXAMPLE_KINDS).toContain(value),
  );
  it.each(DATASET_PARTITIONS)("exports partition %s", (value) =>
    expect(DATASET_PARTITIONS).toContain(value),
  );
  it.each(QUALITY_OUTCOMES)("exports quality outcome %s", (value) =>
    expect(QUALITY_OUTCOMES).toContain(value),
  );
  it.each(TARGET_LABELS)("exports target label %s", (value) =>
    expect(TARGET_LABELS).toContain(value),
  );
  it.each(REJECTION_CLASSES)("exports rejection class %s", (value) =>
    expect(REJECTION_CLASSES).toContain(value),
  );
  it.each(TEACHER_KINDS)("exports teacher kind %s", (value) =>
    expect(TEACHER_KINDS).toContain(value),
  );
  it.each(TRAINING_FAILURE_CODES)("exports failure code %s", (value) =>
    expect(TRAINING_FAILURE_CODES).toContain(value),
  );
  it("creates immutable examples", async () => {
    const e = await createTrainingExample({
      ...base(),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    expect(Object.isFrozen(e)).toBe(true);
  });
  it("creates stable digests", async () => {
    const a = await createTrainingExample({
      ...base(),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    const b = await createTrainingExample({
      ...base(),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    expect(a.contentDigest).toBe(b.contentDigest);
  });
  it("validates matching digests", async () => {
    const e = await createTrainingExample({
      ...base(),
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    await expect(validateTrainingExample(e)).resolves.toBeUndefined();
  });
  it("rejects invalid IDs", async () => {
    await expect(
      createTrainingExample({
        ...base("bad id"),
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
    ).rejects.toBeInstanceOf(TrainingEvidenceError);
  });
  it("rejects empty partition groups", async () => {
    await expect(
      createTrainingExample({
        ...base(),
        partitionGroupIds: [],
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
    ).rejects.toMatchObject({ code: "invalid_training_example" });
  });
  it("rejects missing target", async () => {
    await expect(
      createTrainingExample({ ...base(), exampleKind: "supervised_target" } as never),
    ).rejects.toMatchObject({ code: "invalid_target" });
  });
  it("rejects incomplete preference pairs", async () => {
    await expect(
      createTrainingExample({
        ...base(),
        exampleKind: "preference_pair",
        preferredTarget: acceptedTarget,
      } as never),
    ).rejects.toMatchObject({ code: "invalid_preference_pair" });
  });
  it("sorts source references", async () => {
    const e = await createTrainingExample({
      ...base(),
      sourceRecordReferences: ["z", "a", "z"],
      exampleKind: "supervised_target",
      target: acceptedTarget,
    });
    expect(e.sourceRecordReferences).toEqual(["a", "z"]);
  });
  it("rejects accepted illegal target", () =>
    expect(() => normalizeTarget({ ...acceptedTarget, legal: false })).toThrow());
  it("rejects accepted ungrounded target", () =>
    expect(() => normalizeTarget({ ...acceptedTarget, grounded: false })).toThrow());
  it("requires review for recorded model teacher", () =>
    expect(() =>
      normalizeTeacherRecord({
        teacherId: "teacher",
        teacherVersion: "1",
        teacherKind: "recorded_model",
        schemaId: "kts-proposal",
        schemaVersion: 1,
        reviewed: false,
        output: { intent: "hold" },
        evidenceReferences: ["e"],
        uncertainty: "low",
      }),
    ).toThrow());
  it("prohibits hidden reasoning fields", () =>
    expect(() =>
      normalizeTeacherRecord({
        teacherId: "teacher",
        teacherVersion: "1",
        teacherKind: "human",
        schemaId: "kts-proposal",
        schemaVersion: 1,
        reviewed: true,
        output: { hidden_reasoning: "secret" },
        evidenceReferences: ["e"],
        uncertainty: "low",
      }),
    ).toThrow());
  it.each(SOURCE_CLASSIFICATIONS)("exports source classification %s", (value) =>
    expect(SOURCE_CLASSIFICATIONS).toContain(value),
  );
  it.each(SOURCE_ELIGIBILITY_OUTCOMES)("exports source eligibility %s", (value) =>
    expect(SOURCE_ELIGIBILITY_OUTCOMES).toContain(value),
  );
  it.each(GOVERNANCE_STATUSES)("exports governance status %s", (value) =>
    expect(GOVERNANCE_STATUSES).toContain(value),
  );
  it("creates and validates source digests", async () => {
    const source = await createTrainingSource({
      sourceId: "s",
      sourceVersion: "1",
      domainId: "keep-the-signal",
      domainVersion: "1",
      schemaId: "source",
      schemaVersion: 1,
      classification: "accepted",
      lineageFamilyId: "family",
      partitionGroupIds: ["seed"],
      payload: { signal: 80 },
      evidenceReferences: ["e"],
      contradictionReferences: [],
      protected: false,
      consentStatus: "accepted",
      privacyStatus: "accepted",
      reviewerStatus: "accepted",
      recordedAt: createdAt,
    });
    await expect(validateTrainingSource(source)).resolves.toBeUndefined();
  });
  it("reports protected source ineligible", async () => {
    const source = await createTrainingSource({
      sourceId: "s",
      sourceVersion: "1",
      domainId: "keep-the-signal",
      domainVersion: "1",
      schemaId: "source",
      schemaVersion: 1,
      classification: "accepted",
      lineageFamilyId: "family",
      partitionGroupIds: ["seed"],
      payload: { signal: 80 },
      evidenceReferences: ["e"],
      contradictionReferences: [],
      protected: true,
      consentStatus: "accepted",
      privacyStatus: "accepted",
      reviewerStatus: "accepted",
      recordedAt: createdAt,
    });
    expect(
      evaluateSourceEligibility(source, {
        permittedDomains: ["keep-the-signal"],
        permittedClassifications: ["accepted"],
        allowProtected: false,
        requireAcceptedConsent: true,
        requireAcceptedPrivacy: true,
        requireAcceptedReview: true,
      }).outcome,
    ).toBe("ineligible");
  });
  it("rejects hidden reasoning in examples", async () => {
    await expect(
      createTrainingExample({
        ...base(),
        input: { hidden_reasoning: "secret" },
        exampleKind: "supervised_target",
        target: acceptedTarget,
      }),
    ).rejects.toMatchObject({ code: "hidden_reasoning_prohibited" });
  });
  it("enforces input character budget", async () => {
    await expect(
      createTrainingExample(
        {
          ...base(),
          input: { text: "12345" },
          exampleKind: "supervised_target",
          target: acceptedTarget,
        },
        { maximumInputCharacters: 4, maximumTargetCharacters: 100, maximumSourceReferences: 10 },
      ),
    ).rejects.toMatchObject({ code: "invalid_training_example" });
  });
  it("enforces target character budget", async () => {
    await expect(
      createTrainingExample(
        { ...base(), exampleKind: "supervised_target", target: acceptedTarget },
        { maximumInputCharacters: 100, maximumTargetCharacters: 4, maximumSourceReferences: 10 },
      ),
    ).rejects.toMatchObject({ code: "invalid_target" });
  });
  it("enforces source-reference budget", async () => {
    await expect(
      createTrainingExample(
        {
          ...base(),
          sourceRecordReferences: ["a", "b"],
          exampleKind: "supervised_target",
          target: acceptedTarget,
        },
        { maximumInputCharacters: 100, maximumTargetCharacters: 100, maximumSourceReferences: 1 },
      ),
    ).rejects.toMatchObject({ code: "invalid_training_example" });
  });
});
