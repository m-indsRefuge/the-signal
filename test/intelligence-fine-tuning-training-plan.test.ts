import { describe, expect, it } from "vitest";

import {
  TRAINING_METHODS,
  createTrainingPlan,
  validateTrainingPlan,
  validateTrainingMethodConfiguration,
  validateHyperparameterConfiguration,
  FineTuningFailure,
  createArtifactLineage,
} from "../app/features/intelligence-harness/fine-tuning";
const h = "a".repeat(64);
function method(kind: "supervised_fine_tuning" | "lora" | "qlora" = "lora") {
  return {
    method: kind,
    trainableParameterScope: "adapter_only",
    targetModules: ["q_proj", "v_proj"],
    adapterRank: 8,
    adapterAlpha: 16,
    quantizationBits: kind === "qlora" ? 4 : (16 as 4 | 16),
    precision: "bf16" as const,
  };
}
function hyper() {
  return {
    optimizer: "adamw",
    learningRate: 0.0002,
    schedule: "cosine",
    maximumEpochs: 3,
    maximumSteps: 100,
    batchSize: 2,
    gradientAccumulationSteps: 8,
    gradientClipNorm: 1,
    warmupSteps: 5,
    weightDecay: 0.01,
    checkpointEverySteps: 25,
    maximumCheckpoints: 3,
    earlyStoppingPatience: 2,
    seed: 87,
  };
}
function budget() {
  return {
    maximumWallClockSeconds: 3600,
    maximumOptimizerSteps: 100,
    maximumEpochs: 3,
    maximumTokens: 100000,
    maximumExamples: 10000,
    maximumCheckpoints: 3,
    maximumDiskBytes: 1000000000,
    maximumRamBytes: 16000000000,
    maximumAcceleratorMemoryBytes: 12000000000,
    maximumCpuThreads: 16,
    maximumGpuCount: 1,
    maximumEvaluationCases: 1000,
    maximumOutputBytes: 1000000000,
    maximumExternalCostMinorUnits: 0,
  };
}
function draft() {
  return {
    planId: "kts-h-plan",
    planVersion: "1.0.0",
    experimentId: "exp:kts:h1",
    baseModelRecordDigest: h,
    tokenizerRecordDigest: h,
    datasetApprovalDigest: h,
    environmentRecordDigest: h,
    method: method(),
    hyperparameters: hyper(),
    resourceBudget: budget(),
    seedSet: [87, 1],
    outputDirectory: "experiments/kts-h1",
    loggingPolicy: "metrics_only" as const,
    evaluationSchedule: [25, 50, 100],
    stopConditions: ["budget breach", "blocking regression"],
    failureRollbackProcedure: "Preserve evidence and stop safely.",
    networkPolicy: "offline" as const,
    externalUploadPolicy: "prohibited" as const,
    costCeilingMinorUnits: 0 as const,
    createdAt: "2026-08-02T15:00:00.000Z",
  };
}
describe("KTS-I4-H training plan", () => {
  for (const kind of TRAINING_METHODS)
    it(`exports method ${kind}`, () => expect(TRAINING_METHODS).toContain(kind));
  for (const kind of TRAINING_METHODS)
    it(`validates method ${kind}`, () =>
      expect(validateTrainingMethodConfiguration(method(kind))).toMatchObject({ method: kind }));
  for (const lr of [0.1, 0.01, 0.001, 0.0002, 0.00001])
    it(`accepts learning rate ${lr}`, () =>
      expect(
        validateHyperparameterConfiguration({ ...hyper(), learningRate: lr }).learningRate,
      ).toBe(lr));
  for (const seed of [0, 1, 42, 87, 2147483647])
    it(`accepts seed ${seed}`, () =>
      expect(validateHyperparameterConfiguration({ ...hyper(), seed }).seed).toBe(seed));
  it("creates immutable plans", async () =>
    expect(Object.isFrozen(await createTrainingPlan(draft()))).toBe(true));
  it("sorts and deduplicates seed set", async () =>
    expect((await createTrainingPlan({ ...draft(), seedSet: [87, 1, 87] })).seedSet).toEqual([
      1, 87,
    ]));
  it("creates stable plan digests", async () =>
    expect((await createTrainingPlan(draft())).planDigest).toBe(
      (await createTrainingPlan(draft())).planDigest,
    ));
  it("validates matching plan digests", async () =>
    await expect(validateTrainingPlan(await createTrainingPlan(draft()))).resolves.toBeUndefined());
  it("rejects nonzero cost ceilings", async () =>
    await expect(
      createTrainingPlan({ ...draft(), costCeilingMinorUnits: 1 as 0 }),
    ).rejects.toBeInstanceOf(FineTuningFailure));
  it("rejects nonoffline policy", async () =>
    await expect(
      createTrainingPlan({ ...draft(), networkPolicy: "restricted" as "offline" }),
    ).rejects.toBeInstanceOf(FineTuningFailure));
  for (let i = 0; i < 25; i++)
    it(`reconstructs deterministic plan ${i}`, async () =>
      expect((await createTrainingPlan(draft())).planDigest).toHaveLength(64));
  it("creates complete adapter lineage", async () =>
    expect(
      (
        await createArtifactLineage({
          lineageId: "lineage:1",
          artifactKind: "adapter",
          baseModelDigest: h,
          tokenizerDigest: h,
          datasetApprovalDigest: h,
          trainingPlanDigest: h,
          sourceCodeCheckpoint: "a3fa2d73fe8f9be6964d4939c903a915e15bef3b",
          environmentDigest: h,
        })
      ).lineageDigest,
    ).toHaveLength(64));
  it("rejects incomplete lineage", async () =>
    await expect(
      createArtifactLineage({
        lineageId: "lineage:1",
        artifactKind: "adapter",
        baseModelDigest: "bad",
        tokenizerDigest: h,
        datasetApprovalDigest: h,
        trainingPlanDigest: h,
        sourceCodeCheckpoint: "a3fa2d73fe8f9be6964d4939c903a915e15bef3b",
        environmentDigest: h,
      }),
    ).rejects.toMatchObject({ code: "adapter_lineage_incomplete" }));
  it("supports 10000 immutable plan constructions", async () => {
    const plans = await Promise.all(
      Array.from({ length: 10000 }, (_, i) =>
        createTrainingPlan({ ...draft(), planId: `kts-h-plan-${i}` }),
      ),
    );
    expect(plans).toHaveLength(10000);
    expect(plans[9999]?.planDigest).toHaveLength(64);
  });
});
