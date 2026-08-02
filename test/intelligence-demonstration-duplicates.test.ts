import {
  createEvidenceInput,
  createDemonstrationEvidenceRecord,
  createProposalEvidence,
  createSelectedPlanEvidence,
  createSourceLineage,
  createValidatorEvidence,
  deriveEvidenceRiskLabels,
  deriveQualityLabels,
  evidenceDigest,
  type DemonstrationEvidenceRecord,
} from "../app/features/intelligence-harness/demonstrations";
import { createSearchBudget, stableDigest } from "../app/features/intelligence-harness/planning";

function fixtureRecord(id = "record-1", accepted = true): DemonstrationEvidenceRecord {
  const sourceLineage = createSourceLineage({
    domainId: "keep-the-signal",
    domainVersion: "kts-i4-j",
    engineVersion: "engine-1",
    rulesetVersion: "rules-1",
    observationSchemaId: "observation",
    observationSchemaVersion: "1",
    observationLevel: "planning",
    scenarioFamilyId: "scenario-1",
    partitionFamilyId: "partition-family-1",
    seedIdentity: "seed-1",
    plannerContractId: "planner-contract",
    plannerContractVersion: "1",
    plannerImplementationId: "planner-impl",
    simulationContractId: "simulation-contract",
    simulationContractVersion: "1",
    scoringPolicyId: "score-policy",
    scoringPolicyVersion: "1",
    riskPolicyId: "risk-policy",
    riskPolicyVersion: "1",
    tieBreakPolicyId: "tie-policy",
    tieBreakPolicyVersion: "1",
    proposalProjectorId: "proposal-projector",
    proposalProjectorVersion: "1",
    proposalValidatorId: "proposal-validator",
    proposalValidatorVersion: "1",
    sourceReferences: ["source-1"],
  });
  const planBody = { candidateId: "candidate-1", actions: ["guard"] };
  const planDigest = stableDigest(planBody);
  const selectedPlan = createSelectedPlanEvidence({
    planId: "candidate-1",
    planDigest,
    rank: 1,
    totalScore: 10,
    riskPenalty: 0,
    blocked: false,
    orderedActionIds: ["guard"],
    lineageCandidateIds: ["root", "candidate-1"],
    sourceStateDigest: stableDigest({ state: "source" }),
    resultStateDigest: stableDigest({ state: "result" }),
    simulationResultDigests: [stableDigest({ simulation: 1 })],
    scoreComponents: [
      { metric: "signal_retention", normalizedValue: 1, weight: 1, contribution: 1 },
    ],
    riskFlags: [],
    explanationReferences: ["candidate-1"],
    terminalClassification: "surviving",
    futureOptionValue: 1,
    tieBreakValues: [10, 0, 1],
    truncated: false,
  });
  const proposalBody = { action: "guard", source: "planner" };
  const proposalDigest = stableDigest(proposalBody);
  const proposal = createProposalEvidence({
    proposalSchemaId: "proposal",
    proposalSchemaVersion: "1",
    sourcePlannerResultDigest: stableDigest({ result: "planner" }),
    primaryActionId: "guard",
    orderedActionIds: ["guard"],
    utility: 10,
    confidence: 0.7,
    canonicalContentDigest: evidenceDigest(proposalBody),
    proposalDigest,
  });
  const validatorBody = { proposalDigest, decision: accepted ? "accepted" : "rejected" };
  const validator = createValidatorEvidence({
    validatorId: "proposal-validator",
    validatorVersion: "1",
    proposalDigest,
    decision: accepted ? "accepted" : "rejected",
    reasons: accepted ? [] : ["illegal-target"],
    unsupportedReferences: [],
    legalityFindings: accepted ? [] : ["illegal-target"],
    riskFindings: [],
    validatorResultDigest: stableDigest(validatorBody),
  });
  const plannerResultDigest = proposal.sourcePlannerResultDigest;
  const input = createEvidenceInput({
    recordId: id,
    schemaId: "demonstration-evidence",
    schemaVersion: "1",
    recordedAt: "2026-08-02T18:00:00Z",
    recorderId: "operator-1",
    outcome: accepted ? "proposal_accepted" : "proposal_rejected",
    sourceLineage,
    observationId: "observation-1",
    observationDigest: stableDigest({ observation: 1 }),
    legalActionSetId: "legal-actions-1",
    legalActionSetDigest: stableDigest({ actions: ["guard"] }),
    plannerRequestId: "planner-request-1",
    plannerRequestDigest: stableDigest({ request: 1 }),
    plannerResultId: "planner-result-1",
    plannerResultDigest,
    plannerStatus: "planned",
    plannerBudget: createSearchBudget({
      maximumPlanningDepth: 2,
      beamWidth: 2,
      maximumCandidateExpansions: 10,
      maximumSimulationCalls: 10,
      maximumRetainedCandidates: 10,
      maximumReturnedPlans: 2,
      maximumExplanationEntries: 10,
      maximumCandidateActions: 8,
      maximumScoreComponents: 8,
      maximumOutputBytes: 10000,
    }),
    candidateExpansions: 2,
    simulationCalls: 2,
    retainedCandidates: 2,
    selectedPlan,
    alternativePlanDigests: [planDigest],
    proposal,
    validator,
    reconstructionPolicyId: "reconstruction",
    reconstructionPolicyVersion: "1",
    limitations: ["no-outcome-evidence"],
    duplicateFamilyId: "family-1",
    partitionFamilyId: "partition-family-1",
    truncated: false,
    cancelled: false,
  });
  return createDemonstrationEvidenceRecord(
    input,
    deriveQualityLabels({
      schemaComplete: true,
      lineageComplete: true,
      legalActionSetBound: true,
      plannerResultBound: true,
      proposalProjectionBound: true,
      validatorResultBound: true,
      reconstructable: true,
      truncated: false,
      humanReviewPresent: false,
      outcomeEvidencePresent: false,
    }),
    deriveEvidenceRiskLabels({
      validatorRejected: !accepted,
      blockingPlannerRisk: false,
      lineageMismatch: false,
      digestMismatch: false,
      versionMismatch: false,
      reconstructable: true,
      truncated: false,
      duplicate: false,
      conflictingDuplicate: false,
      reviewRequired: true,
    }),
  );
}

import { describe, expect, it } from "vitest";
import { detectDuplicate } from "../app/features/intelligence-harness/demonstrations";

describe("KTS-I4-J duplicate analysis", () => {
  for (let index = 0; index < 20; index += 1) {
    it(`classifies unique ${index}`, () =>
      expect(detectDuplicate(fixtureRecord(`u-${index}`), []).classification).toBe("unique"));
  }
  for (let index = 0; index < 15; index += 1) {
    it(`classifies exact duplicate ${index}`, () => {
      const record = fixtureRecord(`e-${index}`);
      expect(detectDuplicate(record, [record]).classification).toBe("exact_duplicate");
    });
  }
  for (let index = 0; index < 15; index += 1) {
    it(`classifies structural duplicate ${index}`, () => {
      const left = fixtureRecord(`s-left-${index}`);
      const right = fixtureRecord(`s-right-${index}`);
      expect(detectDuplicate(right, [left]).classification).toBe("structural_duplicate");
    });
  }
  it("classifies conflicting identity", () => {
    const left = fixtureRecord("same", true);
    const right = fixtureRecord("same", false);
    expect(detectDuplicate(right, [left]).classification).toBe("conflicting_duplicate");
  });
});
