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
import {
  createReconstructionRequest,
  evaluateReconstruction,
} from "../app/features/intelligence-harness/demonstrations";

function request(record = fixtureRecord(), change: string | null = null) {
  return createReconstructionRequest({
    requestId: "reconstruct-1",
    policyId: "policy",
    policyVersion: "1",
    maximumMismatchReasons: 64,
    dependencies: {
      sourceLineageDigest: record.sourceLineage.lineageDigest,
      observationDigest: record.observationDigest,
      legalActionSetDigest: record.legalActionSetDigest,
      plannerRequestDigest: record.plannerRequestDigest,
      plannerResultDigest: change ?? record.plannerResultDigest,
      selectedPlanDigest: record.selectedPlan?.planDigest ?? null,
      proposalDigest: record.proposal?.proposalDigest ?? null,
      validatorResultDigest: record.validator?.validatorResultDigest ?? null,
      evidenceRecordDigest: record.recordDigest,
    },
  });
}

describe("KTS-I4-J reconstruction", () => {
  for (let index = 0; index < 35; index += 1) {
    it(`passes exact reconstruction ${index}`, () => {
      const record = fixtureRecord(`record-${index}`);
      expect(evaluateReconstruction(request(record), record).outcome).toBe("pass");
    });
  }
  for (let index = 0; index < 10; index += 1) {
    it(`fails altered reconstruction ${index}`, () => {
      const record = fixtureRecord(`failure-${index}`);
      expect(evaluateReconstruction(request(record, "f".repeat(32)), record).outcome).toBe("fail");
    });
  }
  for (let index = 0; index < 10; index += 1) {
    it(`returns unknown without dependency ${index}`, () => {
      const record = fixtureRecord(`unknown-${index}`);
      const base = request(record);
      const unknown = createReconstructionRequest({
        ...base,
        dependencies: { ...base.dependencies, proposalDigest: null },
      });
      expect(evaluateReconstruction(unknown, record).outcome).toBe("unknown");
    });
  }
  it("supports 10000 deterministic reconstruction evaluations", () => {
    const record = fixtureRecord("reconstruction-scale");
    const reconstructionRequest = request(record);
    let passes = 0;
    for (let index = 0; index < 10000; index += 1) {
      if (evaluateReconstruction(reconstructionRequest, record).outcome === "pass") passes += 1;
    }
    expect(passes).toBe(10000);
  });
});
