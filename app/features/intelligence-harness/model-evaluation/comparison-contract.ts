import { digestCanonical, immutableCopy, sortText } from "./evaluation-contract";

export type ComparisonValue = number | string | boolean | "unknown" | "unsupported";

export type CandidateComparison = Readonly<{
  comparisonId: string;
  candidateIdentity: string;
  dimensions: Readonly<Record<string, ComparisonValue>>;
  limitations: readonly string[];
  comparisonDigest: string;
}>;

export function createCandidateComparison(
  input: Omit<CandidateComparison, "comparisonDigest">,
): CandidateComparison {
  if (Object.keys(input.dimensions).length > 64) {
    throw new Error("comparison dimension budget exceeded");
  }
  const core = {
    ...input,
    dimensions: Object.fromEntries(
      Object.entries(input.dimensions).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ),
    limitations: sortText(input.limitations),
  };
  return immutableCopy({
    ...core,
    comparisonDigest: digestCanonical(core),
  }) as CandidateComparison;
}
