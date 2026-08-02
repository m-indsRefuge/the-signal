import { describe, expect, it } from "vitest";

import {
  EVALUATION_PARTITIONS,
  BASELINE_KINDS,
  REQUIRED_METRICS,
  createEvaluationPlan,
  createMetricObservation,
  compareAgainstBaseline,
} from "../app/features/intelligence-harness/fine-tuning";
describe("KTS-I4-H evaluation", () => {
  for (const partition of EVALUATION_PARTITIONS)
    it(`exports evaluation partition ${partition}`, () =>
      expect(EVALUATION_PARTITIONS).toContain(partition));
  for (const baseline of BASELINE_KINDS)
    it(`exports baseline ${baseline}`, () => expect(BASELINE_KINDS).toContain(baseline));
  for (const metricName of REQUIRED_METRICS)
    it(`exports metric ${metricName}`, () => expect(REQUIRED_METRICS).toContain(metricName));
  it("creates immutable evaluation plans", async () =>
    expect(
      Object.isFrozen(
        await createEvaluationPlan({
          planId: "eval:1",
          planVersion: "1",
          baselines: ["no_adviser", "rule_based_adviser"],
          cases: [{ caseId: "c1", partition: "test", sourceReference: "source:1" }],
          requiredMetricNames: REQUIRED_METRICS,
          maximumCases: 10,
        }),
      ),
    ).toBe(true));
  for (const metricName of REQUIRED_METRICS)
    it(`creates metric observation ${metricName}`, async () =>
      expect(
        (
          await createMetricObservation({
            metricId: `m:${metricName}`,
            metricName,
            value: 1,
            sampleCount: 1,
            partition: "test",
            caseReference: "case:1",
          })
        ).metricName,
      ).toBe(metricName));
  it("compares baseline values", () =>
    expect(
      compareAgainstBaseline(
        "candidate",
        { legal_proposal_rate: 0.9 },
        { baselineId: "rule", values: { legal_proposal_rate: 0.8 } },
        ["legal_proposal_rate"],
      ).deltas[0]?.delta,
    ).toBeCloseTo(0.1));
  for (let i = 0; i < 20; i++)
    it(`creates deterministic evaluation plan ${i}`, async () =>
      expect(
        (
          await createEvaluationPlan({
            planId: `eval:${i}`,
            planVersion: "1",
            baselines: ["no_adviser", "rule_based_adviser"],
            cases: [
              { caseId: `c:${i}`, partition: "unseen_seed", sourceReference: `s:${i}`, seed: i },
            ],
            requiredMetricNames: ["score"],
            maximumCases: 1,
          })
        ).planDigest,
      ).toHaveLength(64));
  it("supports 10000 metric observations", async () => {
    const metrics = await Promise.all(
      Array.from({ length: 10000 }, (_, i) =>
        createMetricObservation({
          metricId: `m:${i}`,
          metricName: "score",
          value: i,
          sampleCount: 1,
          partition: "test",
          caseReference: `case:${i}`,
        }),
      ),
    );
    expect(metrics).toHaveLength(10000);
    expect(metrics[9999]?.contentDigest).toHaveLength(64);
  });
  it("supports a 10000-case evaluation plan", async () => {
    const cases = Array.from({ length: 10000 }, (_, i) => ({
      caseId: `case:${i}`,
      partition: "unseen_seed" as const,
      sourceReference: `source:${i}`,
      seed: i,
    }));
    const plan = await createEvaluationPlan({
      planId: "eval:scale",
      planVersion: "1",
      baselines: ["no_adviser", "rule_based_adviser"],
      cases,
      requiredMetricNames: REQUIRED_METRICS,
      maximumCases: 10000,
    });
    expect(plan.cases).toHaveLength(10000);
  });
});
