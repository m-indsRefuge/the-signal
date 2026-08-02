import { DEMONSTRATION_MAXIMA, requireDigest, requireIdentity } from "./demonstration-contract";
import { freezeDeep } from "./evidence-digest";
import { failDemonstration } from "./failures";

export const RECONSTRUCTION_OUTCOMES = ["pass", "fail", "unknown"] as const;
export type ReconstructionOutcome = (typeof RECONSTRUCTION_OUTCOMES)[number];

export interface ReconstructionDependencies {
  readonly sourceLineageDigest: string | null;
  readonly observationDigest: string | null;
  readonly legalActionSetDigest: string | null;
  readonly plannerRequestDigest: string | null;
  readonly plannerResultDigest: string | null;
  readonly selectedPlanDigest: string | null;
  readonly proposalDigest: string | null;
  readonly validatorResultDigest: string | null;
  readonly evidenceRecordDigest: string | null;
}

export interface ReconstructionRequest {
  readonly requestId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly maximumMismatchReasons: number;
  readonly dependencies: ReconstructionDependencies;
}

export interface ReconstructionResult {
  readonly requestId: string;
  readonly sourceIdentityMatch: boolean | null;
  readonly observationDigestMatch: boolean | null;
  readonly legalActionSetDigestMatch: boolean | null;
  readonly plannerRequestDigestMatch: boolean | null;
  readonly plannerResultDigestMatch: boolean | null;
  readonly selectedPlanDigestMatch: boolean | null;
  readonly proposalDigestMatch: boolean | null;
  readonly validatorResultDigestMatch: boolean | null;
  readonly evidenceRecordDigestMatch: boolean | null;
  readonly outcome: ReconstructionOutcome;
  readonly mismatchReasons: readonly string[];
  readonly resultDigest: string;
}

export function createReconstructionRequest(input: ReconstructionRequest): ReconstructionRequest {
  const maximumMismatchReasons = input.maximumMismatchReasons;
  if (
    !Number.isSafeInteger(maximumMismatchReasons) ||
    maximumMismatchReasons <= 0 ||
    maximumMismatchReasons > DEMONSTRATION_MAXIMA.reconstructionMismatchReasons
  ) {
    return failDemonstration(
      "record_budget_exceeded",
      "Reconstruction mismatch-reason budget is invalid.",
    );
  }
  for (const [field, value] of Object.entries(input.dependencies)) {
    if (value !== null) requireDigest(value, field);
  }
  return freezeDeep({
    ...input,
    requestId: requireIdentity(input.requestId, "requestId"),
    policyId: requireIdentity(input.policyId, "policyId"),
    policyVersion: requireIdentity(input.policyVersion, "policyVersion"),
    maximumMismatchReasons,
  });
}
