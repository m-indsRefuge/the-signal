import { digestCanonical, immutableCopy, requireIdentity, sortText } from "./evaluation-contract";

export type BaselineExpectation =
  "proposal" | "abstention" | "rejection" | "schema_rejection" | "runtime_failure" | "cancellation";

export type BaselineCase = Readonly<{
  caseId: string;
  caseVersion: string;
  category: string;
  observation: unknown;
  legalActions: readonly unknown[];
  untrustedText: string;
  expectation: BaselineExpectation;
  requiredReasonCodes: readonly string[];
  limitations: readonly string[];
  caseDigest: string;
}>;

export function createBaselineCase(input: Omit<BaselineCase, "caseDigest">): BaselineCase {
  requireIdentity(input.caseId, "caseId");
  requireIdentity(input.caseVersion, "caseVersion");
  requireIdentity(input.category, "category");
  const core = {
    ...input,
    legalActions: [...input.legalActions],
    requiredReasonCodes: sortText(input.requiredReasonCodes),
    limitations: sortText(input.limitations),
  };
  return immutableCopy({
    ...core,
    caseDigest: digestCanonical(core),
  }) as BaselineCase;
}
