import type { DemonstrationEvidenceRecord } from "./evidence-record";
import { evidenceDigest, freezeDeep } from "./evidence-digest";
import type { ReconstructionRequest, ReconstructionResult } from "./reconstruction-contract";

export function evaluateReconstruction(
  request: ReconstructionRequest,
  record: DemonstrationEvidenceRecord,
): ReconstructionResult {
  const expected = request.dependencies;
  const checks = {
    sourceIdentityMatch: compare(expected.sourceLineageDigest, record.sourceLineage.lineageDigest),
    observationDigestMatch: compare(expected.observationDigest, record.observationDigest),
    legalActionSetDigestMatch: compare(expected.legalActionSetDigest, record.legalActionSetDigest),
    plannerRequestDigestMatch: compare(expected.plannerRequestDigest, record.plannerRequestDigest),
    plannerResultDigestMatch: compare(expected.plannerResultDigest, record.plannerResultDigest),
    selectedPlanDigestMatch: compare(
      expected.selectedPlanDigest,
      record.selectedPlan?.planDigest ?? null,
    ),
    proposalDigestMatch: compare(expected.proposalDigest, record.proposal?.proposalDigest ?? null),
    validatorResultDigestMatch: compare(
      expected.validatorResultDigest,
      record.validator?.validatorResultDigest ?? null,
    ),
    evidenceRecordDigestMatch: compare(expected.evidenceRecordDigest, record.recordDigest),
  };
  const mismatchReasons = Object.entries(checks)
    .filter(([, value]) => value === false)
    .map(([key]) => key)
    .slice(0, request.maximumMismatchReasons)
    .sort();
  const values = Object.values(checks);
  const outcome: ReconstructionResult["outcome"] = values.some((value) => value === false)
    ? "fail"
    : values.some((value) => value === null)
      ? "unknown"
      : "pass";
  const body = freezeDeep({
    requestId: request.requestId,
    ...checks,
    outcome,
    mismatchReasons: Object.freeze(mismatchReasons),
  });
  return freezeDeep({ ...body, resultDigest: evidenceDigest(body) });
}

function compare(expected: string | null, actual: string | null): boolean | null {
  if (expected === null || actual === null) return null;
  return expected === actual;
}
