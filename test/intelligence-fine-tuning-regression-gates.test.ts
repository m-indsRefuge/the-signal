import { describe, expect, it } from "vitest";

import {
  REGRESSION_DIRECTIONS,
  evaluateRegressionGates,
  assertNoBlockingRegression,
  validateExperimentClassification,
  assertRuntimePromotionProhibited,
  FineTuningFailure,
} from "../app/features/intelligence-harness/fine-tuning";
describe("KTS-I4-H regression and promotion gates", () => {
  for (const direction of REGRESSION_DIRECTIONS)
    it(`exports regression direction ${direction}`, () =>
      expect(REGRESSION_DIRECTIONS).toContain(direction));
  for (const value of [0, 0.25, 0.5, 0.75, 1])
    it(`passes minimum threshold ${value}`, () =>
      expect(
        evaluateRegressionGates(
          [
            {
              gateId: `g${value}`,
              metricName: "legal_proposal_rate",
              direction: "minimum",
              threshold: value,
              blocking: true,
            },
          ],
          { legal_proposal_rate: value },
        )[0]?.outcome,
      ).toBe("pass"));
  for (const value of [0, 0.25, 0.5, 0.75, 1])
    it(`passes maximum threshold ${value}`, () =>
      expect(
        evaluateRegressionGates(
          [
            {
              gateId: `g${value}`,
              metricName: "unsupported_claim_rate",
              direction: "maximum",
              threshold: value,
              blocking: true,
            },
          ],
          { unsupported_claim_rate: value },
        )[0]?.outcome,
      ).toBe("pass"));
  it("reports unknown missing metrics", () =>
    expect(
      evaluateRegressionGates(
        [{ gateId: "g", metricName: "score", direction: "minimum", threshold: 1, blocking: true }],
        {},
      )[0]?.outcome,
    ).toBe("unknown"));
  it("blocks unknown blocking gates", () =>
    expect(() =>
      assertNoBlockingRegression([
        { gateId: "g", outcome: "unknown", reason: "missing", blocking: true },
      ]),
    ).toThrow(FineTuningFailure));
  it("blocks failed blocking gates", () =>
    expect(() =>
      assertNoBlockingRegression([{ gateId: "g", outcome: "fail", reason: "bad", blocking: true }]),
    ).toThrow(FineTuningFailure));
  for (const status of [
    "experimental_candidate",
    "evaluation_candidate",
    "rejected",
    "quarantined",
    "experiment_accepted",
    "superseded",
  ])
    it(`permits experiment status ${status}`, () =>
      expect(validateExperimentClassification(status)).toBe(status));
  for (const status of ["production", "deployed_model", "runtime_active", "autonomous_agent"])
    it(`prohibits promotion status ${status}`, () =>
      expect(() => validateExperimentClassification(status)).toThrow(FineTuningFailure));
  it("prohibits runtime promotion", () =>
    expect(() => assertRuntimePromotionProhibited(true)).toThrow(FineTuningFailure));
  for (let i = 0; i < 20; i++)
    it(`evaluates deterministic regression gate ${i}`, () =>
      expect(
        evaluateRegressionGates(
          [
            {
              gateId: `g:${i}`,
              metricName: "score",
              direction: "minimum",
              threshold: i,
              blocking: true,
            },
          ],
          { score: i },
        )[0]?.outcome,
      ).toBe("pass"));
});
