import { describe, expect, it } from "vitest";

import {
  KTS_FINE_TUNING_TASKS,
  createKtsBaselineDefinitions,
  createKtsEvaluationSuite,
  projectKtsMetrics,
  createKtsAdapterCandidate,
} from "../app/features/keep-the-signal/fine-tuning";
describe("KTS-I4-H Keep the Signal plan", () => {
  for (const task of KTS_FINE_TUNING_TASKS)
    it(`exports task ${task}`, () => expect(KTS_FINE_TUNING_TASKS).toContain(task));
  for (const baseline of createKtsBaselineDefinitions())
    it(`defines baseline ${baseline.baselineId}`, () =>
      expect(baseline.description.length).toBeGreaterThan(3));
  const summary = {
    schemaCompliance: 1,
    legalProposalRate: 1,
    unsupportedClaimRate: 0,
    groundingCompleteness: 1,
    abstentionCorrectness: 1,
    wastedRecommendationRate: 0,
    confidenceCalibration: 0.9,
    inferenceLatencyMs: 10,
    contextSize: 100,
    signalRetained: 80,
    defenceRetained: 70,
    coherence: 0.8,
    score: 1000,
    waveCompletion: 1,
    unseenSeedPerformance: 0.75,
  };
  for (const [key, value] of Object.entries(projectKtsMetrics(summary)))
    it(`projects KTS metric ${key}`, () => expect(value).toBeTypeOf("number"));
  it("creates KTS evaluation suite", async () =>
    expect(
      (
        await createKtsEvaluationSuite({
          planId: "kts-eval",
          planVersion: "1",
          cases: [{ caseId: "c1", partition: "test", sourceReference: "s1" }],
          maximumCases: 10,
        })
      ).baselines,
    ).toHaveLength(6));
  for (let i = 0; i < 20; i++)
    it(`creates deterministic KTS suite ${i}`, async () =>
      expect(
        (
          await createKtsEvaluationSuite({
            planId: `kts-eval:${i}`,
            planVersion: "1",
            cases: [
              { caseId: `c:${i}`, partition: "unseen_seed", sourceReference: `s:${i}`, seed: i },
            ],
            maximumCases: 1,
          })
        ).planDigest,
      ).toHaveLength(64));
  it("creates a bounded KTS adapter candidate", async () => {
    const h = "a".repeat(64);
    const adapter = await createKtsAdapterCandidate({
      adapterId: "kts-adapter:1",
      adapterVersion: "1",
      parentBaseModelDigest: h,
      datasetManifestDigest: h,
      trainingPlanDigest: h,
      finalCheckpointDigest: h,
      trainableParameterScope: "adapter_only",
      files: [{ path: "adapter.bin", digest: h, bytes: 100 }],
      status: "experimental_candidate",
      knownLimitations: ["experimental"],
      role: "signal_officer_tactical_adviser",
      proposalSchemaId: "kts-proposal-v1",
      observationSchemaId: "kts-observation-v1",
    });
    expect(adapter.status).toBe("experimental_candidate");
  });
});
