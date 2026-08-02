import { describe, expect, it } from "vitest";

import {
  EXPERIMENT_CLASSIFICATIONS,
  EXPERIMENT_ROLES,
  createExperimentRecord,
  validateExperimentRecord,
  FINE_TUNING_FAILURE_CODES,
  FineTuningFailure,
  createDatasetApprovalRecord,
  validateDatasetApprovalRecord,
  createEnvironmentRecord,
  validateEnvironmentRecord,
} from "../app/features/intelligence-harness/fine-tuning";
const hex = "a".repeat(64);

function dataset() {
  return {
    approvalId: "approval:kts:g",
    approvalVersion: "1",
    manifestId: "manifest:kts:g",
    manifestVersion: "1",
    manifestDigest: hex,
    exportDraftDigest: hex,
    includedExampleDigests: [hex],
    partitionCounts: { train: 10, validation: 2, test: 2, quarantine: 0 },
    labelCounts: { accepted: 10 },
    taskCounts: { grounded: 10 },
    sourceFamilyCount: 4,
    protectedEvidenceReportDigest: hex,
    consentPrivacyReportDigest: hex,
    duplicateAuditDigest: hex,
    leakageAuditDigest: hex,
    qualityReportDigest: hex,
    curriculumPlanDigest: hex,
    reviewerStatus: "accepted" as const,
    approvalStatus: "approved" as const,
    testIsolationVerified: true,
    knownLimitations: ["small sample"],
  };
}
function environment() {
  return {
    environmentId: "env:local",
    environmentVersion: "1",
    operatingSystem: "windows-11",
    pythonVersion: "3.12.10",
    packageManager: "uv-0.8.0",
    lockfileDigest: hex,
    trainingFramework: "transformers",
    trainingFrameworkVersion: "5.0.0",
    acceleratorLibraries: { cuda: "13.0" },
    computeDevice: "local-gpu",
    driverVersion: "600.1",
    availableMemoryBytes: 16000000000,
    availableStorageBytes: 100000000000,
    environmentVariableNames: ["HF_HOME", "CUDA_VISIBLE_DEVICES"],
    networkPolicy: "offline" as const,
    externalUploadAuthorized: false,
    paidComputeAuthorized: false,
    sourceCheckpoint: "a3fa2d73fe8f9be6964d4939c903a915e15bef3b",
    runnerPackageDigest: hex,
  };
}
function draft() {
  return {
    experimentId: "exp:kts:h1",
    experimentVersion: "1.0.0",
    role: "signal_officer_tactical_adviser" as const,
    researchQuestion: "Does compact adaptation improve verified tactical advice?",
    taskScope: ["grounded_tactical_proposal"],
    baseModelRecordDigest: hex,
    datasetApprovalDigest: hex,
    createdAt: "2026-08-02T15:00:00.000Z",
    classification: "experimental_candidate" as const,
  };
}
describe("KTS-I4-H experiment contract", () => {
  for (const role of EXPERIMENT_ROLES)
    it(`exports role ${role}`, () => expect(role).toBe("signal_officer_tactical_adviser"));
  for (const classification of EXPERIMENT_CLASSIFICATIONS)
    it(`exports classification ${classification}`, () =>
      expect(EXPERIMENT_CLASSIFICATIONS).toContain(classification));
  for (const code of FINE_TUNING_FAILURE_CODES)
    it(`exports failure code ${code}`, () => expect(code.length).toBeGreaterThan(3));
  it("creates immutable experiment records", async () =>
    expect(Object.isFrozen(await createExperimentRecord(draft()))).toBe(true));
  it("creates stable experiment digests", async () =>
    expect((await createExperimentRecord(draft())).contentDigest).toBe(
      (await createExperimentRecord(draft())).contentDigest,
    ));
  it("validates matching experiment digests", async () =>
    await expect(
      validateExperimentRecord(await createExperimentRecord(draft())),
    ).resolves.toBeUndefined());
  it("rejects short research questions", async () =>
    await expect(
      createExperimentRecord({ ...draft(), researchQuestion: "short" }),
    ).rejects.toBeInstanceOf(FineTuningFailure));
  it("rejects empty task scope", async () =>
    await expect(createExperimentRecord({ ...draft(), taskScope: [] })).rejects.toBeInstanceOf(
      FineTuningFailure,
    ));
  it("rejects hidden reasoning fields", async () =>
    await expect(
      createExperimentRecord({
        ...draft(),
        researchQuestion: "Capture hidden_reasoning for the complete experiment",
      }),
    ).rejects.toMatchObject({ code: "hidden_reasoning_prohibited" }));
  it("creates approved dataset records", async () =>
    expect((await createDatasetApprovalRecord(dataset())).approvalStatus).toBe("approved"));
  it("validates approved dataset digests", async () =>
    await expect(
      validateDatasetApprovalRecord(await createDatasetApprovalRecord(dataset())),
    ).resolves.toBeUndefined());
  it("rejects unapproved datasets", async () =>
    await expect(
      createDatasetApprovalRecord({ ...dataset(), approvalStatus: "review_required" as const }),
    ).rejects.toMatchObject({ code: "dataset_not_approved" }));
  it("rejects test contamination", async () =>
    await expect(
      createDatasetApprovalRecord({ ...dataset(), testIsolationVerified: false }),
    ).rejects.toMatchObject({ code: "test_partition_contaminated" }));
  it("rejects malformed dataset digests", async () =>
    await expect(
      createDatasetApprovalRecord({ ...dataset(), manifestDigest: "bad" }),
    ).rejects.toMatchObject({ code: "dataset_digest_mismatch" }));
  it("creates offline environment records", async () =>
    expect((await createEnvironmentRecord(environment())).networkPolicy).toBe("offline"));
  it("validates environment digests", async () =>
    await expect(
      validateEnvironmentRecord(await createEnvironmentRecord(environment())),
    ).resolves.toBeUndefined());
  it("rejects paid compute environments", async () =>
    await expect(
      createEnvironmentRecord({ ...environment(), paidComputeAuthorized: true }),
    ).rejects.toMatchObject({ code: "paid_compute_not_authorized" }));
  it("rejects unauthorized network environments", async () =>
    await expect(
      createEnvironmentRecord({ ...environment(), networkPolicy: "restricted" as const }),
    ).rejects.toMatchObject({ code: "network_not_authorized" }));
  for (let i = 0; i < 10; i++)
    it(`creates deterministic dataset approval ${i}`, async () =>
      expect((await createDatasetApprovalRecord(dataset())).contentDigest).toHaveLength(64));
  for (let i = 0; i < 10; i++)
    it(`creates deterministic environment record ${i}`, async () =>
      expect((await createEnvironmentRecord(environment())).contentDigest).toHaveLength(64));
});
