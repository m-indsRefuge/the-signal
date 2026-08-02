import { describe, expect, it } from "vitest";

import {
  FineTuningExperimentController,
  createTrainingPlan,
  FineTuningFailure,
} from "../app/features/intelligence-harness/fine-tuning";
const h = "a".repeat(64);
function draft(id = "plan:1") {
  return {
    planId: id,
    planVersion: "1",
    experimentId: "exp:1",
    baseModelRecordDigest: h,
    tokenizerRecordDigest: h,
    datasetApprovalDigest: h,
    environmentRecordDigest: h,
    method: {
      method: "lora" as const,
      trainableParameterScope: "adapter_only",
      targetModules: ["q"],
      adapterRank: 8,
      adapterAlpha: 16,
      quantizationBits: 16 as const,
      precision: "bf16" as const,
    },
    hyperparameters: {
      optimizer: "adamw",
      learningRate: 0.001,
      schedule: "cosine",
      maximumEpochs: 1,
      maximumSteps: 10,
      batchSize: 1,
      gradientAccumulationSteps: 1,
      gradientClipNorm: 1,
      warmupSteps: 0,
      weightDecay: 0,
      checkpointEverySteps: 5,
      maximumCheckpoints: 2,
      earlyStoppingPatience: 0,
      seed: 1,
    },
    resourceBudget: {
      maximumWallClockSeconds: 10,
      maximumOptimizerSteps: 10,
      maximumEpochs: 1,
      maximumTokens: 100,
      maximumExamples: 10,
      maximumCheckpoints: 2,
      maximumDiskBytes: 100,
      maximumRamBytes: 100,
      maximumAcceleratorMemoryBytes: 100,
      maximumCpuThreads: 1,
      maximumGpuCount: 1,
      maximumEvaluationCases: 10,
      maximumOutputBytes: 100,
      maximumExternalCostMinorUnits: 0,
    },
    seedSet: [1],
    outputDirectory: "experiments/h",
    loggingPolicy: "metrics_only" as const,
    evaluationSchedule: [5, 10],
    stopConditions: ["budget"],
    failureRollbackProcedure: "Stop and preserve evidence.",
    networkPolicy: "offline" as const,
    externalUploadPolicy: "prohibited" as const,
    costCeilingMinorUnits: 0 as const,
    createdAt: "2026-08-02T15:00:00.000Z",
  };
}
describe("KTS-I4-H experiment controller", () => {
  it("registers validated plans", async () => {
    const c = new FineTuningExperimentController();
    expect((await c.registerValidatedPlan(await createTrainingPlan(draft()))).state).toBe(
      "validated",
    );
  });
  it("records exact authorization", async () => {
    const c = new FineTuningExperimentController(),
      p = await createTrainingPlan(draft());
    await c.registerValidatedPlan(p);
    expect((await c.recordOperatorAuthorization(p.planDigest)).state).toBe("authorized");
  });
  it("rejects mismatched authorization", async () => {
    const c = new FineTuningExperimentController(),
      p = await createTrainingPlan(draft());
    await c.registerValidatedPlan(p);
    await expect(c.recordOperatorAuthorization("b".repeat(64))).rejects.toMatchObject({
      code: "training_plan_digest_mismatch",
    });
  });
  it("records external running evidence", async () => {
    const c = new FineTuningExperimentController(),
      p = await createTrainingPlan(draft());
    await c.registerValidatedPlan(p);
    await c.recordOperatorAuthorization(p.planDigest);
    expect(
      (
        await c.recordExternalLifecycle({
          planDigest: p.planDigest,
          state: "running",
          reason: "external runner reported start",
          sequence: 3,
        })
      ).state,
    ).toBe("running");
  });
  it("does not expose an execution method", () => {
    const c = new FineTuningExperimentController() as unknown as Record<string, unknown>;
    expect(c.train).toBeUndefined();
    expect(c.fineTune).toBeUndefined();
    expect(c.invokeModel).toBeUndefined();
  });
  it("rejects work after disposal", async () => {
    const c = new FineTuningExperimentController();
    c.dispose();
    await expect(c.registerValidatedPlan(await createTrainingPlan(draft()))).rejects.toBeInstanceOf(
      FineTuningFailure,
    );
  });
  for (let i = 0; i < 30; i++)
    it(`keeps independent controller ${i}`, async () => {
      const c = new FineTuningExperimentController(),
        p = await createTrainingPlan(draft(`plan:${i}`));
      expect((await c.registerValidatedPlan(p)).runId).toBe(`run:plan:${i}`);
    });
  it("supports 100 independent concurrent controllers", async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, async (_, i) => {
        const c = new FineTuningExperimentController();
        const p = await createTrainingPlan(draft(`concurrent-plan:${i}`));
        return c.registerValidatedPlan(p);
      }),
    );
    expect(results).toHaveLength(100);
    expect(new Set(results.map((r) => r.runId)).size).toBe(100);
  });
});
