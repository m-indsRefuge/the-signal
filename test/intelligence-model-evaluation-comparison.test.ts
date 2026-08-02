import { describe, expect, it } from "vitest";
import {
  createCandidateComparison,
  recommendCandidate,
} from "../app/features/intelligence-harness/model-evaluation";

describe("candidate comparison and ranking", () => {
  it("recommends strong governed evidence for review", () => {
    const comparison = createCandidateComparison({
      comparisonId: "comparison",
      candidateIdentity: "example/model@abc",
      dimensions: {
        licenseAcceptability: true,
        artifactIntegrity: true,
        authorityCompliance: true,
        validatorAcceptanceRate: 0.9,
      },
      limitations: [],
    });
    expect(recommendCandidate(comparison).recommendation).toBe("recommended_for_selection_review");
  });
  it("rejects blocking governance dimension", () => {
    const comparison = createCandidateComparison({
      comparisonId: "comparison",
      candidateIdentity: "example/model@abc",
      dimensions: {
        licenseAcceptability: false,
        artifactIntegrity: true,
        authorityCompliance: true,
        validatorAcceptanceRate: 1,
      },
      limitations: [],
    });
    expect(recommendCandidate(comparison).recommendation).toBe("not_recommended");
  });
  for (let index = 0; index < 56; index += 1) {
    it(`preserves independent dimensions ${index}`, () => {
      const comparison = createCandidateComparison({
        comparisonId: `comparison-${index}`,
        candidateIdentity: `example/model@${index}`,
        dimensions: { latency: index, memory: index + 1 },
        limitations: [],
      });
      expect(Object.keys(comparison.dimensions)).toHaveLength(2);
    });
  }
});
