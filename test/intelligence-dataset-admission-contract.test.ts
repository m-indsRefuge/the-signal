import { describe, expect, it } from "vitest";
import {
  ABSENT_AUTHORITY,
  canonicalJson,
  createAdmissionRequest,
  digestCanonical,
  immutableCopy,
  requireSafeInteger,
  type AdmissionRequest,
  type EvidenceOutcome,
  type NormalizedSample,
  projectNormalizedSample,
  classifySampleRole,
  deriveFamilyIdentities,
} from "../app/features/intelligence-harness/dataset-admission";

function makeRequest(index = 0, outcome: EvidenceOutcome = "proposal_accepted"): AdmissionRequest {
  return createAdmissionRequest({
    requestId: `request-${index}`,
    requestedAt: "2026-08-02T18:00:00Z",
    datasetPurposeId: "kts-strategy-sft-v1",
    evidence: {
      schemaId: "kts-i4-j.demonstration-evidence",
      schemaVersion: "1.0.0",
      evidenceId: `evidence-${index}`,
      evidenceDigest: `evidence-digest-${index}`,
      outcome,
      domainId: "keep-the-signal",
      domainVersion: "1.0.0",
      scenarioFamilyId: `scenario-${index}`,
      episodeFamilyId: `episode-${index}`,
      duplicateFamilyId: `duplicate-${index}`,
      partitionFamilyId: `partition-${index}`,
      provenanceFamilyId: `provenance-${index}`,
      seedIdentity: `seed-${index}`,
      observationId: `observation-${index}`,
      observationDigest: `observation-digest-${index}`,
      observationProjection: { tick: index, signal: 100 - index },
      legalActionSetDigest: `legal-${index}`,
      legalActionProjection: [{ action: "hold" }, { action: "move" }],
      plannerRequestId: `planner-request-${index}`,
      plannerRequestDigest: `planner-request-digest-${index}`,
      plannerResultId: `planner-result-${index}`,
      plannerResultDigest: `planner-result-digest-${index}`,
      selectedPlan: outcome === "proposal_accepted" ? { actions: ["hold"] } : undefined,
      proposal: outcome.startsWith("proposal_") ? { action: "hold" } : undefined,
      proposalDigest: outcome.startsWith("proposal_") ? `proposal-${index}` : undefined,
      validatorDecision:
        outcome === "proposal_accepted"
          ? "accepted"
          : outcome === "proposal_rejected"
            ? "rejected"
            : undefined,
      validatorReasons: outcome === "proposal_rejected" ? ["illegal_action"] : [],
      validatorResultDigest: outcome.startsWith("proposal_") ? `validator-${index}` : undefined,
      qualityLabels: [
        "schema_complete",
        "lineage_complete",
        "legal_action_set_bound",
        "planner_result_bound",
        "deterministically_reconstructable",
      ],
      riskLabels: ["none_observed"],
      limitations: [],
      reconstructionStatus: "pass",
      declaredTruncation: false,
    },
    review: {
      reviewId: `review-${index}`,
      reviewDigest: `review-digest-${index}`,
      evidenceId: `evidence-${index}`,
      evidenceDigest: `evidence-digest-${index}`,
      reviewerId: "operator-nolan",
      decision: "accepted_for_further_evaluation",
      policyId: "kts-i4-j.review",
      policyVersion: "1.0.0",
      reviewedAt: "2026-08-02T18:05:00Z",
      reasonCodes: ["reviewed"],
      limitations: [],
    },
    policies: {
      eligibilityPolicyId: "kts-i4-k.eligibility",
      eligibilityPolicyVersion: "1.0.0",
      sampleRolePolicyId: "kts-i4-k.kts-sample-role",
      sampleRolePolicyVersion: "1.0.0",
      sampleSchemaId: "kts-i4-k.sample",
      sampleSchemaVersion: "1.0.0",
      duplicatePolicyId: "kts-i4-k.duplicate",
      duplicatePolicyVersion: "1.0.0",
      familyPolicyId: "kts-i4-k.family",
      familyPolicyVersion: "1.0.0",
      partitionPolicyId: "kts-i4-k.partition",
      partitionPolicyVersion: "1.0.0",
      leakagePolicyId: "kts-i4-k.leakage",
      leakagePolicyVersion: "1.0.0",
      manifestPolicyId: "kts-i4-k.manifest",
      manifestPolicyVersion: "1.0.0",
    },
  });
}

function makeSample(index = 0, outcome: EvidenceOutcome = "proposal_accepted"): NormalizedSample {
  const request = makeRequest(index, outcome);
  return projectNormalizedSample({
    sampleId: `sample-${index}`,
    evidence: request.evidence,
    review: request.review,
    datasetPurposeId: request.datasetPurposeId,
    role: classifySampleRole(outcome),
    families: deriveFamilyIdentities(request.evidence),
    policyBindings: request.policies,
  });
}

void makeSample;

describe("dataset admission contract", () => {
  it("freezes absent authority", () => {
    expect(Object.isFrozen(ABSENT_AUTHORITY)).toBe(true);
    expect(ABSENT_AUTHORITY.exportAuthorization).toBe("absent");
  });
  it("canonicalizes object key order", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });
  it("clones and freezes nested values", () => {
    const value = immutableCopy({ a: [{ b: 1 }] });
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.a)).toBe(true);
  });
  it("validates safe integers", () => {
    expect(requireSafeInteger(10, "value")).toBe(10);
  });
  for (let index = 0; index < 54; index += 1) {
    it(`produces stable canonical digest ${index}`, () => {
      const value = { index, nested: { z: index, a: "x" } };
      expect(digestCanonical(value)).toBe(digestCanonical(value));
      expect(digestCanonical(value)).toHaveLength(32);
    });
  }
});
