import { describe, expect, it } from "vitest";
import { DatasetCompiler } from "../app/features/intelligence-harness/training-evidence/dataset-compiler";
import { createTrainingExample } from "../app/features/intelligence-harness/training-evidence/training-example-contract";
import {
  createExportDraft,
  EXPORT_FORMATS,
} from "../app/features/intelligence-harness/training-evidence/export-contract";
import { DATASET_STATUSES } from "../app/features/intelligence-harness/training-evidence/dataset-contract";
import { createTrainingSource } from "../app/features/intelligence-harness/training-evidence/source-contract";

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
async function example(id = "example") {
  return createTrainingExample({
    ...base(id),
    exampleKind: "supervised_target",
    target: acceptedTarget,
  });
}
describe("KTS-I4-G dataset compiler", () => {
  it.each(EXPORT_FORMATS)("exports export format %s", (x) => expect(EXPORT_FORMATS).toContain(x));
  it.each(DATASET_STATUSES)("exports dataset status %s", (x) =>
    expect(DATASET_STATUSES).toContain(x),
  );
  it("compiles a bounded dataset", async () => {
    const c = new DatasetCompiler(),
      r = await c.compile({
        requestId: "r",
        datasetId: "d",
        datasetVersion: "1",
        examples: [await example()],
        partitionPolicy: policy,
        requestedStatus: "draft",
        maximumExamples: 10,
        knownLimitations: [],
        reviewerStatus: "unknown",
      });
    expect(r.classification).toBe("complete");
    expect(r.manifest?.datasetId).toBe("d");
  });
  it("returns partial on truncation", async () => {
    const c = new DatasetCompiler(),
      r = await c.compile({
        requestId: "r",
        datasetId: "d",
        datasetVersion: "1",
        examples: [await example("a"), await example("b")],
        partitionPolicy: policy,
        requestedStatus: "draft",
        maximumExamples: 1,
        knownLimitations: [],
        reviewerStatus: "unknown",
      });
    expect(r.classification).toBe("partial");
  });
  it("cancels before work", async () => {
    const c = new DatasetCompiler(),
      controller = new AbortController();
    controller.abort();
    const r = await c.compile({
      requestId: "r",
      datasetId: "d",
      datasetVersion: "1",
      examples: [],
      partitionPolicy: policy,
      requestedStatus: "draft",
      maximumExamples: 1,
      knownLimitations: [],
      reviewerStatus: "unknown",
      signal: controller.signal,
    });
    expect(r.classification).toBe("cancelled");
  });
  it("rejects after disposal", async () => {
    const c = new DatasetCompiler();
    c.dispose();
    await expect(
      c.compile({
        requestId: "r",
        datasetId: "d",
        datasetVersion: "1",
        examples: [],
        partitionPolicy: policy,
        requestedStatus: "draft",
        maximumExamples: 1,
        knownLimitations: [],
        reviewerStatus: "unknown",
      }),
    ).rejects.toMatchObject({ code: "compiler_disposed" });
  });
  it("creates bounded export drafts", async () => {
    const d = await createExportDraft("d", "1", "jsonl", ["b", "a"], 1000, 0, 0);
    expect(d.orderedExampleIds).toEqual(["a", "b"]);
  });
  it("rejects export overflow", async () =>
    await expect(
      createExportDraft(
        "d",
        "1",
        "json",
        Array.from({ length: 100 }, (_, i) => `x-${i}`),
        10,
        0,
        0,
      ),
    ).rejects.toMatchObject({ code: "export_budget_exceeded" }));
  it("supports 10000 example candidates", async () => {
    const examples = [];
    for (let i = 0; i < 10000; i++) examples.push(await example(`scale-${i}`));
    const c = new DatasetCompiler(),
      r = await c.compile({
        requestId: "r",
        datasetId: "d",
        datasetVersion: "1",
        examples,
        partitionPolicy: policy,
        requestedStatus: "draft",
        maximumExamples: 10000,
        knownLimitations: [],
        reviewerStatus: "unknown",
      });
    expect(r.examples).toHaveLength(10000);
  });
  it.each(Array.from({ length: 18 }, (_, i) => i))("compiles deterministic case %s", async (i) => {
    const e = await example(`compiler-${i}`),
      a = new DatasetCompiler(),
      b = new DatasetCompiler();
    const req = {
      requestId: "r",
      datasetId: "d",
      datasetVersion: "1",
      examples: [e],
      partitionPolicy: policy,
      requestedStatus: "draft" as const,
      maximumExamples: 1,
      knownLimitations: [],
      reviewerStatus: "unknown" as const,
    };
    expect((await a.compile(req)).manifest?.manifestDigest).toBe(
      (await b.compile(req)).manifest?.manifestDigest,
    );
  });
  it("compiles through a read-only source", async () => {
    const record = await createTrainingSource({
      sourceId: "source",
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
    let calls = 0;
    const source = {
      async getSource() {
        return record;
      },
      async listSources() {
        calls += 1;
        return [record];
      },
    };
    const c = new DatasetCompiler();
    const r = await c.compileFromSource(
      {
        requestId: "r",
        datasetId: "d",
        datasetVersion: "1",
        domainId: "keep-the-signal",
        maximumSourceRecords: 1,
        sourcePolicy: {
          permittedDomains: ["keep-the-signal"],
          permittedClassifications: ["accepted"],
          allowProtected: false,
          requireAcceptedConsent: true,
          requireAcceptedPrivacy: true,
          requireAcceptedReview: true,
        },
        partitionPolicy: policy,
        requestedStatus: "draft",
        maximumExamples: 10,
        knownLimitations: [],
        reviewerStatus: "unknown",
      },
      source,
      async () => [await example("from-source")],
    );
    expect(r.examples).toHaveLength(1);
    expect(calls).toBe(1);
  });
  it("rejects write-capable source shapes", async () => {
    const c = new DatasetCompiler();
    const source = {
      async getSource() {
        return null;
      },
      async listSources() {
        return [];
      },
      async putSource() {},
    };
    await expect(
      c.compileFromSource(
        {
          requestId: "r",
          datasetId: "d",
          datasetVersion: "1",
          domainId: "keep-the-signal",
          maximumSourceRecords: 1,
          sourcePolicy: {
            permittedDomains: ["keep-the-signal"],
            permittedClassifications: ["accepted"],
            allowProtected: false,
            requireAcceptedConsent: true,
            requireAcceptedPrivacy: true,
            requireAcceptedReview: true,
          },
          partitionPolicy: policy,
          requestedStatus: "draft",
          maximumExamples: 10,
          knownLimitations: [],
          reviewerStatus: "unknown",
        },
        source as never,
        async () => [],
      ),
    ).rejects.toMatchObject({ code: "source_policy_prohibited" });
  });
  it("skips ineligible sources", async () => {
    const record = await createTrainingSource({
      sourceId: "source",
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
    const source = {
      async getSource() {
        return record;
      },
      async listSources() {
        return [record];
      },
    };
    const c = new DatasetCompiler();
    const r = await c.compileFromSource(
      {
        requestId: "r",
        datasetId: "d",
        datasetVersion: "1",
        domainId: "keep-the-signal",
        maximumSourceRecords: 1,
        sourcePolicy: {
          permittedDomains: ["keep-the-signal"],
          permittedClassifications: ["accepted"],
          allowProtected: false,
          requireAcceptedConsent: true,
          requireAcceptedPrivacy: true,
          requireAcceptedReview: true,
        },
        partitionPolicy: policy,
        requestedStatus: "draft",
        maximumExamples: 10,
        knownLimitations: [],
        reviewerStatus: "unknown",
      },
      source,
      async () => [await example("blocked")],
    );
    expect(r.examples).toHaveLength(0);
    expect(r.sourceEligibilityReports?.[0]?.outcome).toBe("ineligible");
  });
  it("rejects source budget overflow", async () => {
    const c = new DatasetCompiler();
    const source = {
      async getSource() {
        return null;
      },
      async listSources() {
        return [null, null] as never;
      },
    };
    await expect(
      c.compileFromSource(
        {
          requestId: "r",
          datasetId: "d",
          datasetVersion: "1",
          domainId: "keep-the-signal",
          maximumSourceRecords: 1,
          sourcePolicy: {
            permittedDomains: ["keep-the-signal"],
            permittedClassifications: ["accepted"],
            allowProtected: false,
            requireAcceptedConsent: true,
            requireAcceptedPrivacy: true,
            requireAcceptedReview: true,
          },
          partitionPolicy: policy,
          requestedStatus: "draft",
          maximumExamples: 10,
          knownLimitations: [],
          reviewerStatus: "unknown",
        },
        source,
        async () => [],
      ),
    ).rejects.toMatchObject({ code: "invalid_training_source" });
  });
});
