import { digestCanonical, immutableCopy, sortText } from "./admission-contract";

export type EligibilityState = "eligible" | "ineligible" | "deferred" | "unknown";

export type EligibilityResult = Readonly<{
  state: EligibilityState;
  reasonCodes: readonly string[];
  limitations: readonly string[];
  policyId: string;
  policyVersion: string;
  digest: string;
}>;

export function createEligibilityResult(
  input: Omit<EligibilityResult, "digest">,
): EligibilityResult {
  const normalized = {
    ...input,
    reasonCodes: sortText(input.reasonCodes),
    limitations: sortText(input.limitations),
  };
  return immutableCopy({
    ...normalized,
    digest: digestCanonical(normalized),
  }) as EligibilityResult;
}
