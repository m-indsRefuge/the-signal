import {
  createCandidateComparison,
  recommendCandidate,
  type CandidateRecommendation,
  type ComparisonValue,
} from "../../intelligence-harness/model-evaluation";

export function rankKtsCandidate(
  candidateIdentity: string,
  dimensions: Readonly<Record<string, ComparisonValue>>,
  limitations: readonly string[] = [],
): CandidateRecommendation {
  return recommendCandidate(
    createCandidateComparison({
      comparisonId: `kts-comparison:${candidateIdentity}`,
      candidateIdentity,
      dimensions,
      limitations,
    }),
  );
}
