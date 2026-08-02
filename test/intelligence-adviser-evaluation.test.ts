import { describe, expect, it } from "vitest";

import {
  aggregateEvaluationCases,
  compareMatchedEvaluationCases,
  evaluationMatches,
} from "../app/features/intelligence-harness/tactical-adviser/evaluation-aggregator";
import {
  ADVISER_EVALUATION_CLASSIFICATIONS,
  ADVISER_METRIC_NAMES,
  createEvaluationCase,
  type AdviserEvaluationCase,
  type AdviserMetricName,
} from "../app/features/intelligence-harness/tactical-adviser/evaluation-contract";

function evaluationCase(overrides: Partial<AdviserEvaluationCase> = {}): AdviserEvaluationCase {
  return {
    caseId: "case:one",
    match: {
      seedOrEpisodeFamily: "seed:42",
      engineVersion: "engine:1",
      rulesetVersion: "rules:1",
      observationSchemaId: "kts.observation",
      observationSchemaVersion: "1",
      observationLevel: 1,
      decisionPoint: "tick:100",
      partitionId: "partition:test",
    },
    observationId: "observation:one",
    adviserClassification: "rule_based",
    proposerIdentity: { baselineId: "baseline:one" },
    strategyReferences: [{ strategyId: "strategy:one", strategyVersion: "1" }],
    retrievalEnabled: false,
    proposal: { confidenceBasisPoints: 7_500, intent: "hold" },
    proposalValidation: "advisory_valid",
    metricValues: {
      schema_compliance: 1,
      advisory_valid: 1,
      abstained: 0,
      labelled_success: 1,
      score: 100,
    },
    evaluatorId: "evaluator:test",
    evaluatorVersion: "1",
    ...overrides,
  };
}

function expectEvaluationInvalid(value: unknown): void {
  try {
    createEvaluationCase(value as AdviserEvaluationCase);
  } catch (error) {
    expect(error).toMatchObject({
      failure: { code: "evaluation_invalid", stage: "evaluation" },
    });
    return;
  }
  throw new Error("Expected evaluation_invalid.");
}

describe("KTS-I4-E adviser evaluation", () => {
  it.each(ADVISER_EVALUATION_CLASSIFICATIONS)(
    "accepts the %s adviser classification",
    (adviserClassification) => {
      expect(
        createEvaluationCase(evaluationCase({ adviserClassification })).adviserClassification,
      ).toBe(adviserClassification);
    },
  );

  it("accepts the deliberate not_applicable proposal-validation value", () => {
    expect(
      createEvaluationCase(evaluationCase({ proposalValidation: "not_applicable" }))
        .proposalValidation,
    ).toBe("not_applicable");
  });

  it("rejects an unsupported proposal-validation classification", () => {
    expectEvaluationInvalid(
      evaluationCase({
        proposalValidation: "accepted" as AdviserEvaluationCase["proposalValidation"],
      }),
    );
  });

  it.each([null, [], "metrics"])(
    "maps malformed metricValues %j to evaluation_invalid",
    (value) => {
      expectEvaluationInvalid(evaluationCase({ metricValues: value as never }));
    },
  );

  it.each([null, {}, "strategies"])(
    "maps malformed strategyReferences %j to evaluation_invalid",
    (value) => {
      expectEvaluationInvalid(evaluationCase({ strategyReferences: value as never }));
    },
  );

  it.each([
    [{ strategyId: "strategy:one" }],
    [{ strategyId: "strategy:one", strategyVersion: "1", hiddenRank: 1 }],
    [null],
  ])("rejects malformed or non-exact strategy-reference shape %#", (strategyReferences) => {
    expectEvaluationInvalid(evaluationCase({ strategyReferences: strategyReferences as never }));
  });

  it.each([
    ["proposal", undefined],
    ["proposal", () => "not-json"],
    ["authoritativeDecisionEvidence", 1n],
    ["authoritativeOutcomeEvidence", new Date("2026-08-01T00:00:00.000Z")],
  ] as const)("maps non-JSON %s input to evaluation_invalid", (field, invalidValue) => {
    expectEvaluationInvalid(evaluationCase({ [field]: invalidValue } as never));
  });

  it.each(ADVISER_METRIC_NAMES)("aggregates the supplied %s metric", (metric) => {
    const entry = evaluationCase({ metricValues: { [metric]: 2 } });
    const report = aggregateEvaluationCases([entry], { maximumCases: 1 });
    expect(report.metrics.find((summary) => summary.metric === metric)).toMatchObject({
      knownCount: 1,
      mean: 2,
    });
  });

  it("counts every adviser classification independently", () => {
    const cases = ADVISER_EVALUATION_CLASSIFICATIONS.map((adviserClassification, index) =>
      evaluationCase({ caseId: `case:${index}`, adviserClassification }),
    );
    const report = aggregateEvaluationCases(cases, { maximumCases: cases.length });
    expect(Object.values(report.classificationCounts).every((count) => count === 1)).toBe(true);
  });

  it("calculates schema-compliance basis points from labelled cases", () => {
    const report = aggregateEvaluationCases(
      [
        evaluationCase(),
        evaluationCase({ caseId: "case:two", metricValues: { schema_compliance: 0 } }),
      ],
      { maximumCases: 2 },
    );
    expect(report.schemaComplianceBasisPoints).toBe(5_000);
  });

  it("calculates advisory-valid basis points", () => {
    expect(
      aggregateEvaluationCases([evaluationCase()], { maximumCases: 1 }).advisoryValidBasisPoints,
    ).toBe(10_000);
  });

  it("calculates abstention basis points", () => {
    const report = aggregateEvaluationCases([evaluationCase({ metricValues: { abstained: 1 } })], {
      maximumCases: 1,
    });
    expect(report.abstentionBasisPoints).toBe(10_000);
  });

  it("keeps an entirely unknown metric unknown", () => {
    const report = aggregateEvaluationCases([evaluationCase({ metricValues: {} })], {
      maximumCases: 1,
    });
    expect(report.metrics.find(({ metric }) => metric === "score")?.mean).toBeNull();
  });

  it("does not invent missing authoritative outcomes", () => {
    const record = createEvaluationCase(evaluationCase({ metricValues: {} }));
    expect(record.authoritativeOutcomeEvidence).toBeUndefined();
  });

  it("calculates confidence calibration only from labelled outcomes", () => {
    const report = aggregateEvaluationCases([evaluationCase()], { maximumCases: 1 });
    expect(report.confidenceCalibrationMeanAbsoluteError).toBe(2_500);
  });

  it("leaves confidence calibration unknown without labels", () => {
    const report = aggregateEvaluationCases([evaluationCase({ metricValues: { score: 10 } })], {
      maximumCases: 1,
    });
    expect(report.confidenceCalibrationMeanAbsoluteError).toBeNull();
  });

  it("compares compatible matched cases descriptively", () => {
    const difference = compareMatchedEvaluationCases(
      evaluationCase({ metricValues: { score: 10 } }),
      evaluationCase({ caseId: "case:two", metricValues: { score: 15 } }),
    );
    expect(difference.metricDifferences.score).toBe(5);
    expect(difference.interpretation).toBe("descriptive_only");
  });

  it("keeps a descriptive difference unknown when either metric is absent", () => {
    const difference = compareMatchedEvaluationCases(
      evaluationCase({ metricValues: {} }),
      evaluationCase({ caseId: "case:two", metricValues: { score: 15 } }),
    );
    expect(difference.metricDifferences.score).toBeNull();
  });

  it.each([
    ["seedOrEpisodeFamily", "seed:other"],
    ["engineVersion", "engine:2"],
    ["rulesetVersion", "rules:2"],
    ["observationSchemaId", "other.observation"],
    ["observationSchemaVersion", "2"],
    ["observationLevel", 0],
    ["decisionPoint", "tick:101"],
    ["partitionId", "partition:other"],
  ] as const)("rejects a matched comparison with mismatched %s", (field, value) => {
    const left = evaluationCase();
    const right = evaluationCase({ caseId: "case:two", match: { ...left.match, [field]: value } });
    expect(() => compareMatchedEvaluationCases(left, right)).toThrow("matched");
  });

  it("reports exact match compatibility", () => {
    const entry = evaluationCase();
    expect(evaluationMatches(entry.match, { ...entry.match })).toBe(true);
  });

  it("rejects duplicate evaluation case identities", () => {
    expect(() =>
      aggregateEvaluationCases([evaluationCase(), evaluationCase()], { maximumCases: 2 }),
    ).toThrow("unique");
  });

  it("rejects a case count above its explicit budget", () => {
    expect(() =>
      aggregateEvaluationCases([evaluationCase(), evaluationCase({ caseId: "case:two" })], {
        maximumCases: 1,
      }),
    ).toThrow("budget");
  });

  it("rejects an invalid aggregation budget", () => {
    expect(() => aggregateEvaluationCases([], { maximumCases: 0 })).toThrow("budget");
  });

  it("rejects an unsupported metric name", () => {
    expect(() =>
      createEvaluationCase(
        evaluationCase({
          metricValues: { unsupported: 1 } as unknown as Record<AdviserMetricName, number>,
        }),
      ),
    ).toThrow("metric");
  });

  it("rejects a human usefulness rating above basis-point bounds", () => {
    expect(() =>
      createEvaluationCase(evaluationCase({ humanUsefulnessBasisPoints: 10_001 })),
    ).toThrow("basis points");
  });

  it("derives player usefulness only from a supplied human rating", () => {
    const report = aggregateEvaluationCases(
      [evaluationCase({ humanUsefulnessBasisPoints: 7_500, metricValues: {} })],
      { maximumCases: 1 },
    );
    expect(report.metrics.find(({ metric }) => metric === "player_usefulness")).toMatchObject({
      knownCount: 1,
      mean: 7_500,
    });
  });

  it("returns immutable cases and aggregate reports", () => {
    const entry = createEvaluationCase(evaluationCase());
    const report = aggregateEvaluationCases([entry], { maximumCases: 1 });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.metrics)).toBe(true);
  });

  it("does not mutate evaluation cases during aggregation", () => {
    const cases = [evaluationCase()];
    const before = JSON.stringify(cases);
    aggregateEvaluationCases(cases, { maximumCases: 1 });
    expect(JSON.stringify(cases)).toBe(before);
  });

  it("aggregates 10,000 bounded evaluation cases", () => {
    const cases = Array.from({ length: 10_000 }, (_, index) =>
      evaluationCase({ caseId: `case:${index}`, metricValues: { score: index } }),
    );
    const report = aggregateEvaluationCases(cases, { maximumCases: 10_000 });
    expect(report.caseCount).toBe(10_000);
    expect(report.metrics.find(({ metric }) => metric === "score")?.knownCount).toBe(10_000);
  });
});
