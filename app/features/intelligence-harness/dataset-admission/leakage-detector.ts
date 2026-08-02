import { digestCanonical, immutableCopy } from "./admission-contract";
import type { PartitionAssignment } from "./partition-contract";
import type { NormalizedSample } from "./sample-contract";
import type { LeakageFinding, LeakageResult } from "./leakage-contract";

export type LeakagePolicy = Readonly<{
  policyId: string;
  policyVersion: string;
}>;

function finding(code: string, left: NormalizedSample, right: NormalizedSample): LeakageFinding {
  return Object.freeze({
    code,
    leftSampleId: left.sampleId,
    rightSampleId: right.sampleId,
  });
}

export function detectPairLeakage(
  left: NormalizedSample,
  leftAssignment: PartitionAssignment,
  right: NormalizedSample,
  rightAssignment: PartitionAssignment,
  policy: LeakagePolicy,
): LeakageResult {
  const findings: LeakageFinding[] = [];

  if (leftAssignment.partition !== rightAssignment.partition) {
    const comparisons: ReadonlyArray<readonly [string, string | undefined, string | undefined]> = [
      ["exact_sample_overlap", left.sampleDigest, right.sampleDigest],
      ["evidence_identity_overlap", left.evidenceId, right.evidenceId],
      ["review_identity_overlap", left.reviewId, right.reviewId],
      ["scenario_family_overlap", left.families.scenarioFamilyId, right.families.scenarioFamilyId],
      ["episode_family_overlap", left.families.episodeFamilyId, right.families.episodeFamilyId],
      [
        "duplicate_family_overlap",
        left.families.duplicateFamilyId,
        right.families.duplicateFamilyId,
      ],
      [
        "partition_family_overlap",
        left.families.partitionFamilyId,
        right.families.partitionFamilyId,
      ],
      ["observation_digest_overlap", left.observationDigest, right.observationDigest],
      ["legal_action_set_digest_overlap", left.legalActionSetDigest, right.legalActionSetDigest],
      ["planner_request_digest_overlap", left.plannerRequestDigest, right.plannerRequestDigest],
      ["planner_result_digest_overlap", left.plannerResultDigest, right.plannerResultDigest],
      ["proposal_digest_overlap", left.proposalDigest, right.proposalDigest],
      ["validator_result_digest_overlap", left.validatorResultDigest, right.validatorResultDigest],
      [
        "provenance_family_overlap",
        left.families.provenanceFamilyId,
        right.families.provenanceFamilyId,
      ],
    ];

    for (const [code, leftValue, rightValue] of comparisons) {
      if (!leftValue || !rightValue) {
        if (
          code === "episode_family_overlap" ||
          code === "proposal_digest_overlap" ||
          code === "validator_result_digest_overlap"
        ) {
          continue;
        }
        findings.push(finding(`unknown:${code}`, left, right));
      } else if (leftValue === rightValue) {
        findings.push(finding(code, left, right));
      }
    }
  }

  const hasBlocked = findings.some((item) => !item.code.startsWith("unknown:"));
  const hasUnknown = findings.some((item) => item.code.startsWith("unknown:"));
  const state: LeakageResult["state"] = hasBlocked ? "blocked" : hasUnknown ? "unknown" : "clear";

  const normalized = {
    state,
    findings: [...findings].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)),
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
  };
  return immutableCopy({
    ...normalized,
    digest: digestCanonical(normalized),
  }) as LeakageResult;
}

export function combineLeakageResults(
  results: readonly LeakageResult[],
  policy: LeakagePolicy,
): LeakageResult {
  const findings = results.flatMap((result) => result.findings);
  const state: LeakageResult["state"] = results.some((result) => result.state === "blocked")
    ? "blocked"
    : results.some((result) => result.state === "unknown")
      ? "unknown"
      : "clear";
  const normalized = {
    state,
    findings,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
  };
  return immutableCopy({
    ...normalized,
    digest: digestCanonical(normalized),
  }) as LeakageResult;
}
