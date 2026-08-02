import {
  ABSENT_EVALUATION_AUTHORITY,
  digestCanonical,
  immutableCopy,
  sortText,
  type BaselineOutcome,
} from "./evaluation-contract";
import type { ParsedResponse } from "./output-parser";
import type { RawResponseEnvelope } from "./response-contract";
import type { ValidatorEvidence } from "./validator-bridge";

export type BaselineRunEvidence = Readonly<{
  runId: string;
  caseId: string;
  candidateIdentity: string;
  artifactId: string;
  runtimeId: string;
  response: RawResponseEnvelope;
  parsed: ParsedResponse;
  validator: ValidatorEvidence;
  outcome: BaselineOutcome;
  reasonCodes: readonly string[];
  limitations: readonly string[];
  authority: typeof ABSENT_EVALUATION_AUTHORITY;
  runDigest: string;
}>;

export function createBaselineRun(
  input: Omit<BaselineRunEvidence, "outcome" | "reasonCodes" | "authority" | "runDigest">,
): BaselineRunEvidence {
  let outcome: BaselineOutcome = "unknown";
  const reasons = [...input.parsed.reasonCodes, ...input.validator.reasonCodes];

  if (input.parsed.state === "cancelled") outcome = "cancelled";
  else if (input.parsed.state === "timed_out") outcome = "timed_out";
  else if (input.parsed.state === "runtime_failed") outcome = "runtime_failed";
  else if (input.parsed.state !== "parsed") outcome = "schema_rejected";
  else if (input.validator.decision === "rejected") outcome = "validator_rejected";
  else if (input.validator.decision === "accepted") {
    outcome =
      input.parsed.object?.kind === "abstain"
        ? input.validator.abstentionCorrect === true
          ? "abstained_correctly"
          : "abstained_incorrectly"
        : "passed";
  }

  const core = {
    ...input,
    outcome,
    reasonCodes: sortText(reasons),
    limitations: sortText(input.limitations),
    authority: ABSENT_EVALUATION_AUTHORITY,
  };
  return immutableCopy({
    ...core,
    runDigest: digestCanonical(core),
  }) as BaselineRunEvidence;
}
