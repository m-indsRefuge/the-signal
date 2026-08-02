import { digestCanonical, immutableCopy, sortText } from "./evaluation-contract";
import type { CandidateComparison } from "./comparison-contract";

export type Recommendation =
  | "recommended_for_selection_review"
  | "recommended_with_conditions"
  | "not_recommended"
  | "insufficient_evidence";

export type CandidateRecommendation = Readonly<{
  candidateIdentity: string;
  recommendation: Recommendation;
  reasonCodes: readonly string[];
  limitations: readonly string[];
  recommendationDigest: string;
}>;

export function recommendCandidate(comparison: CandidateComparison): CandidateRecommendation {
  const dimensions = comparison.dimensions;
  const unknown = Object.values(dimensions).some(
    (value) => value === "unknown" || value === "unsupported",
  );
  const licenseApproved = dimensions.licenseAcceptability === true;
  const artifactVerified = dimensions.artifactIntegrity === true;
  const validatorRate =
    typeof dimensions.validatorAcceptanceRate === "number" ? dimensions.validatorAcceptanceRate : 0;
  const authorityCompliance = dimensions.authorityCompliance === true;

  let recommendation: Recommendation;
  const reasons: string[] = [];
  if (!licenseApproved || !artifactVerified || !authorityCompliance) {
    recommendation = "not_recommended";
    reasons.push("blocking_governance_dimension");
  } else if (unknown) {
    recommendation = "insufficient_evidence";
    reasons.push("unknown_dimension");
  } else if (validatorRate >= 0.8) {
    recommendation = "recommended_for_selection_review";
    reasons.push("validator_threshold_met");
  } else if (validatorRate >= 0.6) {
    recommendation = "recommended_with_conditions";
    reasons.push("conditional_validator_threshold");
  } else {
    recommendation = "not_recommended";
    reasons.push("validator_threshold_not_met");
  }
  const core = {
    candidateIdentity: comparison.candidateIdentity,
    recommendation,
    reasonCodes: sortText(reasons),
    limitations: comparison.limitations,
  };
  return immutableCopy({
    ...core,
    recommendationDigest: digestCanonical(core),
  }) as CandidateRecommendation;
}
