import { describe, expect, it } from "vitest";
import {
  createLegalAction,
  createLegalActionSet,
  createPlannerIdentity,
  createPlannerMetrics,
  createPlannerResult,
  createPlanningRequest,
  createRiskPolicy,
  createScorePolicy,
  createSearchBudget,
  stableDigest,
  type PlannerResult,
  type SimulatedState,
} from "../app/features/intelligence-harness/planning";
import {
  createKtsDemonstrationSource,
  createKtsProposalEvidence,
  createKtsValidatorEvidence,
  projectKtsSelectedPlanEvidence,
} from "../app/features/keep-the-signal/demonstrations";
import { projectKtsPlanningProposal } from "../app/features/keep-the-signal/planning";

const stateBody = {
  stateId: "observation-1",
  simulatorVersion: "sim-1",
  terminal: false,
  metrics: {
    signal: 0.5,
    defence: 0.5,
    coherence: 0.5,
    threat: 0,
    damage: 0,
    resource: 0.5,
    recoveryPotential: 0.5,
    waveProgress: 0.2,
    futureOptions: 0.8,
    terminalSurvival: 1,
  },
};
const state: SimulatedState = Object.freeze({ ...stateBody, stateDigest: stableDigest(stateBody) });
const actions = createLegalActionSet(state.stateDigest, "actions-1", [
  createLegalAction("guard", "guard", 0, {}),
]);
const weights = {
  signal_retention: 1,
  defence_retention: 1,
  coherence: 1,
  damage_avoidance: 1,
  threat_reduction: 1,
  resource_efficiency: 1,
  recovery_potential: 1,
  wave_progress: 1,
  terminal_survival: 1,
  future_option_value: 1,
};
const score = createScorePolicy("score", "1", weights);
const risk = createRiskPolicy({
  policyId: "risk",
  policyVersion: "1",
  lowSignalThreshold: -1,
  defenceCollapseThreshold: -1,
  resourceDepletionThreshold: -1,
  highDamageThreshold: 1,
  lowCoherenceThreshold: -1,
  blockingFlags: ["terminal_failure"],
  penaltyPerFlag: 1,
});
const budget = createSearchBudget({
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
});
const request = createPlanningRequest({
  requestId: "request-1",
  planner: createPlannerIdentity("planner", "1"),
  observationSchemaVersion: "obs-1",
  legalActionSchemaVersion: "actions-1",
  simulatorVersion: "sim-1",
  scoringPolicy: score,
  riskPolicy: risk,
  initialState: state,
  budget,
  abstentionThreshold: -1,
  tieBreakPolicyVersion: "tie-1",
  seedIdentity: "seed-1",
  cancelled: false,
});
function plannerResult(index = 0): PlannerResult {
  const planBody = {
    rank: 1,
    candidateId: `candidate-${index}`,
    candidateDigest: stableDigest({ candidate: index }),
    actionIds: ["guard"],
    lineageCandidateIds: ["root", `candidate-${index}`],
    sourceStateDigest: state.stateDigest,
    resultStateDigest: stableDigest({ result: index }),
    scoreComponents: [
      { metric: "future_option_value", normalizedValue: 0.8, weight: 1, contribution: 0.8 },
    ],
    riskFlags: [],
    totalUtility: 10,
    riskPenalty: 0,
    blocked: false,
  };
  const plan = Object.freeze({ ...planBody, planDigest: stableDigest(planBody) });
  return createPlannerResult({
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    plannerId: request.planner.plannerId,
    plannerVersion: request.planner.plannerVersion,
    simulatorVersion: request.simulatorVersion,
    scoringPolicyVersion: request.scoringPolicy.policyVersion,
    tieBreakPolicyVersion: request.tieBreakPolicyVersion,
    status: "planned",
    rankedPlans: [plan],
    selectedPlan: plan,
    metrics: createPlannerMetrics({
      depthsVisited: 1,
      candidateExpansions: 1,
      simulationCalls: 1,
      retainedCandidates: 1,
      blockedCandidates: 0,
      terminalCandidates: 0,
      noLegalActionStates: 0,
    }),
    budget,
    budgetConsumption: { candidateExpansions: 1, simulationCalls: 1, retainedCandidates: 1 },
    limitations: [],
  });
}

function requireProposal(result: PlannerResult) {
  const proposal = projectKtsPlanningProposal(result);
  if (proposal === null) throw new Error("Expected a projected proposal.");
  return proposal;
}

describe("KTS-I4-J KTS adapters", () => {
  for (let index = 0; index < 20; index += 1) {
    it(`projects selected plan ${index}`, () =>
      expect(projectKtsSelectedPlanEvidence(plannerResult(index))?.rank).toBe(1));
  }
  for (let index = 0; index < 10; index += 1) {
    it(`creates source lineage ${index}`, () =>
      expect(
        createKtsDemonstrationSource({
          engineVersion: "engine-1",
          rulesetVersion: "rules-1",
          scenarioFamilyId: `scenario-${index}`,
          partitionFamilyId: "partition-1",
          plannerImplementationId: "planner-impl",
          observation: state,
          legalActions: actions,
          request,
          result: plannerResult(index),
          sourceReferences: ["source-1"],
        }).domainId,
      ).toBe("keep-the-signal"));
  }
  for (let index = 0; index < 10; index += 1) {
    it(`binds validator evidence ${index}`, () => {
      const proposal = requireProposal(plannerResult(index));
      const evidence = createKtsValidatorEvidence(proposal, {
        classification: "advisory_valid",
        issues: [],
      });
      expect(evidence.decision).toBe("accepted");
      expect(createKtsProposalEvidence(proposal).actionExecuted).toBe(false);
    });
  }
  it("marks proposal validation required", () =>
    expect(projectKtsPlanningProposal(plannerResult())?.requiresProposalValidation).toBe(true));
  it("does not execute actions", () =>
    expect(createKtsProposalEvidence(requireProposal(plannerResult())).actionExecuted).toBe(false));
});
